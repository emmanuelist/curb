import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, type Hex } from "viem";
import { closePrice, perpOrderFromReceipt, perpOrderDesc, perpSide } from "@/lib/curb/perp";
import { MON_PERP } from "@/lib/markets/registry";
import { perplExchangeAbi } from "@/lib/perpl/abi";

type EventName = Extract<(typeof perplExchangeAbi)[number], { type: "event" }>["name"];

/** A log as Perpl emits it: every parameter is unindexed, so the data carries them all. */
function log(name: EventName, values: readonly unknown[]) {
  const event = perplExchangeAbi.find((e) => e.type === "event" && e.name === name);
  if (!event || event.type !== "event") throw new Error(name);
  return {
    address: MON_PERP.orderBook,
    topics: encodeEventTopics({ abi: [event], eventName: name } as never) as [Hex],
    data: encodeAbiParameters(event.inputs as never, values as never),
  };
}

describe("perpOrderFromReceipt", () => {
  it("reads the taker's fill, not the maker's position event in the same receipt", () => {
    // The shape of the fork run's long (tx 0x1a513516…): the maker (account 1767) gets PositionIncreasedV2; we get
    // PositionOpenedV2 and the one TakerOrderFilledV2 for 300 lots.
    const logs = [
      log("PositionIncreasedV2", [10n, 1767n, 1, 286n, 7_523_466_715n, 7_526_854_986n, 0n, 0n, 10_000n, 33_606n, 100n, 400n, 0n, 0n, 0n]),
      log("MakerOrderFilledV2", [10n, 1767n, 17n, 33_606n, 300n, 0n, 41_955_126_643n, -3_388_271n, 318_002_697_751n, 0n, 0n]),
      log("TakerOrderFilledV2", [33_606n, 33_606n, 33_606n, 300n, 3_479n, -5_049_479n, 24_950_521n, 0n, 0n]),
    ];
    expect(perpOrderFromReceipt({ logs } as never, MON_PERP, 5_394n)).toEqual({ orderId: null, filled: 300n, closed: false, avgPrice: 33_606n });
  });

  it("averages a taking order's price over every maker it walked", () => {
    // A close priced at the curb that met a thin top level: 79 MON at 0.033362, then 221 at 0.033340 (#59).
    const logs = [
      log("MakerOrderFilledV2", [10n, 25n, 19n, 33_362n, 79n, 0n, 0n, 0n, 0n, 0n, 0n]),
      log("MakerOrderFilledV2", [10n, 1767n, 4n, 33_340n, 221n, 0n, 0n, 0n, 0n, 0n, 0n]),
      log("PositionClosed", [10n, 5_395n, 0, 33_345n, -8_100n, 0n]),
      log("TakerOrderFilledV2", [33_345n, 33_345n, 33_345n, 300n, 3_453n, 4_996_797n, 11_847_505n, 0n, 0n]),
    ];
    // (79 × 33,362 + 221 × 33,340) / 300 = 33,345.79…, floored to the price unit.
    expect(perpOrderFromReceipt({ logs } as never, MON_PERP, 5_395n)).toEqual({ orderId: null, filled: 300n, closed: true, avgPrice: 33_345n });
  });

  it("takes a resting order's id from OrderPlaced, and a close from our PositionClosed only", () => {
    const rest = [log("OrderPlaced", [10n, 1000n, 3_400_000n, 0n, 26_600_000n])];
    expect(perpOrderFromReceipt({ logs: rest } as never, MON_PERP, 5_394n)).toEqual({ orderId: 10n, filled: 0n, closed: false, avgPrice: null });

    const theirs = [log("PositionClosed", [10n, 1767n, 1, 33_564n, 0n, 0n])];
    expect(perpOrderFromReceipt({ logs: theirs } as never, MON_PERP, 5_394n).closed).toBe(false);
    const ours = [log("PositionClosed", [10n, 5_394n, 0, 33_564n, -12_600n, 0n]), log("TakerOrderFilledV2", [33_564n, 33_564n, 33_564n, 300n, 3_475n, 5_000_000n, 29_900_000n, 0n, 0n])];
    expect(perpOrderFromReceipt({ logs: ours } as never, MON_PERP, 5_394n)).toEqual({ orderId: null, filled: 300n, closed: true, avgPrice: null });
  });
});

describe("perp orders", () => {
  it("maps actions to Perpl's order types and sides", () => {
    expect(perpOrderDesc(MON_PERP, { action: "open-long", price: 33_606n, lots: 300n, leverageHdths: 200n, postOnly: false })).toMatchObject({
      perpId: 10n,
      orderType: 0,
      pricePNS: 33_606n,
      lotLNS: 300n,
      leverageHdths: 200n,
      immediateOrCancel: true,
      postOnly: false,
      amountCNS: 0n,
    });
    expect(perpOrderDesc(MON_PERP, { action: "close-short", price: 1n, lots: 1n, leverageHdths: 100n, postOnly: true }).orderType).toBe(3);
    expect([perpSide("open-long"), perpSide("close-short"), perpSide("open-short"), perpSide("close-long")]).toEqual(["buy", "buy", "sell", "sell"]);
  });

  it("prices a one-tap close at the lane's far curb, so it can walk the book", () => {
    const lane = { minSell: 33_125n, maxBuy: 33_523n };
    expect(closePrice("long", lane)).toBe(33_125n);
    expect(closePrice("short", lane)).toBe(33_523n);
  });
});
