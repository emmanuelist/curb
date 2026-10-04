import {
  createWalletClient,
  decodeFunctionData,
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  http,
  parseAbi,
  parseEventLogs,
  zeroAddress,
  type Address,
  type Hash,
  type Hex,
  type LocalAccount,
  type TransactionReceipt,
} from "viem";
import { chain, publicClient, rpcHttpUrl } from "@/lib/chain/clients";
import { AUSD } from "@/lib/markets/registry";

/**
 * Kuru Flow, Kuru's swap aggregator (docs.monad.xyz/guides/kuru-flow). It finds the best route across Monad's venues
 * (Kuru's books, Uniswap and others) and returns a transaction for its router. Curb uses it for one thing: turning MON
 * on the owner key into AUSD for futures margin (#56, D-026). Kuru Flow picks the route; Monad prices it. The route is
 * simulated from the owner key, and the swap's minimum is set from what it pays (D-027).
 */
export const KURU_FLOW_API = "https://ws.kuru.io";

/** KuruFlowEntrypoint on Monad mainnet: Sourcify match, not a proxy (verified 2026-10-04). Curb signs for nothing else. */
export const KURU_FLOW_ROUTER: Address = "0xb3e6778480b2E488385E8205eA05E20060B813cb";

/** The most fee a quote may carry (Kuru's plus a referrer's), in basis points. Quotes on 2026-10-04 carried none. */
export const MAX_FLOW_FEE_BPS = 50n;

/** How far under the route's simulated payout the swap's minimum sits: room for the price to move before the block. */
export const FLOW_FLOOR_BPS = 50n;

/** The router's two swap entrypoints, from its verified source (src/entrypoint/KuruFlowEntrypoint.sol). */
export const kuruFlowAbi = parseAbi([
  "struct SwapIntent { address tokenUserBuys; uint256 minAmountUserBuys; address tokenUserSells; uint256 amountUserSells; }",
  "struct FeeCollection { address feeCollectorAddress; uint256 feeBps; address referrerAddress; uint256 referrerFeeBps; bool isInTokenFee; }",
  "function executeSwap(SwapIntent swapIntent, FeeCollection feeCollection, bytes program) payable returns (uint256 amountOut)",
  "function executeSwapWithReceiver(SwapIntent swapIntent, FeeCollection feeCollection, bytes program, address receiver) payable returns (uint256 amountOut)",
]);

export type FlowQuote = {
  /** AUSD the route pays now (6 decimals): Kuru Flow's estimate until `priceOnchain` replaces it with a simulation. */
  out: bigint;
  /** The least AUSD the router will accept, written into the transaction: the swap reverts below it. */
  minOut: bigint;
  /** Kuru Flow's own estimate, kept for comparison. */
  estimate: bigint;
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
 * exactly `amountIn` of MON for AUSD to the owner key itself, and pay at most MAX_FLOW_FEE_BPS. The calldata is decoded
 * and checked; the API's own fields aren't trusted alone. Its minimum is replaced later, from the chain (`priceOnchain`).
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
  const feeBps = fee.feeBps + fee.referrerFeeBps;
  if (feeBps > MAX_FLOW_FEE_BPS) throw refuse(`it carries a ${Number(feeBps) / 100}% fee`);
  const estimate = BigInt(q.output ?? "0");
  return { out: estimate, minOut: intent.minAmountUserBuys, estimate, feeBps, to: KURU_FLOW_ROUTER, data, value: amountIn };
}

/** The same swap with its onchain minimum replaced; the route and everything else stay as Kuru Flow wrote them. */
export function withMinimum(data: Hex, minOut: bigint): Hex {
  const call = decodeFunctionData({ abi: kuruFlowAbi, data });
  if (call.functionName === "executeSwap") {
    const [intent, fee, program] = call.args;
    return encodeFunctionData({ abi: kuruFlowAbi, functionName: "executeSwap", args: [{ ...intent, minAmountUserBuys: minOut }, fee, program] });
  }
  const [intent, fee, program, receiver] = call.args;
  return encodeFunctionData({ abi: kuruFlowAbi, functionName: "executeSwapWithReceiver", args: [{ ...intent, minAmountUserBuys: minOut }, fee, program, receiver] });
}

/**
 * The quote priced by Monad rather than by Kuru's API. On 2026-10-04 Kuru Flow's estimates ran about 1% above what its
 * route paid onchain, above even the minimum Kuru wrote in, so every swap reverted (`InsufficientAmountAfterFees`).
 * The route is simulated from the owner key with no minimum; what it pays becomes `out`, and the minimum is set
 * FLOW_FLOOR_BPS under that.
 */
export async function priceOnchain(q: FlowQuote, user: Address): Promise<FlowQuote> {
  let out: bigint;
  try {
    const { data } = await publicClient.call({ account: user, to: q.to, data: withMinimum(q.data, 1n), value: q.value });
    const call = decodeFunctionData({ abi: kuruFlowAbi, data: q.data });
    out = data ? decodeFunctionResult({ abi: kuruFlowAbi, functionName: call.functionName, data }) : 0n;
  } catch {
    throw new FlowQuoteError("Kuru Flow's route doesn't run on Monad right now, so nothing was signed. A new quote is on its way.");
  }
  if (out === 0n) throw new FlowQuoteError("Kuru Flow's route pays nothing on Monad right now, so nothing was signed.");
  const minOut = (out * (10_000n - FLOW_FLOOR_BPS)) / 10_000n;
  return { ...q, out, minOut, data: withMinimum(q.data, minOut) };
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

/** Kuru Flow's route for swapping `amountIn` MON on `user` for AUSD: checked, then priced on Monad. */
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
  return priceOnchain(checkFlowQuote(await res.json(), amountIn, user), user);
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
