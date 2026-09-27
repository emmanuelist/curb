"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { publicClient } from "@/lib/chain/clients";
import { readMarket } from "@/lib/kuru/read";
import { computeLane } from "@/lib/lane";
import { LANE_BAND_BPS, type Market } from "@/lib/markets/registry";
import { useBlockSelector } from "@/hooks/use-live-block";

/** Blocks per refresh: ~2 Monad blocks keeps the book current without hammering the public RPC. */
const BLOCKS_PER_REFRESH = 2n;

/** Kuru's book for `market`, refreshed on real new blocks, plus the lane derived from it. */
export function useMarket(market: Market) {
  // Selected slices: this hook (and the screen using it) re-renders on a new bucket, not on every block.
  const bucket = useBlockSelector((s) => (s.block === null ? "initial" : (s.block / BLOCKS_PER_REFRESH).toString()));
  const live = useBlockSelector((s) => s.status === "live");

  // One stable key, refetched per bucket: structural sharing then keeps every unchanged level, side and the top of
  // book as the same objects across refreshes, so memoised views skip the work when Kuru's book didn't move.
  const query = useQuery({
    queryKey: ["market", market.id],
    queryFn: () => readMarket(publicClient, market),
    staleTime: Number.POSITIVE_INFINITY,
    // Without a block stream, fall back to polling rather than showing nothing.
    refetchInterval: live ? false : 4_000,
    retry: 2,
  });

  const { refetch } = query;
  useEffect(() => {
    if (bucket !== "initial") void refetch({ cancelRefetch: false });
  }, [bucket, refetch]);

  const top = query.data?.top;
  const lane = useMemo(() => (top ? computeLane(top, { bandBps: LANE_BAND_BPS, tickSize: market.tickSize }) : null), [top, market.tickSize]);

  return { snapshot: query.data ?? null, lane, isLoading: query.isPending, error: query.error };
}
