"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { erc20Abi, type Address } from "viem";
import { publicClient } from "@/lib/chain/clients";
import { MON_USDC } from "@/lib/markets/registry";
import { useLiveBlock } from "@/hooks/use-live-block";

export type Balances = { mon: bigint; usdc: bigint };

/** Native MON and USDC for an address, refreshed every ~10 real blocks. */
export function useBalances(address: Address | null | undefined) {
  const { block } = useLiveBlock();
  const bucket = block === null ? "initial" : (block / 10n).toString();
  return useQuery({
    queryKey: ["balances", address, bucket],
    enabled: Boolean(address),
    placeholderData: keepPreviousData,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30_000,
    queryFn: async (): Promise<Balances> => {
      const [mon, usdc] = await Promise.all([
        publicClient.getBalance({ address: address as Address }),
        publicClient.readContract({
          address: MON_USDC.quote.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address as Address],
        }),
      ]);
      return { mon, usdc };
    },
  });
}
