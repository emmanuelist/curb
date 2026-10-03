import { decodeEventLog, type Address, type Hash } from "viem";
import type { LedgerEntry } from "@/lib/curb/ledger";
import { PERP_ORDER_TYPE } from "@/lib/curb/perp";
import type { Market } from "@/lib/markets/registry";
import { perplExchangeAbi } from "@/lib/perpl/abi";

export type PerpOrderEntry = Extract<LedgerEntry, { kind: "perp-order" }>;
export type PerpFillEntry = Extract<LedgerEntry, { kind: "perp-fill" }>;
type PerpCancelEntry = Extract<LedgerEntry, { kind: "perp-cancel" }>;

/** A Perpl order this device placed, with the cancel and the fills that belong to it. */
export type PerpOrderRecord = {
  entry: PerpOrderEntry;
  cancel: PerpCancelEntry | null;
  /** Fills of its resting part that Curb saw while it was open. */
  fills: PerpFillEntry[];
  /** A later order of this account was given the same Perpl order id, so this one had left the book by then. */
  superseded: boolean;
};

/**
 * Each Perpl order this device placed, paired with its cancel and fills. Perpl reuses order ids: its book holds
 * 2^16−1 orders and hands a freed id straight out again (perpl-sdk 0.2.9, state/order.rs). So a cancel or a fill
 * belongs to the latest earlier order with that id, never to every order that once held it.
 */
export function perpOrderRecords(entries: readonly LedgerEntry[], marketId?: string): PerpOrderRecord[] {
  const records: PerpOrderRecord[] = [];
  const latest = new Map<string, PerpOrderRecord>();
  for (const e of entries) {
    if (e.kind === "perp-order") {
      const record: PerpOrderRecord = { entry: e, cancel: null, fills: [], superseded: false };
      if (marketId === undefined || e.market === marketId) records.push(record);
      if (e.orderId === null) continue;
      const key = `${e.market}:${e.orderId}`;
      const previous = latest.get(key);
      if (previous) previous.superseded = true;
      latest.set(key, record);
    } else if (e.kind === "perp-cancel" || e.kind === "perp-fill") {
      const record = latest.get(`${e.market}:${e.orderId}`);
      if (!record) continue;
      if (e.kind === "perp-fill") record.fills.push(e);
      else record.cancel ??= e;
    }
  }
  return records;
}

/** Lots Curb saw trade: on arrival, plus fills of the resting part. */
export const perpFilled = (r: PerpOrderRecord) => BigInt(r.entry.filled) + r.fills.reduce((sum, f) => sum + BigInt(f.lots), 0n);

/** Orders only Perpl's book can settle: they rested when placed, and nothing Curb saw since says they left. */
export const restingCandidates = (records: readonly PerpOrderRecord[]) =>
  records.filter((r) => r.entry.orderId !== null && !r.cancel && !r.superseded && perpFilled(r) < BigInt(r.entry.lots));

/** The fields of Perpl's `getOrderV2` that say whose order an id holds now. */
export type PerpBookOrder = { accountId: number | bigint; orderType: number; priceONS: number | bigint; lotLNS: number | bigint };

/**
 * Lots still resting for this entry, or 0 when its id now holds something else. An id goes to another order (another
 * account's, or a newer one of ours) as soon as this one leaves, so account, side and price must all still match.
 * Perpl stores a price as its offset from the perpetual's base price.
 */
export function lotsResting(entry: PerpOrderEntry, onBook: PerpBookOrder | null, perplAccountId: bigint, basePricePNS: bigint): bigint {
  if (!onBook) return 0n;
  const lots = BigInt(onBook.lotLNS);
  const same =
    BigInt(onBook.accountId) === perplAccountId &&
    onBook.orderType === PERP_ORDER_TYPE[entry.action] &&
    BigInt(onBook.priceONS) + basePricePNS === BigInt(entry.price);
  return same && lots > 0n && lots <= BigInt(entry.lots) ? lots : 0n;
}

/**
 * open: resting on Perpl now. cancelling: a cancel from this tab is in flight. filled: the fills Curb saw cover it.
 * cancelled: cancelled from this device. closed: gone from the book with no cancel from here and fills not seen (a fill
 * clears an order the same way a cancel does). unfilled: an immediate order that found nothing to trade. unknown: not read yet.
 */
export type PerpOrderStatus = "open" | "cancelling" | "filled" | "cancelled" | "closed" | "unfilled" | "unknown";

/** `resting`: lots on the book now (from `lotsResting`), or undefined before the book was read. */
export function perpOrderStatus(r: PerpOrderRecord, resting: bigint | undefined, cancelInFlight: boolean): PerpOrderStatus {
  const filled = perpFilled(r);
  const lots = BigInt(r.entry.lots);
  if (r.entry.orderId === null) return filled > 0n ? "filled" : "unfilled";
  if (r.cancel) return "cancelled";
  if (cancelInFlight) return "cancelling";
  if (filled >= lots) return "filled";
  if (r.superseded) return "closed";
  if (resting === undefined) return "unknown";
  return resting > 0n ? "open" : "closed";
}

/** The key a Perpl cancel in flight is held under, apart from Kuru's ids (both venues number orders from 1). */
export const perpCancelKey = (marketId: string, orderId: string) => `perp:${marketId}:${orderId}`;

export type PerpMakerFill = { hash: Hash; block: bigint; orderId: bigint; lots: bigint };

/**
 * Fills of this Perpl account's resting orders, as maker, in a batch of the exchange's logs. Perpl's events carry no
 * indexed fields, so they are read for the whole exchange and matched on perpetual, account and order id here.
 */
export function perpMakerFillsFromLogs(
  logs: readonly { address: Address; data: `0x${string}`; topics: readonly `0x${string}`[]; transactionHash: Hash | null; blockNumber: bigint | null }[],
  market: Market,
  perplAccountId: bigint,
  orderIds: ReadonlySet<string>,
): PerpMakerFill[] {
  const fills: PerpMakerFill[] = [];
  for (const log of logs) {
    if (log.address.toLowerCase() !== market.orderBook.toLowerCase() || !log.transactionHash || log.blockNumber === null) continue;
    try {
      const ev = decodeEventLog({ abi: perplExchangeAbi, data: log.data, topics: log.topics as [`0x${string}`, ...`0x${string}`[]] });
      if (ev.eventName !== "MakerOrderFilled" && ev.eventName !== "MakerOrderFilledV2") continue;
      const { perpId, accountId, orderId, lotLNS } = ev.args;
      if (perpId !== market.perpId || accountId !== perplAccountId || !orderIds.has(orderId.toString())) continue;
      fills.push({ hash: log.transactionHash, block: log.blockNumber, orderId, lots: lotLNS });
    } catch {
      // Not one of the events we decode.
    }
  }
  return fills;
}
