"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import type { Address, Hash } from "viem";
import { publicClient } from "@/lib/chain/clients";
import { LOG_RANGE } from "@/lib/curb/account";
import { appendLedger, cancellingSnapshot, subscribeCancelling, type LedgerEntry } from "@/lib/curb/ledger";
import {
  lotsResting,
  perpCancelKey,
  perpFilled,
  perpMakerFillsFromLogs,
  perpOrderRecords,
  perpOrderStatus,
  restingCandidates,
  type PerpOrderRecord,
  type PerpOrderStatus,
} from "@/lib/curb/perp-orders";
import { MON_PERP, type Market } from "@/lib/markets/registry";
import { perplExchangeAbi } from "@/lib/perpl/abi";
import { useBlockSelector } from "@/hooks/use-live-block";
import { usePerpAccount } from "@/hooks/use-perp-account";

export type PerpOrderView = PerpOrderRecord & {
  market: Market;
  status: PerpOrderStatus;
  /** Lots resting on Perpl now, when open. */
  remaining: bigint;
  /** Lots Curb saw trade: on arrival plus fills of the resting part while the app was open. */
  filled: bigint;
};

const BLOCKS_PER_REFRESH = 5n;
/** Last block scanned for Perpl fills, per account and perpetual, for this tab. */
const scanned = new Map<string, bigint>();

/**
 * Every Perpl order this device placed for `account` on `market`, its state on Perpl's book now, and the fills of its
 * resting orders. While any order rests, each refresh scans the new blocks' Perpl logs for this account as maker (at
 * most 100 blocks, the public RPC's limit) and records what it finds in the ledger.
 */
export function usePerpOrders(account: Address | null, entries: LedgerEntry[], market: Market = MON_PERP) {
  const { perp } = usePerpAccount(market);
  const perplAccountId = perp?.accountId ?? null;
  const bucket = useBlockSelector((s) => (s.block === null ? "initial" : (s.block / BLOCKS_PER_REFRESH).toString()));
  const live = useBlockSelector((s) => s.status === "live");
  const records = useMemo(() => perpOrderRecords(entries, market.id), [entries, market.id]);
  const candidates = useMemo(() => restingCandidates(records), [records]);
  const inFlight = useSyncExternalStore(subscribeCancelling, cancellingSnapshot, cancellingSnapshot);
  const enabled = account !== null && perplAccountId !== null && market.perpId !== undefined && candidates.length > 0;

  const query = useQuery({
    // Keyed by transaction, not order id: a reused id is a different order.
    queryKey: ["perp-orders", account, market.id, perplAccountId?.toString(), candidates.map((r) => r.entry.hash).join(",")],
    enabled,
    placeholderData: keepPreviousData,
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: live ? false : 6_000,
    retry: 2,
    queryFn: async () => {
      const owner = account as Address;
      const id = perplAccountId as bigint;
      const perpId = market.perpId as bigint;
      const [info, onBook] = await Promise.all([
        publicClient.readContract({ address: market.orderBook, abi: perplExchangeAbi, functionName: "getPerpetualInfo", args: [perpId] }),
        publicClient.multicall({
          contracts: candidates.map((r) => ({ address: market.orderBook, abi: perplExchangeAbi, functionName: "getOrderV2" as const, args: [perpId, BigInt(r.entry.orderId as string)] as const })),
        }),
      ]);
      // An empty slot reads as zeros (account 0), which never matches ours; a failed read counts as no order too.
      const book = new Map<Hash, bigint>(
        candidates.map((r, i) => [r.entry.hash, lotsResting(r.entry, onBook[i].status === "success" ? (onBook[i].result ?? null) : null, id, info.basePricePNS)]),
      );
      const resting = candidates.filter((r) => (book.get(r.entry.hash) ?? 0n) > 0n);

      // Scan while something rests, and once more after the last one leaves, so its final fill is caught.
      const key = `${owner}:${market.id}`.toLowerCase();
      const latest = await publicClient.getBlockNumber();
      const last = scanned.get(key);
      const from = last === undefined || latest - last > LOG_RANGE ? latest - LOG_RANGE + 1n : last + 1n;
      if (from <= latest && (resting.length > 0 || last !== undefined)) {
        const logs = await publicClient.getLogs({ address: market.orderBook, fromBlock: from, toBlock: latest });
        const fills = perpMakerFillsFromLogs(logs, market, id, new Set(candidates.map((r) => r.entry.orderId as string)));
        if (fills.length > 0) {
          appendLedger(
            owner,
            ...fills.map((f) => ({ kind: "perp-fill" as const, hash: f.hash, at: Date.now(), market: market.id, orderId: f.orderId.toString(), lots: f.lots.toString(), block: f.block.toString() })),
          );
        }
        if (resting.length > 0) scanned.set(key, latest);
        else scanned.delete(key);
      }
      return book;
    },
  });

  const { refetch } = query;
  useEffect(() => {
    if (enabled && bucket !== "initial") void refetch({ cancelRefetch: false });
  }, [bucket, enabled, refetch]);

  const orders = useMemo(
    () =>
      records
        .map((r): PerpOrderView => {
          const remaining = query.data?.get(r.entry.hash);
          const cancelling = r.entry.orderId !== null && inFlight.has(perpCancelKey(market.id, r.entry.orderId));
          return { ...r, market, status: perpOrderStatus(r, remaining, cancelling), remaining: remaining ?? 0n, filled: perpFilled(r) };
        })
        .reverse(),
    [records, query.data, inFlight, market],
  );

  return { orders, isLoading: query.isPending && enabled, refetch };
}
