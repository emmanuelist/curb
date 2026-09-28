import { decodeEventLog, zeroAddress, type Address, type Hash, type LocalAccount, type PublicClient, type TransactionReceipt } from "viem";
import { createWalletClient, http } from "viem";
import { chain, rpcHttpUrl } from "@/lib/chain/clients";
import { curbAccountAbi, curbFactoryAbi } from "@/lib/curb/abi";
import { kuruMarginAbi, kuruOrderBookAbi } from "@/lib/kuru/abi";
import { CURB_FACTORY, KURU_MARGIN_ACCOUNT, type Market } from "@/lib/markets/registry";
import type { Side } from "@/lib/lane";

/** Kuru's MarginAccount treats the zero address as native MON. */
export const NATIVE: Address = zeroAddress;

/**
 * Explicit gas limits. Monad charges the full limit, not the gas used (docs/CONTEXT.md), so each sits a little above
 * what was measured under Monad rules. Create 1,161,151, deposit 78,784, a resting placeSell 324,104-352,246 (a new
 * price level costs more), cancel 177,797, a sell taking one level 298,777: the app's own transactions on a mainnet
 * fork (E-017). An order that takes liquidity may walk several levels, so it gets the most headroom.
 */
export const GAS = {
  create: 1_300_000n,
  deposit: 100_000n,
  placeResting: 450_000n,
  placeTaking: 700_000n,
  cancel: 240_000n,
} as const;

export type CurbAccountState = {
  address: Address;
  deployed: boolean;
  /** The trading key the account currently accepts (address(0) when revoked). Null until deployed. */
  trader: Address | null;
  margin: { mon: bigint; usdc: bigint };
};

/** Where the account lives (CREATE2, recomputable from the passkey's two keys) and what it holds on Kuru. */
export async function readCurbAccount(
  client: PublicClient,
  keys: { owner: Address; trading: Address },
  market: Market,
): Promise<CurbAccountState> {
  const address = await client.readContract({
    address: CURB_FACTORY,
    abi: curbFactoryAbi,
    functionName: "accountOf",
    args: [keys.owner, keys.trading],
  });
  const [code, mon, usdc] = await Promise.all([
    client.getCode({ address }),
    client.readContract({ address: KURU_MARGIN_ACCOUNT, abi: kuruMarginAbi, functionName: "getBalance", args: [address, NATIVE] }),
    client.readContract({
      address: KURU_MARGIN_ACCOUNT,
      abi: kuruMarginAbi,
      functionName: "getBalance",
      args: [address, market.quote.address],
    }),
  ]);
  const deployed = Boolean(code && code !== "0x");
  const trader = deployed ? await client.readContract({ address, abi: curbAccountAbi, functionName: "trader" }) : null;
  return { address, deployed, trader, margin: { mon, usdc } };
}

const wallet = (account: LocalAccount) => createWalletClient({ account, chain, transport: http(rpcHttpUrl) });

/** Owner key (Face ID): create this owner's account through the factory. */
export function sendCreateAccount(owner: LocalAccount, trading: Address): Promise<Hash> {
  return wallet(owner).writeContract({
    address: CURB_FACTORY,
    abi: curbFactoryAbi,
    functionName: "create",
    args: [trading],
    gas: GAS.create,
  });
}

/** Owner key (Face ID): credit the account's Kuru margin with native MON. */
export function sendDepositMon(owner: LocalAccount, account: Address, amount: bigint): Promise<Hash> {
  return wallet(owner).writeContract({
    address: KURU_MARGIN_ACCOUNT,
    abi: kuruMarginAbi,
    functionName: "deposit",
    args: [account, NATIVE, amount],
    value: amount,
    gas: GAS.deposit,
  });
}

/**
 * Whether an order at `price` would take liquidity (cross the book) rather than rest. A resting order is sent
 * post-only, so it can never take by surprise if the book moves; a taking order gets the larger gas limit.
 */
export function crosses(side: Side, price: bigint, top: { bid: bigint; ask: bigint }): boolean {
  return side === "buy" ? price >= top.ask : price <= top.bid;
}

/** Trading key (no prompt): place a limit order through the account. The contract checks the lane onchain. */
export function sendPlaceOrder(
  trader: LocalAccount,
  account: Address,
  market: Market,
  order: { side: Side; price: bigint; size: bigint; takes: boolean },
): Promise<Hash> {
  return wallet(trader).writeContract({
    address: account,
    abi: curbAccountAbi,
    functionName: order.side === "buy" ? "placeBuy" : "placeSell",
    args: [market.orderBook, Number(order.price), order.size, !order.takes],
    gas: order.takes ? GAS.placeTaking : GAS.placeResting,
  });
}

