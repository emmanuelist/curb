import { createWalletClient, decodeEventLog, erc20Abi, http, type Address, type Hash, type LocalAccount, type TransactionReceipt } from "viem";
import { chain, publicClient, rpcHttpUrl } from "@/lib/chain/clients";
import { encodeFunctionData } from "viem";
import { curbAccountAbi } from "@/lib/curb/abi";
import { AUSD, type Market } from "@/lib/markets/registry";
import { perplExchangeAbi } from "@/lib/perpl/abi";

/** What the trading key can do on a perpetual. Perpl's order types: 0 OpenLong, 1 OpenShort, 2 CloseLong, 3 CloseShort. */
export type PerpAction = "open-long" | "open-short" | "close-long" | "close-short";

export const PERP_ORDER_TYPE: Record<PerpAction, number> = { "open-long": 0, "open-short": 1, "close-long": 2, "close-short": 3 };

/** Bids are OpenLong and CloseShort; asks are OpenShort and CloseLong (the lane checks bids against maxBuy). */
export const perpSide = (action: PerpAction) => (action === "open-long" || action === "close-short" ? "buy" : "sell");

/**
 * How History names a Perpl order (#77). An open goes by its size. A close goes by what it traded on arrival, so one
 * that walked a thin book and took 79 of 300 doesn't read as a full close, and one that hasn't traded isn't "Closed".
 */
export function perpOrderHeading(action: PerpAction, lots: bigint, filled: bigint, size: (n: bigint) => string): string {
  const side = action.endsWith("long") ? "long" : "short";
  if (action.startsWith("open")) return `${side === "long" ? "Long" : "Short"} ${size(lots)}`;
  if (filled === 0n) return `Close ${side} ${size(lots)}`;
  return filled < lots ? `Closed ${side} ${size(filled)} of ${size(lots)}` : `Closed ${side} ${size(lots)}`;
}

/**
 * Explicit gas limits for CurbAccount v2's Perpl paths. Monad charges the full limit, so each sits a little above
 * what the app's own transactions used under Monad rules on a mainnet fork (#51, E-022): create 2,140,933;
 * perplDeposit opening the Perpl account 250,099; a resting perplOrder 280,808; a taking one 339,217 (one level; each
 * further level walked costs more, so it gets the most headroom) and a taking close 263,964; perplCancel 190,871;
 * perplWithdraw 193,229; the AUSD transfer 72,061; the cap proof 40,245; the off-lane proof 85,144.
 */
export const PERP_GAS = {
  create: 2_400_000n,
  // AUSD transfer into an empty balance: 72,061 on the fork run of #51.
  ausdTransfer: 100_000n,
  deposit: 300_000n,
  orderResting: 360_000n,
  orderTaking: 450_000n,
  cancel: 250_000n,
  withdraw: 260_000n,
  setPerp: 80_000n,
  /**
   * Proofs, sent to be refused (tight on purpose: a revert pays the whole limit). The cap is checked before the lane,
   * so an over-cap order reverts before reading Perpl; an off-lane one reads Perpl's book first.
   */
  proofCap: 55_000n,
  proofOffLane: 110_000n,
} as const;

const wallet = (account: LocalAccount) => createWalletClient({ account, chain, transport: http(rpcHttpUrl) });

export type PerpOrder = {
  action: PerpAction;
  /** Price in PNS (USD × 10^priceDecimals). */
  price: bigint;
  /** Size in lots (LNS). */
  lots: bigint;
  /** Leverage in hundredths (500 = 5x). */
  leverageHdths: bigint;
  /** Rest only; never take. Taking orders go immediate-or-cancel instead. */
  postOnly: boolean;
};

/** The OrderDesc CurbAccount.perplOrder takes. orderDescId only needs to be fresh per order; the block-free clock is. */
export function perpOrderDesc(market: Market, o: PerpOrder) {
  if (market.perpId === undefined) throw new Error(`${market.id} is not a Perpl market`);
  return {
    orderDescId: BigInt(Date.now()),
    perpId: market.perpId,
    orderType: PERP_ORDER_TYPE[o.action],
    orderId: 0n,
    pricePNS: o.price,
    lotLNS: o.lots,
    expiryBlock: 0n,
    postOnly: o.postOnly,
    fillOrKill: false,
    immediateOrCancel: !o.postOnly,
    maxMatches: 0n,
    leverageHdths: o.leverageHdths,
    lastExecutionBlock: 0n,
    amountCNS: 0n,
    maxNegPnlCollatBPS: 1000n,
  } as const;
}

/** Trading key (no prompt): open or close on Perpl through the account; it checks the lane and the cap onchain. */
export function sendPerpOrder(trader: LocalAccount, account: Address, market: Market, o: PerpOrder, gas?: bigint): Promise<Hash> {
  return wallet(trader).writeContract({
    address: account,
    abi: curbAccountAbi,
    functionName: "perplOrder",
    args: [perpOrderDesc(market, o)],
    gas: gas ?? (o.postOnly ? PERP_GAS.orderResting : PERP_GAS.orderTaking),
  });
}

/** Trading key (no prompt) or owner key: cancel one of the account's Perpl orders. */
export function sendPerpCancel(signer: LocalAccount, account: Address, market: Market, orderId: bigint): Promise<Hash> {
  if (market.perpId === undefined) throw new Error(`${market.id} is not a Perpl market`);
  return wallet(signer).writeContract({
    address: account,
    abi: curbAccountAbi,
    functionName: "perplCancel",
    args: [market.perpId, orderId],
    gas: PERP_GAS.cancel,
  });
}

