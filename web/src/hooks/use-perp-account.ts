"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { publicClient } from "@/lib/chain/clients";
import type { Market } from "@/lib/markets/registry";
import { readPerpAccount } from "@/lib/perpl/read";
import { useBlockSelector } from "@/hooks/use-live-block";
import { useCurbAccount } from "@/hooks/use-curb-account";

const BLOCKS_PER_REFRESH = 5n;

/** The Curb account's Perpl account on `market`: AUSD free and locked, and the open position. Null until it exists. */
export function usePerpAccount(market: Market) {
  const { state } = useCurbAccount();
  const account = state?.deployed && state.perps.opened ? state.address : null;
  const bucket = useBlockSelector((s) => (s.block === null ? "initial" : (s.block / BLOCKS_PER_REFRESH).toString()));
  const live = useBlockSelector((s) => s.status === "live");
  const query = useQuery({
    queryKey: ["perp-account", account, market.id],
    enabled: account !== null && market.venue === "perpl",
    staleTime: Number.POSITIVE_INFINITY,
    refetchInterval: live ? false : 6_000,
    retry: 2,
    queryFn: () => readPerpAccount(publicClient, account!, market),
  });
  const { refetch } = query;
  const enabled = account !== null && market.venue === "perpl";
  useEffect(() => {
    if (enabled && bucket !== "initial") void refetch({ cancelRefetch: false });
  }, [bucket, enabled, refetch]);
  return { perp: query.data ?? null, refetch, isLoading: query.isPending && enabled };
}
