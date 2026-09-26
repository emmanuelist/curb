import { createPublicClient, http, webSocket, type PublicClient } from "viem";
import { monad } from "viem/chains";

/** Monad mainnet (chain 143). viem's definition carries RPC, WebSocket, Multicall3 and explorers. */
export const chain = monad;

const httpUrl = process.env.NEXT_PUBLIC_MONAD_RPC_URL || monad.rpcUrls.default.http[0];
const wsUrl = process.env.NEXT_PUBLIC_MONAD_WS_URL || monad.rpcUrls.default.webSocket[0];

/** Reads (multicall-batched). */
export const publicClient: PublicClient = createPublicClient({
  chain: monad,
  transport: http(httpUrl),
  batch: { multicall: true },
});

let wsClient: PublicClient | null = null;

/** Push subscriptions (new blocks). Browser only; one shared socket. */
export function getWsClient(): PublicClient {
  if (typeof window === "undefined") throw new Error("WebSocket client is browser-only");
  wsClient ??= createPublicClient({ chain: monad, transport: webSocket(wsUrl, { reconnect: true }) });
  return wsClient;
}

/** Explorer link for a transaction or address (MonadVision, from viem's chain definition). */
export const explorerUrl = (kind: "tx" | "address", value: string) =>
  `${monad.blockExplorers.monadvision.url}/${kind}/${value}`;
