import { createWalletClient, decodeFunctionData, erc20Abi, http, parseAbi, parseEventLogs, zeroAddress, type Address, type Hash, type Hex, type LocalAccount, type TransactionReceipt } from "viem";
import { chain, publicClient, rpcHttpUrl } from "@/lib/chain/clients";
import { AUSD } from "@/lib/markets/registry";

/**
 * Kuru Flow, Kuru's swap aggregator (docs.monad.xyz/guides/kuru-flow). It finds the best route across Monad's venues
 * (Kuru's books, Uniswap and others) and returns a transaction for its router. Curb uses it for one thing: turning MON
 * on the owner key into AUSD for futures margin (#56, D-026). The quote is Kuru's offchain estimate; the swap, its
 * minimum and the AUSD received are onchain.
 */
export const KURU_FLOW_API = "https://ws.kuru.io";

/** KuruFlowEntrypoint on Monad mainnet: Sourcify match, not a proxy (verified 2026-10-04). Curb signs for nothing else. */
export const KURU_FLOW_ROUTER: Address = "0xb3e6778480b2E488385E8205eA05E20060B813cb";

/** The most fee a quote may carry (Kuru's plus a referrer's), in basis points. Quotes on 2026-10-04 carried none. */
export const MAX_FLOW_FEE_BPS = 50n;

/** The router's two swap entrypoints, from its verified source (src/entrypoint/KuruFlowEntrypoint.sol). */
export const kuruFlowAbi = parseAbi([
  "struct SwapIntent { address tokenUserBuys; uint256 minAmountUserBuys; address tokenUserSells; uint256 amountUserSells; }",
  "struct FeeCollection { address feeCollectorAddress; uint256 feeBps; address referrerAddress; uint256 referrerFeeBps; bool isInTokenFee; }",
  "function executeSwap(SwapIntent swapIntent, FeeCollection feeCollection, bytes program) payable returns (uint256 amountOut)",
  "function executeSwapWithReceiver(SwapIntent swapIntent, FeeCollection feeCollection, bytes program, address receiver) payable returns (uint256 amountOut)",
]);

export type FlowQuote = {
  /** AUSD Kuru Flow expects the route to return (6 decimals). An estimate. */
  out: bigint;
  /** The least AUSD the router will accept, written into the transaction: the swap reverts below it. */
  minOut: bigint;
  feeBps: bigint;
  to: Address;
  data: Hex;
  value: bigint;
};

/** A quote Curb won't sign, or couldn't get. The message is shown as it is. */
export class FlowQuoteError extends Error {}

type RawQuote = {
  status?: string;
  message?: string;
  output?: string;
  minOut?: string;
  transaction?: { to?: string; calldata?: string; value?: string };
};

const refuse = (why: string) => new FlowQuoteError(`Curb won't sign this quote: ${why}. Nothing was signed.`);

/**
 * The quote as something the owner key may sign, or a refusal. The transaction must call Kuru Flow's router, sell
 * exactly `amountIn` of MON for AUSD to the owner key itself, carry an onchain minimum no lower than the quote's, and
 * pay at most MAX_FLOW_FEE_BPS. The calldata is decoded and checked; the API's own fields aren't trusted alone.
 */
