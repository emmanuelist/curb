import type { Hash } from "viem";
import { publicClient } from "@/lib/chain/clients";

/**
 * A trading-key transaction's receipt, asked for every 100 ms. Monad makes a block about every 400 ms, and viem's
 * default poll for it is 500 ms, which would add up to half a second to every "confirmed" the app reports (#44).
 */
export function confirm(hash: Hash) {
  return publicClient.waitForTransactionReceipt({ hash, pollingInterval: 100 });
}

/** A clock started at the tap; calling the result reads the milliseconds since (outside render, so React stays pure). */
export function stopwatch() {
  const t0 = performance.now();
  return () => performance.now() - t0;
}

/** Tap to receipt as the confirmation prints it: 940 → "0.9 s", 12_300 → "12.3 s". */
export const seconds = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(1)} s`;
