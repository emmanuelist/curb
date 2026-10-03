import { describe, expect, it } from "vitest";
import { encodeErrorResult } from "viem";
import { curbAccountAbi } from "@/lib/curb/abi";
import { explainRefusal, feePaid } from "@/lib/curb/refusal";
import { kuruErrorsAbi } from "@/lib/kuru/abi";
import { MON_USDC } from "@/lib/markets/registry";

describe("explainRefusal", () => {
  it("reads OffLane exactly as the fork returned it, curb price included", () => {
    // Revert data of fork tx 0x3b790cc0…: a buy one tick past maxBuy 0.031816.
    const data =
      "0x1684145900000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000308c840000000000000000000000000000000000000000000000000000000000308c20" as const;
    const r = explainRefusal(data, "order", MON_USDC);
    expect(r).toMatchObject({ error: "OffLane", by: "curb", signage: ["OFF-BOOK"], limit: 3_181_600n });
    expect(r.body).toContain("0.031817");
    expect(r.body).toContain("0.031816");
  });

  it("says NO WITHDRAWAL when the trading key tries to withdraw", () => {
    const r = explainRefusal("0x30cd7471", "withdraw", MON_USDC);
    expect(r).toMatchObject({ error: "NotOwner", by: "curb", signage: ["NO", "WITHDRAWAL"] });
  });

  it("keeps NotOwner's signage honest outside a withdrawal", () => {
    expect(explainRefusal("0x30cd7471", "order", MON_USDC).signage).toEqual(["OWNER", "KEY ONLY"]);
  });

  it("names Kuru, not Curb, for Kuru's own refusals", () => {
    const data = encodeErrorResult({ abi: kuruErrorsAbi, errorName: "PostOnlyError" });
    expect(data).toBe("0x06e6da4d");
    expect(explainRefusal(data, "order", MON_USDC)).toMatchObject({ error: "PostOnlyError", by: "kuru" });
  });

  it("decodes the market and tick refusals", () => {
    const market = encodeErrorResult({ abi: curbAccountAbi, errorName: "MarketNotAllowed", args: [MON_USDC.orderBook] });
    expect(explainRefusal(market, "order", MON_USDC)).toMatchObject({ error: "MarketNotAllowed", by: "curb" });
    const tick = encodeErrorResult({ abi: curbAccountAbi, errorName: "NotOnTick", args: [3_181_650, 100] });
    expect(explainRefusal(tick, "order", MON_USDC).error).toBe("NotOnTick");
  });

  it("never invents a reason it can't read", () => {
    for (const data of [null, undefined, "0x", "0xdeadbeef"] as const) {
      expect(explainRefusal(data, "withdraw", MON_USDC)).toMatchObject({ error: null, by: "unknown", signage: ["REFUSED"] });
    }
  });
});

describe("feePaid", () => {
  it("is gas used times the price paid (on Monad, gas used is the limit)", () => {
    expect(feePaid({ gasUsed: 40_000n, effectiveGasPrice: 102_000_000_000n })).toBe(4_080_000_000_000_000n);
  });
});
