import type { TopOfBook } from "@/lib/kuru/book";

/**
 * The lane: the prices the trading key may trade at, derived from Kuru's live best bid/ask.
 * This is the single source for every lane the UI draws. CurbAccount (M2) mirrors the same rule onchain.
 */
export type Lane =
  | {
      status: "open";
      bid: bigint;
      ask: bigint;
      /** Midpoint in price units (may fall between ticks). */
      mid: bigint;
      /** Spread in basis points of the mid, to two decimals. */
      spreadBps: number;
      /** Highest price a buy may carry: best ask + band, floored to a tick. */
      maxBuy: bigint;
      /** Lowest price a sell may carry: best bid − band, ceiled to a tick. */
      minSell: bigint;
      bandBps: bigint;
    }
  | { status: "no-market"; reason: "no-bids" | "no-asks" | "crossed" };

export type Side = "buy" | "sell";

export type Placement =
  | { kind: "in-lane" }
  | { kind: "off-book"; limit: bigint }
  | { kind: "invalid"; reason: "no-market" | "not-on-tick" | "not-positive" };

const BPS = 10_000n;

const floorToTick = (value: bigint, tick: bigint) => (value / tick) * tick;
const ceilToTick = (value: bigint, tick: bigint) => ((value + tick - 1n) / tick) * tick;

export function computeLane(top: TopOfBook, opts: { bandBps: bigint; tickSize: bigint }): Lane {
  const { bid, ask } = top;
  if (bid === null) return { status: "no-market", reason: "no-bids" };
  if (ask === null) return { status: "no-market", reason: "no-asks" };
  if (bid >= ask) return { status: "no-market", reason: "crossed" };

  const mid = (bid + ask) / 2n;
  const spreadBps = Number(((ask - bid) * 1_000_000n) / mid) / 100;
  return {
    status: "open",
    bid,
    ask,
    mid,
    spreadBps,
    maxBuy: floorToTick((ask * (BPS + opts.bandBps)) / BPS, opts.tickSize),
    minSell: ceilToTick((bid * (BPS - opts.bandBps)) / BPS, opts.tickSize),
    bandBps: opts.bandBps,
  };
}

/** Where an order at `price` sits relative to the lane. Checked before anything is sent. */
export function placeOrder(lane: Lane, side: Side, price: bigint, tickSize: bigint): Placement {
  if (lane.status !== "open") return { kind: "invalid", reason: "no-market" };
  if (price <= 0n) return { kind: "invalid", reason: "not-positive" };
  if (price % tickSize !== 0n) return { kind: "invalid", reason: "not-on-tick" };
  if (side === "buy") return price <= lane.maxBuy ? { kind: "in-lane" } : { kind: "off-book", limit: lane.maxBuy };
  return price >= lane.minSell ? { kind: "in-lane" } : { kind: "off-book", limit: lane.minSell };
}
