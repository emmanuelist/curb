import { createPublicClient, http, webSocket, type PublicClient } from "viem";
import { monad } from "viem/chains";

/** Monad mainnet (chain 143). viem's definition carries RPC, WebSocket, Multicall3 and explorers. */
export const chain = monad;

/** HTTP RPC for reads and writes. Point it at an anvil fork of mainnet for development (D-011). */
export const rpcHttpUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];
const wsUrl = process.env.NEXT_PUBLIC_MONAD_WS_URL || monad.rpcUrls.default.webSocket[0];

/** Reads (multicall-batched). */
export const publicClient: PublicClient = createPublicClient({
  chain: monad,
  transport: http(rpcHttpUrl),
  batch: { multicall: true },
});

/**
 * Reads that come in waves (#40's history search): requests made within a few milliseconds go out as one JSON-RPC
 * batch. The public RPC answers batches (40 historical nonce reads in 1.4 s, 2026-10-04).
 */
export const batchedClient: PublicClient = createPublicClient({
  chain: monad,
  // A background read: a slow node (or an anvil fork fetching history it hasn't cached) gets 30 s, not viem's 10, and
  // the public RPC's occasional 429 under a burst gets more patient retries.
  transport: http(rpcHttpUrl, { batch: { batchSize: 50, wait: 8 }, timeout: 30_000, retryCount: 5, retryDelay: 300 }),
});

let wsClient: PublicClient | null = null;

/** Push subscriptions (new blocks). Browser only; one shared socket. */
export function getWsClient(): PublicClient {
  if (typeof window === "undefined") throw new Error("WebSocket client is browser-only");
  wsClient ??= createPublicClient({ chain: monad, transport: webSocket(wsUrl, { reconnect: true }) });
  return wsClient;
}

/** Explorer link (Monadscan, viem's default explorer for Monad; /tx and /address paths verified 2026-09-26). */
export const explorerUrl = (kind: "tx" | "address", value: string) => `${monad.blockExplorers.default.url}/${kind}/${value}`;
