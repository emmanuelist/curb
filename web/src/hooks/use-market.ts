"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { publicClient } from "@/lib/chain/clients";
import { readMarket } from "@/lib/kuru/read";
import { computeLane } from "@/lib/lane";
import { LANE_BAND_BPS, type Market } from "@/lib/markets/registry";
import { useLiveBlock } from "@/hooks/use-live-block";

/** Blocks per refresh: ~2 Monad blocks keeps the book current without hammering the public RPC. */
const BLOCKS_PER_REFRESH = 2n;

/** Kuru's book for `market`, refreshed on real new blocks, plus the lane derived from it. */
export function useMarket(market: Market) {
  const { block, status } = useLiveBlock();
  const bucket = block === null ? "initial" : (block / BLOCKS_PER_REFRESH).toString();

  const query = useQuery({
    queryKey: ["market", market.id, bucket],
    queryFn: () => readMarket(publicClient, market),
    placeholderData: keepPreviousData,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 10_000,
    // Without a block stream, fall back to polling rather than showing nothing.
    refetchInterval: status === "live" ? false : 4_000,
    retry: 2,
  });

  const lane = useMemo(
    () => (query.data ? computeLane(query.data.top, { bandBps: LANE_BAND_BPS, tickSize: market.tickSize }) : null),
    [query.data, market.tickSize],
  );

  return { snapshot: query.data ?? null, lane, isLoading: query.isPending, error: query.error };
}
