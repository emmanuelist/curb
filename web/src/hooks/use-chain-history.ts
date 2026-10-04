"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { batchedClient } from "@/lib/chain/clients";
import { appendLedger, readLedger, readSync, writeSync } from "@/lib/curb/ledger";
import { rebuildLedger, type RebuildProgress } from "@/lib/curb/rebuild";
import { useCurbAccount } from "@/hooks/use-curb-account";

export type ChainHistory = {
  status: "idle" | "reading" | "done" | "error";
  /** Transactions found so far and in all, once the keys' nonces are read. */
  progress: RebuildProgress | null;
  /** When this read started, for the clock shown while it runs. */
  startedAt: number | null;
  result: { added: number; read: number; ms: number; first: boolean } | null;
};

/**
 * Brings this device's ledger up to date with the chain (#40). On a fresh device that is the account's whole history;
 * after that, only what either key sent since, from this device or another. Runs when Orders or History opens.
 */
export function useChainHistory(): ChainHistory {
  const { record, state } = useCurbAccount();
  const account = state?.deployed ? state.address : null;
  const [progress, setProgress] = useState<RebuildProgress | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const query = useQuery({
    queryKey: ["chain-history", account, record?.owner, record?.trading],
    enabled: account !== null && record !== null,
    staleTime: 30_000,
    retry: 1,
    queryFn: async () => {
      const acct = account!;
      const t0 = Date.now();
      setStartedAt(t0);
      setProgress(null);
      const since = readSync(acct);
      const { entries, marker, read } = await rebuildLedger(batchedClient, { account: acct, owner: record!.owner, trading: record!.trading }, since, readLedger(acct), setProgress);
      if (entries.length > 0) appendLedger(acct, ...entries);
      if (marker) writeSync(acct, marker);
      return { added: entries.length, read, ms: Date.now() - t0, first: since === null };
    },
  });
  const status = account === null ? "idle" : query.isFetching ? "reading" : query.isError ? "error" : query.data ? "done" : "reading";
  return { status, progress, startedAt, result: query.data ?? null };
}

/** The time, refreshed every `ms` while `on`: for clocks that tick during a read, without calling Date.now() in render. */
export function useNow(on: boolean, ms = 250): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!on) return;
    const tick = () => setNow(Date.now());
    tick();
    const t = setInterval(tick, ms);
    return () => clearInterval(t);
  }, [on, ms]);
  return now;
}