/** Owner key (Face ID): send AUSD from the owner key to the account, the first half of a deposit. */
export function sendAusdToAccount(owner: LocalAccount, account: Address, amount: bigint): Promise<Hash> {
  return wallet(owner).writeContract({ address: AUSD, abi: erc20Abi, functionName: "transfer", args: [account, amount], gas: PERP_GAS.ausdTransfer });
}

/** Owner key (Face ID): move the account's AUSD into its Perpl account (opening it the first time). */
export function sendPerplDeposit(owner: LocalAccount, account: Address, amount: bigint): Promise<Hash> {
  return wallet(owner).writeContract({ address: account, abi: curbAccountAbi, functionName: "perplDeposit", args: [amount], gas: PERP_GAS.deposit });
}

/** Owner key (Face ID): withdraw AUSD from the account's Perpl account straight to `to`. */
export function sendPerplWithdraw(owner: LocalAccount, account: Address, amount: bigint, to: Address): Promise<Hash> {
  return wallet(owner).writeContract({ address: account, abi: curbAccountAbi, functionName: "perplWithdraw", args: [amount, to], gas: PERP_GAS.withdraw });
}

/** Owner key (Face ID): set the trading key's leverage cap on a perpetual (hundredths). */
export function sendSetPerp(owner: LocalAccount, account: Address, market: Market, maxLeverageHdths: number): Promise<Hash> {
  if (market.perpId === undefined) throw new Error(`${market.id} is not a Perpl market`);
  return wallet(owner).writeContract({
    address: account,
    abi: curbAccountAbi,
    functionName: "setPerp",
    args: [market.perpId, true, maxLeverageHdths],
    gas: PERP_GAS.setPerp,
  });
}

export type PerpFill = {
  /** The id Perpl gave the resting remainder, or null when nothing rested. */
  orderId: bigint | null;
  /** Lots that traded on arrival. */
  filled: bigint;
  /** The account's position after the transaction ended flat. */
  closed: boolean;
  /**
   * What the lots that traded cost on average (PNS): every maker fill in the receipt, weighted by size. Null when
   * nothing traded. A taking order is limited by its price but filled at each resting order's own price.
   */
  avgPrice: bigint | null;
};

/**
 * What a perplOrder transaction did on Perpl, from its receipt. Perpl's events don't index the account, but a
 * perplOrder transaction sends exactly one order, so its OrderPlaced (the resting remainder) and its one
 * TakerOrderFilled (Perpl batches every maker fill under one taker event, perpl-sdk stream/trade.rs) are ours.
 * Position events in the same receipt can belong to the makers on the other side, so only PositionClosed for our
 * Perpl account id is read, to tell a close that left the account flat.
 */
export function perpOrderFromReceipt(receipt: Pick<TransactionReceipt, "logs">, market: Market, perplAccountId: bigint | null): PerpFill {
  let orderId: bigint | null = null;
  let filled = 0n;
  let closed = false;
  let makerLots = 0n;
  let makerValue = 0n;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== market.orderBook.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: perplExchangeAbi, data: log.data, topics: log.topics });
      switch (ev.eventName) {
        case "OrderPlaced":
          orderId = ev.args.orderId;
          break;
        case "TakerOrderFilled":
        case "TakerOrderFilledV2":
          filled += ev.args.lotLNS;
          break;
        case "MakerOrderFilled":
        case "MakerOrderFilledV2":
          makerLots += ev.args.lotLNS;
          makerValue += ev.args.pricePNS * ev.args.lotLNS;
          break;
        case "PositionClosed":
          if (perplAccountId !== null && ev.args.accountId === perplAccountId) closed = true;
          break;
      }
    } catch {
      // Not one of the events we decode.
    }
  }
  return { orderId, filled, closed, avgPrice: makerLots > 0n ? makerValue / makerLots : null };
}

/** How far inside the far curb a one-tap close is priced, as a share of the touch: 10 bps (D-033). */
export const CLOSE_HEADROOM_BPS = 10n;

/**
 * Where a one-tap close is priced: just inside the lane's far curb (min sell to close a long, max buy to close a short).
 * It is the worst the close may get, not what it pays: Perpl fills at each resting order's price, so the close walks
 * levels inside the lane when the top one is thinner than the position (#59). Priced at the curb itself, a close was
 * refused on mainnet when the bid rose 6 ticks before it landed (0.033334 against a curb of 0.033340), so it keeps
 * 0.10% of the touch in hand, and never goes past the touch itself. Perpl's MON tick is one price unit.
 */
export function closePrice(type: "long" | "short", lane: { bid: bigint; ask: bigint; minSell: bigint; maxBuy: bigint }): bigint {
  if (type === "long") {
    const price = lane.minSell + (lane.bid * CLOSE_HEADROOM_BPS + 9_999n) / 10_000n;
    return price < lane.bid ? price : lane.bid;
  }
  const price = lane.maxBuy - (lane.ask * CLOSE_HEADROOM_BPS) / 10_000n;
  return price > lane.ask ? price : lane.ask;
}

/**
 * The gas limit for a taking order, read before it is sent: a dry run from the trading key, plus a fifth. Walking more
 * levels costs more, and Monad charges the whole limit, so a measured limit beats a fixed one. If the dry run fails, the
 * fixed limit stands and the chain's answer is shown.
 */
export async function takingGas(trader: Address, account: Address, market: Market, o: PerpOrder): Promise<bigint> {
  try {
    const estimate = await publicClient.estimateGas({ account: trader, to: account, data: perpOrderCalldata(market, o) });
    return (estimate * 6n) / 5n;
  } catch {
    return PERP_GAS.orderTaking;
  }
}

/** Calldata for a perplOrder, so a proof can be dry-run before it is sent. */
export const perpOrderCalldata = (market: Market, o: PerpOrder) =>
  encodeFunctionData({ abi: curbAccountAbi, functionName: "perplOrder", args: [perpOrderDesc(market, o)] });
