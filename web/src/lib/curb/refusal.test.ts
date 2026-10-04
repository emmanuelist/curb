import { describe, expect, it } from "vitest";
import { encodeErrorResult } from "viem";
import { curbAccountAbi } from "@/lib/curb/abi";
import { explainRefusal, feePaid, refusedBy } from "@/lib/curb/refusal";
import { kuruErrorsAbi } from "@/lib/kuru/abi";
import { MON_PERP, MON_USDC } from "@/lib/markets/registry";
import { perplErrorsAbi } from "@/lib/perpl/abi";

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
      // No reason, no claim about who: not the account's red refusal, just a revert.
      expect(explainRefusal(data, "withdraw", MON_USDC)).toMatchObject({ error: null, by: "unknown", signage: [], title: "It reverted onchain." });
    }
  });
});

describe("feePaid", () => {
  it("is gas used times the price paid (on Monad, gas used is the limit)", () => {
    expect(feePaid({ gasUsed: 40_000n, effectiveGasPrice: 102_000_000_000n })).toBe(4_080_000_000_000_000n);
  });
});

describe("explainRefusal on Perpl", () => {
  it("reads PerpOffLane with Perpl's curb, in the perp's price units", () => {
    const data = encodeErrorResult({ abi: curbAccountAbi, errorName: "PerpOffLane", args: [10n, true, 33_543n, 33_542n] });
    const r = explainRefusal(data, "order", MON_PERP);
    expect(r).toMatchObject({ error: "PerpOffLane", by: "curb", signage: ["OFF-BOOK"], limit: 33_542n });
    expect(r.body).toContain("0.033543");
    expect(r.body).toContain("0.033542");
  });

  it("signs the leverage cap like a road sign", () => {
    const data = encodeErrorResult({ abi: curbAccountAbi, errorName: "LeverageAboveCap", args: [1000n, 500n] });
    const r = explainRefusal(data, "order", MON_PERP);
    expect(r).toMatchObject({ error: "LeverageAboveCap", by: "curb", signage: ["MAX", "5X"], capHdths: 500 });
    expect(r.body).toContain("10×");
  });

  it("names Perpl for Perpl's own rules", () => {
    const data = encodeErrorResult({ abi: perplErrorsAbi, errorName: "CrossesBook", args: [10n, 5_394n, 33_376n, true, 33_376n, false] });
    expect(explainRefusal(data, "order", MON_PERP)).toMatchObject({ error: "CrossesBook", by: "perpl" });
  });

  it("calls a venue's no a rejection, without the account's stencil sign", () => {
    // Seen on a fork whose clock ran past Perpl's 60-second price age (fork tx 0xc4f5ca39…). Arguments illustrative.
    const data = encodeErrorResult({ abi: perplErrorsAbi, errorName: "TakerOrderSettlementFailed", args: [10n, 5_400n, 33_090n, 33_090n, 33_090n, 0n, 300n, 1n] });
    const r = explainRefusal(data, "order", MON_PERP);
    expect(r).toMatchObject({ error: "TakerOrderSettlementFailed", by: "perpl", title: "Perpl rejected it.", signage: [] });
    expect(r.body).toContain("Nothing traded");
    expect(explainRefusal(encodeErrorResult({ abi: kuruErrorsAbi, errorName: "PostOnlyError" }), "order", MON_USDC)).toMatchObject({ title: "Kuru rejected it.", signage: [] });
  });
});

describe("refusedBy", () => {
  it("tells the account's refusals from a venue's rejections by the error's name alone", () => {
    expect(refusedBy("OffLane")).toBe("curb");
    expect(refusedBy("NotOwner")).toBe("curb");
    expect(refusedBy("LeverageAboveCap")).toBe("curb");
    expect(refusedBy("PostOnlyError")).toBe("kuru");
    expect(refusedBy("TakerOrderSettlementFailed")).toBe("perpl");
    expect(refusedBy(null)).toBe("unknown");
    expect(refusedBy("SomethingElse")).toBe("unknown");
  });
});
