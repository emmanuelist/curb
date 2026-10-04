"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Address } from "viem";
import { FlowQuoteError, quoteMonForAusd } from "@/lib/kuru/flow";

/** `value` once it has stopped changing for `ms`: Kuru Flow takes one quote a second, so typing doesn't spend them. */
export function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/** Kuru Flow's checked quote for swapping `amount` MON on `user` for AUSD, refreshed while it's on screen. */
export function useFlowQuote(user: Address | null, amount: bigint | null) {
  return useQuery({
    queryKey: ["kuru-flow-quote", user, amount?.toString()],
    enabled: user !== null && amount !== null && amount > 0n,
    queryFn: ({ signal }) => quoteMonForAusd(user as Address, amount as bigint, signal),
    staleTime: 10_000,
    refetchInterval: 15_000,
    // Only the rate limit is worth retrying; a refused quote stays refused.
    retry: (count, error) => count < 2 && error instanceof FlowQuoteError && /one quote a second/.test(error.message),
    retryDelay: 1_100,
  });
}
