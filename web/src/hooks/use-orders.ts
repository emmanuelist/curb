"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Address } from "viem";
import { publicClient } from "@/lib/chain/clients";
import { LOG_RANGE, makerFillsFromLogs, readOrder, type OrderOnBook } from "@/lib/curb/account";
import { appendLedger, cancellingSnapshot, subscribeCancelling, trackedOrderIds, type LedgerEntry } from "@/lib/curb/ledger";
import { MON_USDC } from "@/lib/markets/registry";
import { useBlockSelector } from "@/hooks/use-live-block";

type OrderEntry = Extract<LedgerEntry, { kind: "order" }>;

export type OrderView = {
  entry: OrderEntry;
  /**
   * open: resting on Kuru now. cancelling: a cancel from this tab is in flight. filled: Kuru's book shows it filled, or fills Curb saw cover it. cancelled: cancelled
   * from this device. closed: gone from the book with no fill or cancel seen here (Kuru usually clears a filled order
   * the same way as a cancelled one, so after the fact the chain can't always say which). unknown: not read yet.
   */
  status: "open" | "cancelling" | "filled" | "cancelled" | "closed" | "unknown";
  /** Size still resting on Kuru (size units), when open. */
  remaining: bigint;
  /** Size Curb saw fill: on arrival plus fills of the resting order while the app was open. */
  filled: bigint;
  /** The fill transactions Curb saw for the resting part. */
  fills: Extract<LedgerEntry, { kind: "fill" }>[];
};

const BLOCKS_PER_REFRESH = 5n;
/** Last block scanned for fills, per account, for this tab. */
const scanned = new Map<string, bigint>();

/**
 * Every order this device placed for `account`, its state on Kuru's book now, and the fills of its resting orders.
 * While any order rests, each refresh scans the new blocks' Kuru logs for this account as maker (at most 100 blocks, the
 * public RPC's limit) and records what it finds in the ledger.
 */
export function useOrders(account: Address | null, entries: LedgerEntry[]) {
  const bucket = useBlockSelector((s) => (s.block === null ? "initial" : (s.block / BLOCKS_PER_REFRESH).toString()));
  const live = useBlockSelector((s) => s.status === "live");
  const ids = useMemo(() => trackedOrderIds(entries), [entries]);
  const inFlight = useSyncExternalStore(subscribeCancelling, cancellingSnapshot, cancellingSnapshot);

  const query = useQuery({
    queryKey: ["orders", account, ids.join(",")],
    enabled: Boolean(account) && ids.length > 0,
    // A new order changes the key: keep the known statuses on screen while the new set is read.
    placeholderData: keepPreviousData,
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: live ? false : 6_000,
    retry: 2,
    queryFn: async () => {
      const owner = account as Address;
      const states = await Promise.all(ids.map((id) => readOrder(publicClient, MON_USDC, BigInt(id), owner)));
      const book = new Map<string, OrderOnBook>(ids.map((id, i) => [id, states[i]]));
      const resting = new Set(ids.filter((id) => book.get(id)?.state === "resting"));
      // Scan while something rests, and once more after the last one leaves, so its final fill is caught.
      const key = owner.toLowerCase();
      const latest = await publicClient.getBlockNumber();
      const last = scanned.get(key);
      const from = last === undefined || latest - last > LOG_RANGE ? latest - LOG_RANGE + 1n : last + 1n;
      if (from <= latest && (resting.size > 0 || last !== undefined)) {
        const logs = await publicClient.getLogs({ address: MON_USDC.orderBook, fromBlock: from, toBlock: latest });
        const fills = makerFillsFromLogs(logs, MON_USDC, owner, new Set(ids));
        if (fills.length > 0) {
          appendLedger(
            owner,
            ...fills.map((f) => ({ kind: "fill" as const, hash: f.hash, at: Date.now(), orderId: f.orderId.toString(), size: f.size.toString(), block: f.block.toString() })),
          );
        }
        if (resting.size > 0) scanned.set(key, latest);
        else scanned.delete(key);
      }
      return book;
    },
  });

  const { refetch } = query;
  const enabled = Boolean(account) && ids.length > 0;
  useEffect(() => {
    if (enabled && bucket !== "initial") void refetch({ cancelRefetch: false });
  }, [bucket, enabled, refetch]);

  const orders = useMemo(() => {
    const cancelled = new Set(entries.flatMap((e) => (e.kind === "cancel" ? e.orderIds : [])));
    const fillsById = new Map<string, Extract<LedgerEntry, { kind: "fill" }>[]>();
    for (const e of entries) if (e.kind === "fill") fillsById.set(e.orderId, [...(fillsById.get(e.orderId) ?? []), e]);

    return entries
      .filter((e): e is OrderEntry => e.kind === "order")
      .map((entry): OrderView => {
        const size = BigInt(entry.size);
        const fills = entry.orderId ? (fillsById.get(entry.orderId) ?? []) : [];
        const filled = BigInt(entry.takerFill) + fills.reduce((sum, f) => sum + BigInt(f.size), 0n);
        const base = { entry, fills, filled, remaining: 0n };
        if (!entry.orderId) return { ...base, status: "filled" };
        if (cancelled.has(entry.orderId)) return { ...base, status: "cancelled" };
        if (inFlight.has(entry.orderId)) return { ...base, status: "cancelling", remaining: query.data?.get(entry.orderId)?.size ?? 0n };
        const onBook = query.data?.get(entry.orderId);
        if (!onBook) return { ...base, status: "unknown" };
        if (onBook.state === "resting") return { ...base, status: "open", remaining: onBook.size };
        return { ...base, status: onBook.state === "filled" || filled >= size ? "filled" : "closed" };
      })
      .reverse();
  }, [entries, query.data, inFlight]);

  return { orders, isLoading: query.isPending && enabled, refetch };
}
