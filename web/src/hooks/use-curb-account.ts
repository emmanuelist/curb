"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { publicClient } from "@/lib/chain/clients";
import { readCurbAccount } from "@/lib/curb/account";
import { MON_USDC } from "@/lib/markets/registry";
import { useAccount } from "@/hooks/use-account";
import { useBlockSelector } from "@/hooks/use-live-block";

/** Blocks per refresh: ~5 real blocks (~2 s) is fresh enough to see a deposit or a fill land, light on the public RPC. */
const BLOCKS_PER_REFRESH = 5n;

/** This device's Curb account onchain: its address, whether it exists yet, its trader, and its Kuru margin. */
export function useCurbAccount() {
  const record = useAccount();
  const bucket = useBlockSelector((s) => (s.block === null ? "initial" : (s.block / BLOCKS_PER_REFRESH).toString()));
  const live = useBlockSelector((s) => s.status === "live");

  // One stable key per account, refetched per bucket (the same pattern as useMarket), so structural sharing keeps the
  // state object identical while nothing onchain changed.
  const query = useQuery({
    queryKey: ["curb-account", record?.owner, record?.trading],
    enabled: Boolean(record),
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: live ? false : 6_000,
    retry: 2,
    queryFn: () => readCurbAccount(publicClient, { owner: record!.owner, trading: record!.trading }, MON_USDC),
  });

  const { refetch } = query;
  const enabled = Boolean(record);
  useEffect(() => {
    if (enabled && bucket !== "initial") void refetch({ cancelRefetch: false });
  }, [bucket, enabled, refetch]);

  return { record, state: query.data ?? null, isLoading: query.isPending && enabled, error: query.error, refetch };
}