/** Trading key (no prompt) or owner key: cancel this account's orders. */
export function sendCancel(signer: LocalAccount, account: Address, market: Market, orderIds: readonly bigint[]): Promise<Hash> {
  return wallet(signer).writeContract({
    address: account,
    abi: curbAccountAbi,
    functionName: "cancel",
    args: [market.orderBook, orderIds.map(Number)],
    gas: GAS.cancel,
  });
}

export type PlacedOrder = { orderId: bigint; price: bigint; size: bigint; isBuy: boolean };

/** The order a placement left resting on Kuru, read from its receipt (Kuru's events carry no indexed fields). */
export function restingOrderFromReceipt(receipt: Pick<TransactionReceipt, "logs">, market: Market, owner: Address): PlacedOrder | null {
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== market.orderBook.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: kuruOrderBookAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "OrderCreated" && ev.args.owner.toLowerCase() === owner.toLowerCase()) {
        return { orderId: BigInt(ev.args.orderId), price: BigInt(ev.args.price), size: ev.args.size, isBuy: ev.args.isBuy };
      }
    } catch {
      // Not one of the events we decode.
    }
  }
  return null;
}

/** Size filled against this account in a transaction it sent (its taker fills), from the receipt. */
export function takerFillFromReceipt(receipt: Pick<TransactionReceipt, "logs">, market: Market, account: Address): bigint {
  let filled = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== market.orderBook.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: kuruOrderBookAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "Trade" && ev.args.takerAddress.toLowerCase() === account.toLowerCase()) filled += ev.args.filledSize;
    } catch {
      // Not one of the events we decode.
    }
  }
  return filled;
}

/**
 * An order's state on Kuru now. A cancel clears the order's slot; a fill either clears it too (most fills on mainnet)
 * or leaves the owner with size 0 (a limit order crossing it). So "filled" is certain; "gone" is a fill or a cancel.
 */
export type OrderOnBook = { state: "resting" | "filled" | "gone"; size: bigint };

export async function readOrder(client: PublicClient, market: Market, orderId: bigint, owner: Address): Promise<OrderOnBook> {
  const [ownerAddress, size] = await client.readContract({
    address: market.orderBook,
    abi: kuruOrderBookAbi,
    functionName: "s_orders",
    args: [Number(orderId)],
  });
  if (ownerAddress.toLowerCase() !== owner.toLowerCase()) return { state: "gone", size: 0n };
  return size > 0n ? { state: "resting", size } : { state: "filled", size: 0n };
}

/** The order ids a cancel actually removed, read from its receipt (Kuru skips ids that already left the book). */
export function cancelledIdsFromReceipt(receipt: Pick<TransactionReceipt, "logs">, market: Market, owner: Address): bigint[] {
  const ids: bigint[] = [];
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== market.orderBook.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: kuruOrderBookAbi, data: log.data, topics: log.topics });
      if (ev.eventName === "OrdersCanceled" && ev.args.owner.toLowerCase() === owner.toLowerCase()) ids.push(...ev.args.orderId.map(BigInt));
    } catch {
      // Not one of the events we decode.
    }
  }
  return ids;
}

export type MakerFill = { hash: Hash; block: bigint; orderId: bigint; size: bigint };

/** Fills of `account`'s resting orders (it is the maker) among Kuru logs, keeping only the ids asked about. */
export function makerFillsFromLogs(
  logs: readonly { address: Address; data: `0x${string}`; topics: readonly `0x${string}`[]; transactionHash: Hash | null; blockNumber: bigint | null }[],
  market: Market,
  account: Address,
  orderIds: ReadonlySet<string>,
): MakerFill[] {
  const fills: MakerFill[] = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== market.orderBook.toLowerCase() || !log.transactionHash || log.blockNumber === null) continue;
    try {
      const ev = decodeEventLog({ abi: kuruOrderBookAbi, data: log.data, topics: log.topics as [`0x${string}`, ...`0x${string}`[]] });
      if (ev.eventName !== "Trade" || ev.args.makerAddress.toLowerCase() !== account.toLowerCase()) continue;
      const orderId = BigInt(ev.args.orderId);
      if (orderIds.has(orderId.toString())) fills.push({ hash: log.transactionHash, block: log.blockNumber, orderId, size: ev.args.filledSize });
    } catch {
      // Not one of the events we decode.
    }
  }
  return fills;
}

/** The public Monad RPC serves eth_getLogs over at most 100 blocks (verified 2026-09-28, docs/CONTEXT.md). */
export const LOG_RANGE = 100n;