export function checkFlowQuote(raw: unknown, amountIn: bigint, user: Address): FlowQuote {
  const q = (raw ?? {}) as RawQuote;
  if (q.status !== "success" || !q.transaction) throw new FlowQuoteError(q.message ? `Kuru Flow: ${q.message}` : "Kuru Flow found no route for this amount.");
  const { to, calldata, value } = q.transaction;
  if (!to || to.toLowerCase() !== KURU_FLOW_ROUTER.toLowerCase()) throw refuse("it points at a contract Curb doesn't know");
  if (value === undefined || BigInt(value) !== amountIn) throw refuse("it sends a different amount of MON");
  const data = `0x${(calldata ?? "").replace(/^0x/, "")}` as Hex;
  let call: ReturnType<typeof decodeFunctionData<typeof kuruFlowAbi>>;
  try {
    call = decodeFunctionData({ abi: kuruFlowAbi, data });
  } catch {
    throw refuse("its transaction isn't a Kuru Flow swap");
  }
  const [intent, fee] = call.args;
  if (call.functionName === "executeSwapWithReceiver" && call.args[3].toLowerCase() !== user.toLowerCase()) throw refuse("it pays the AUSD to another address");
  if (intent.tokenUserSells !== zeroAddress || intent.amountUserSells !== amountIn) throw refuse("it sells something other than your MON");
  if (intent.tokenUserBuys.toLowerCase() !== AUSD.toLowerCase()) throw refuse("it buys something other than AUSD");
  const quotedMin = BigInt(q.minOut ?? "0");
  if (intent.minAmountUserBuys === 0n || intent.minAmountUserBuys < quotedMin) throw refuse("its onchain minimum is below the quote");
  const feeBps = fee.feeBps + fee.referrerFeeBps;
  if (feeBps > MAX_FLOW_FEE_BPS) throw refuse(`it carries a ${Number(feeBps) / 100}% fee`);
  return { out: BigInt(q.output ?? "0"), minOut: intent.minAmountUserBuys, feeBps, to: KURU_FLOW_ROUTER, data, value: amountIn };
}

/** Kuru Flow's bearer tokens are per address and last about a day; the API takes one quote a second per token. */
const tokens = new Map<string, { token: string; expires: number }>();

async function flowToken(user: Address, signal?: AbortSignal): Promise<string> {
  const key = user.toLowerCase();
  const cached = tokens.get(key);
  if (cached && cached.expires - 60 > Date.now() / 1000) return cached.token;
  const res = await fetch(`${KURU_FLOW_API}/api/generate-token`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_address: user }),
  });
  const body = (res.ok ? await res.json() : null) as { token?: string; expires_at?: number } | null;
  if (!body?.token) throw new FlowQuoteError(`Kuru Flow didn't open a quote session (${res.status}).`);
  tokens.set(key, { token: body.token, expires: body.expires_at ?? Date.now() / 1000 + 600 });
  return body.token;
}

/** Kuru Flow's quote for swapping `amountIn` MON on `user` for AUSD, checked before anything can be signed. */
export async function quoteMonForAusd(user: Address, amountIn: bigint, signal?: AbortSignal): Promise<FlowQuote> {
  const token = await flowToken(user, signal);
  const res = await fetch(`${KURU_FLOW_API}/api/quote`, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ userAddress: user, tokenIn: zeroAddress, tokenOut: AUSD, amount: amountIn.toString(), autoSlippage: true }),
  });
  if (res.status === 429) throw new FlowQuoteError("Kuru Flow takes one quote a second; the next one comes in a moment.");
  if (!res.ok) throw new FlowQuoteError(`Kuru Flow couldn't quote right now (${res.status}).`);
  return checkFlowQuote(await res.json(), amountIn, user);
}

/**
 * The gas limit for a quote, read before Face ID: a dry run of the swap from the owner key, plus a fifth. A quote the
 * price has already left fails here, so nothing is signed for it. Monad charges the whole limit, so the headroom is small.
 */
export async function flowSwapGas(user: Address, quote: FlowQuote): Promise<bigint> {
  const estimate = await publicClient.estimateGas({ account: user, to: quote.to, data: quote.data, value: quote.value });
  return (estimate * 6n) / 5n;
}

export function sendFlowSwap(owner: LocalAccount, quote: FlowQuote, gas: bigint): Promise<Hash> {
  return createWalletClient({ account: owner, chain, transport: http(rpcHttpUrl) }).sendTransaction({ to: quote.to, data: quote.data, value: quote.value, gas });
}

/** AUSD the swap delivered to `user`, from the receipt's Transfer logs. */
export function ausdReceived(receipt: Pick<TransactionReceipt, "logs">, user: Address): bigint {
  return parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: receipt.logs })
    .filter((l) => l.address.toLowerCase() === AUSD.toLowerCase() && l.args.to.toLowerCase() === user.toLowerCase())
    .reduce((sum, l) => sum + l.args.value, 0n);
}
