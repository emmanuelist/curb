import {
  decodeEventLog,
  encodeFunctionData,
  erc20Abi,
  zeroAddress,
  type Address,
  type Hash,
  type Hex,
  type LocalAccount,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { createWalletClient, http } from "viem";
import { chain, rpcHttpUrl } from "@/lib/chain/clients";
import { curbAccountAbi, curbFactoryAbi } from "@/lib/curb/abi";
import { kuruMarginAbi, kuruOrderBookAbi } from "@/lib/kuru/abi";
import { AUSD, CURB_FACTORY, KURU_MARGIN_ACCOUNT, MON_PERP, type Market } from "@/lib/markets/registry";
import type { Side } from "@/lib/lane";

/** Kuru's MarginAccount treats the zero address as native MON. */
export const NATIVE: Address = zeroAddress;

/** Monad's gas price as paid on mainnet (102 gwei, E-013), for showing a cost only: limits are what Monad charges. */
export const GAS_PRICE_SEEN = 102n * 10n ** 9n;

/**
 * Explicit gas limits. Monad charges the full limit, not the gas used (docs/CONTEXT.md), so each sits a little above
 * what was measured under Monad rules. Create 1,161,151, deposit 78,784, a resting placeSell 324,104-352,246 (a new
 * price level costs more), cancel 177,797, a sell taking one level 298,777: the app's own transactions on a mainnet
 * fork (E-017). An order that takes liquidity may walk several levels, so it gets the most headroom.
 */
export const GAS = {
  /** factory.create for CurbAccount v2 (Kuru and Perpl): 2,156,647 under Monad rules (E-021); v1 took 1,181,268. */
  create: 2_400_000n,
  deposit: 100_000n,
  placeResting: 450_000n,
  placeTaking: 700_000n,
  cancel: 240_000n,
  /** Owner withdrawals to an address without code: 99,010 (MON) and 180,112 (USDC) on a fork. */
  withdrawMon: 130_000n,
  withdrawToken: 230_000n,
  /** A plain MON transfer to an address without code. */
  transfer: 21_000n,
  /**
   * Proofs: transactions sent to be refused. Tight on purpose, since a revert still pays the whole limit: the off-lane
   * refusal used 172,826-172,868 and the trading key's withdrawal attempt 22,930 on a fork (2026-10-03).
   */
  proofOffLane: 220_000n,
  proofWithdraw: 40_000n,
} as const;

export type CurbAccountState = {
  address: Address;
  deployed: boolean;
  /** The trading key the account currently accepts (address(0) when revoked). Null until deployed. */
  trader: Address | null;
  margin: { mon: bigint; usdc: bigint };
  /** v2 accounts trade Perpl too; a v1 account (Kuru only) reads false. */
  perps: { supported: boolean; opened: boolean; capHdths: number | null; collateralHeld: bigint };
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
  if (!deployed) return { address, deployed, trader: null, margin: { mon, usdc }, perps: { supported: false, opened: false, capHdths: null, collateralHeld: 0n } };
  // allowFailure: a v1 account has no Perpl functions, and must still read as a working Kuru account.
  const [trader, opened, perp, collateral] = await client.multicall({
    contracts: [
      { address, abi: curbAccountAbi, functionName: "trader" },
      { address, abi: curbAccountAbi, functionName: "perplOpened" },
      { address, abi: curbAccountAbi, functionName: "perps", args: [MON_PERP.perpId ?? 0n] },
      { address: AUSD, abi: erc20Abi, functionName: "balanceOf", args: [address] },
    ],
  });
  const supported = opened.status === "success";
  return {
    address,
    deployed,
    trader: trader.status === "success" ? trader.result : null,
    margin: { mon, usdc },
    perps: {
      supported,
      opened: supported && opened.result === true,
      capHdths: perp.status === "success" && perp.result[0] ? perp.result[1] : null,
      collateralHeld: collateral.status === "success" ? collateral.result : 0n,
    },
  };
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

/** Owner key (Face ID): withdraw from the account's Kuru margin straight to `to`. */
export function sendWithdraw(owner: LocalAccount, account: Address, w: { token: Address; amount: bigint; to: Address; gas: bigint }): Promise<Hash> {
  return wallet(owner).writeContract({
    address: account,
    abi: curbAccountAbi,
    functionName: "withdraw",
    args: [w.token, w.amount, w.to],
    gas: w.gas,
  });
}

/** Owner key (Face ID): send MON from the owner key itself. */
export function sendMon(owner: LocalAccount, to: Address, amount: bigint, gas: bigint): Promise<Hash> {
  return wallet(owner).sendTransaction({ to, value: amount, gas });
}

/**
 * The gas limit for sending to `to`. An address without code takes the measured limit; one with code (a contract
 * wallet) runs its own code on receipt, so it gets the node's estimate plus a quarter.
 */
export async function gasFor(client: PublicClient, req: { from: Address; to: Address; data?: Hex; value?: bigint }, plain: bigint, target: Address): Promise<bigint> {
  const code = await client.getCode({ address: target });
  if (!code || code === "0x") return plain;
  const estimate = await client.estimateGas({ account: req.from, to: req.to, data: req.data, value: req.value });
  return (estimate * 5n) / 4n;
}

/** A proof: the trading key asks the account to withdraw to itself. CurbAccount refuses it with NotOwner. */
export function sendProofWithdraw(trader: LocalAccount, account: Address, amount: bigint): Promise<Hash> {
  return wallet(trader).writeContract({
    address: account,
    abi: curbAccountAbi,
    functionName: "withdraw",
    args: [NATIVE, amount, trader.address],
    gas: GAS.proofWithdraw,
  });
}

/**
 * A proof: the trading key sends an order past the curb. Post-only, so if the lane moved and the account let it
 * through, Kuru would still refuse to let it trade (PostOnlyError): the proof can never take liquidity.
 */
export function sendProofOffLane(trader: LocalAccount, account: Address, market: Market, order: { side: Side; price: bigint; size: bigint }): Promise<Hash> {
  return wallet(trader).writeContract({
    address: account,
    abi: curbAccountAbi,
    functionName: order.side === "buy" ? "placeBuy" : "placeSell",
    args: [market.orderBook, Number(order.price), order.size, true],
    gas: GAS.proofOffLane,
  });
}

/** Calldata for the off-lane proof and the withdrawal attempt, so they can be dry-run before they are sent. */
export const proofCalldata = {
  offLane: (market: Market, order: { side: Side; price: bigint; size: bigint }) =>
    encodeFunctionData({
      abi: curbAccountAbi,
      functionName: order.side === "buy" ? "placeBuy" : "placeSell",
      args: [market.orderBook, Number(order.price), order.size, true],
    }),
  withdraw: (amount: bigint, to: Address) => encodeFunctionData({ abi: curbAccountAbi, functionName: "withdraw", args: [NATIVE, amount, to] }),
};

/**
 * Run a call against the latest block without sending it. A proof is only sent once this shows the account will
 * refuse it, so a lane that moved can't turn a proof into a real order.
 */
export async function dryRun(client: PublicClient, from: Address, to: Address, data: Hex): Promise<{ reverted: false } | { reverted: true; data: Hex | null }> {
  try {
    // `account` keeps viem from batching this into Multicall3, which would wrap the revert data.
    await client.call({ account: from, to, data });
    return { reverted: false };
  } catch (error) {
    return { reverted: true, data: revertDataFrom(error) };
  }
}

/**
 * The revert data inside a viem error. For `call` it sits on the RPC error a few causes down (CallExecutionError →
 * ExecutionRevertedError → RpcRequestError.data, verified against anvil 2026-10-03); other paths wrap it as
 * `{ data }`. Null when there is none.
 */
export function revertDataFrom(error: unknown): Hex | null {
  let e: unknown = error;
  for (let depth = 0; depth < 10 && e; depth++) {
    const value = (e as { data?: unknown }).data;
    if (typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value)) return value as Hex;
    const nested = value && typeof value === "object" ? (value as { data?: unknown }).data : undefined;
    if (typeof nested === "string" && /^0x[0-9a-fA-F]*$/.test(nested)) return nested as Hex;
    e = (e as { cause?: unknown }).cause;
  }
  return null;
}

/** Monad keeps 10 MON in every EOA: a value transfer may leave less only if the sender sent nothing in the last 3 blocks. */
export const RESERVE = 10n * 10n ** 18n;
const RESERVE_QUIET_BLOCKS = 3n;

/**
 * Wait until `address` has sent nothing for the last 3 blocks (~1.2 s), so a transfer that leaves it under the 10 MON
 * reserve counts as an emptying transaction instead of reverting (docs/CONTEXT.md). False if it stays busy past `timeoutMs`.
 */
export async function waitForQuiet(client: PublicClient, address: Address, timeoutMs = 8_000): Promise<boolean> {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const latest = await client.getBlockNumber({ cacheTime: 0 });
    const [now, before] = await Promise.all([
      client.getTransactionCount({ address, blockNumber: latest }),
      client.getTransactionCount({ address, blockNumber: latest - RESERVE_QUIET_BLOCKS }),
    ]);
    if (now === before) return true;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return false;
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
