import { describe, expect, it } from "vitest";
import { MAX_UINT256, toTopOfBook } from "@/lib/kuru/book";
import { computeLane, placeOrder } from "@/lib/lane";
import { LANE_BAND_BPS, MON_USDC } from "@/lib/markets/registry";

const opts = { bandBps: LANE_BAND_BPS, tickSize: MON_USDC.tickSize };

// Real top of book seen on MON-USDC at block 108,268,618: 0.026313 / 0.026341.
const bid = 2_631_300n;
const ask = 2_634_100n;

describe("computeLane", () => {
  it("bands the live book by 0.50% and snaps to ticks", () => {
    const lane = computeLane({ bid, ask }, opts);
    expect(lane.status).toBe("open");
    if (lane.status !== "open") return;
    // 0.026341 × 1.005 = 0.026472705 → floored to 0.026472
    expect(lane.maxBuy).toBe(2_647_200n);
    // 0.026313 × 0.995 = 0.026181435 → ceiled to 0.026182
    expect(lane.minSell).toBe(2_618_200n);
    expect(lane.mid).toBe(2_632_700n);
    expect(lane.spreadBps).toBeCloseTo(10.63, 2);
  });

  it("refuses to draw a lane from an empty or crossed book", () => {
    expect(computeLane({ bid: null, ask }, opts)).toEqual({ status: "no-market", reason: "no-bids" });
    expect(computeLane({ bid, ask: null }, opts)).toEqual({ status: "no-market", reason: "no-asks" });
    expect(computeLane({ bid: ask, ask: bid }, opts)).toEqual({ status: "no-market", reason: "crossed" });
  });
});

describe("toTopOfBook", () => {
  it("converts 1e18-scaled prices to order-price units (verified in E-001)", () => {
    expect(toTopOfBook(26_701_000_000_000_000n, 26_711_000_000_000_000n, MON_USDC.pricePrecision)).toEqual({
      bid: 2_670_100n,
      ask: 2_671_100n,
    });
  });

  it("maps the empty-book sentinels seen onchain to null", () => {
    // MON-AUSD on mainnet returned (2^256-1, 0) with an empty book.
    expect(toTopOfBook(MAX_UINT256, 0n, MON_USDC.pricePrecision)).toEqual({ bid: null, ask: null });
  });
});

describe("placeOrder", () => {
  const lane = computeLane({ bid, ask }, opts);

  it("keeps orders at or inside the curb", () => {
    expect(placeOrder(lane, "buy", 2_632_000n, MON_USDC.tickSize)).toEqual({ kind: "in-lane" });
    expect(placeOrder(lane, "buy", 2_647_200n, MON_USDC.tickSize)).toEqual({ kind: "in-lane" });
    expect(placeOrder(lane, "sell", 2_618_200n, MON_USDC.tickSize)).toEqual({ kind: "in-lane" });
  });

  it("puts orders past the curb in the off-book zone, with the limit they crossed", () => {
    expect(placeOrder(lane, "buy", 2_715_000n, MON_USDC.tickSize)).toEqual({ kind: "off-book", limit: 2_647_200n });
    expect(placeOrder(lane, "sell", 2_618_100n, MON_USDC.tickSize)).toEqual({ kind: "off-book", limit: 2_618_200n });
  });

  it("rejects prices that are off-tick, non-positive, or have no market", () => {
    expect(placeOrder(lane, "buy", 2_632_050n, MON_USDC.tickSize)).toEqual({ kind: "invalid", reason: "not-on-tick" });
    expect(placeOrder(lane, "buy", 0n, MON_USDC.tickSize)).toEqual({ kind: "invalid", reason: "not-positive" });
    expect(placeOrder(computeLane({ bid: null, ask }, opts), "buy", 2_632_000n, MON_USDC.tickSize)).toEqual({
      kind: "invalid",
      reason: "no-market",
    });
  });
});
