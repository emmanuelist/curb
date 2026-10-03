import { describe, expect, it } from "vitest";
import type { Hash } from "viem";
import type { LedgerEntry } from "@/lib/curb/ledger";
import { lotsResting, perpMakerFillsFromLogs, perpOrderRecords, perpOrderStatus, restingCandidates, type PerpOrderEntry } from "@/lib/curb/perp-orders";
import { MON_PERP } from "@/lib/markets/registry";

const h = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hash;

const order = (n: number, orderId: string | null, extra: Partial<PerpOrderEntry> = {}): PerpOrderEntry => ({
  kind: "perp-order",
  hash: h(n),
  at: n,
  market: "mon-perp",
  action: "open-long",
  price: "33564",
  lots: "300",
  leverageHdths: 200,
  orderId,
  filled: "0",
  ...extra,
});
const cancel = (n: number, orderId: string): LedgerEntry => ({ kind: "perp-cancel", hash: h(n), at: n, market: "mon-perp", orderId });
const fill = (n: number, orderId: string, lots: string): LedgerEntry => ({ kind: "perp-fill", hash: h(n), at: n, market: "mon-perp", orderId, lots, block: "1" });

describe("perpOrderRecords", () => {
  it("gives a cancel to the order that held the id then, not to a later order that reuses it", () => {
    // Perpl hands a freed id straight out again: cancel #35, and the next order can rest as #35 too.
    const records = perpOrderRecords([order(1, "35"), cancel(2, "35"), order(3, "35")]);
    expect(records.map((r) => [r.entry.hash, r.cancel?.hash ?? null, r.superseded])).toEqual([
      [h(1), h(2), true],
      [h(3), null, false],
    ]);
    expect(restingCandidates(records).map((r) => r.entry.hash)).toEqual([h(3)]);
  });

  it("gives fills to the order holding the id when they were seen", () => {
    const records = perpOrderRecords([order(1, "7"), fill(2, "7", "100"), order(3, "8"), fill(4, "7", "200")]);
    expect(records[0].fills.map((f) => f.lots)).toEqual(["100", "200"]);
    expect(records[1].fills).toEqual([]);
    // Fully filled by what Curb saw: nothing left for the book to settle.
    expect(restingCandidates(records).map((r) => r.entry.hash)).toEqual([h(3)]);
  });

  it("keeps markets apart and filters to one", () => {
    const records = perpOrderRecords([order(1, "5"), order(2, "5", { market: "other" }), cancel(3, "5")]);
    expect(records.map((r) => r.cancel?.hash ?? null)).toEqual([h(3), null]);
    expect(perpOrderRecords([order(1, "5"), order(2, "5", { market: "other" })], "other").map((r) => r.entry.hash)).toEqual([h(2)]);
  });
});

describe("lotsResting", () => {
  const entry = order(1, "35");
  const ours = { accountId: 5394, orderType: 0, priceONS: 33564 - 30000, lotLNS: 300n };

  it("reads the lots when the id still holds this order", () => {
    expect(lotsResting(entry, ours, 5394n, 30000n)).toBe(300n);
    expect(lotsResting(entry, { ...ours, lotLNS: 120n }, 5394n, 30000n)).toBe(120n);
  });

  it("reads 0 when the id now holds someone else's order, another side or another price", () => {
    expect(lotsResting(entry, { ...ours, accountId: 4734 }, 5394n, 30000n)).toBe(0n);
    expect(lotsResting(entry, { ...ours, orderType: 1 }, 5394n, 30000n)).toBe(0n);
    expect(lotsResting(entry, { ...ours, priceONS: 3565 }, 5394n, 30000n)).toBe(0n);
    expect(lotsResting(entry, { ...ours, lotLNS: 301n }, 5394n, 30000n)).toBe(0n);
    expect(lotsResting(entry, null, 5394n, 30000n)).toBe(0n);
  });
});

describe("perpOrderStatus", () => {
  const one = (entries: LedgerEntry[]) => perpOrderRecords(entries)[0];

  it("settles what the ledger can, and leaves the rest to the book", () => {
    expect(perpOrderStatus(one([order(1, null, { filled: "300" })]), undefined, false)).toBe("filled");
    expect(perpOrderStatus(one([order(1, null)]), undefined, false)).toBe("unfilled");
    expect(perpOrderStatus(one([order(1, "35"), cancel(2, "35")]), 300n, false)).toBe("cancelled");
    expect(perpOrderStatus(one([order(1, "35")]), 300n, true)).toBe("cancelling");
    expect(perpOrderStatus(one([order(1, "35"), fill(2, "35", "300")]), 0n, false)).toBe("filled");
    expect(perpOrderStatus(one([order(1, "35")]), undefined, false)).toBe("unknown");
    expect(perpOrderStatus(one([order(1, "35")]), 300n, false)).toBe("open");
    expect(perpOrderStatus(one([order(1, "35")]), 0n, false)).toBe("closed");
  });

  it("never reads an order as open once a newer order of ours took its id", () => {
    expect(perpOrderStatus(one([order(1, "35"), order(2, "35")]), 300n, false)).toBe("closed");
  });
});

describe("perpMakerFillsFromLogs", () => {
  // A real MakerOrderFilledV2 from Monad mainnet: block 110,306,199, tx 0x80be3795…a217e3, perpetual 40, maker account
  // 4,734, order #7 filled 2,964 lots.
  const mainnetLog = {
    address: MON_PERP.orderBook,
    topics: ["0xa59d6df87b5cb9e8cca8c09e8f1e240b7a1d4a2ee8f6c636c12ce22b43b82d70"] as [`0x${string}`],
    data: "0x0000000000000000000000000000000000000000000000000000000000000028000000000000000000000000000000000000000000000000000000000000127e000000000000000000000000000000000000000000000000000000000000000700000000000000000000000000000000000000000000000000000000000daa140000000000000000000000000000000000000000000000000000000000000b940000000000000000000000000000000000000000000000000000000000009b87000000000000000000000000000000000000000000000000000000003cf0e193fffffffffffffffffffffffffffffffffffffffffffffffffffffffff044fa6b00000000000000000000000000000000000000000000000000000006176389dc00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
    transactionHash: "0x80be37951a2bf0fa3bd701ed5be39c005af25e2cea1841495dc6123084a217e3" as Hash,
    blockNumber: 110_306_199n,
  };
  const perp40 = { ...MON_PERP, perpId: 40n };

  it("finds the maker fill of a tracked order", () => {
    expect(perpMakerFillsFromLogs([mainnetLog], perp40, 4734n, new Set(["7"]))).toEqual([
      { hash: mainnetLog.transactionHash, block: 110_306_199n, orderId: 7n, lots: 2964n },
    ]);
  });

  it("ignores other accounts, other perpetuals and untracked orders", () => {
    expect(perpMakerFillsFromLogs([mainnetLog], perp40, 5394n, new Set(["7"]))).toEqual([]);
    expect(perpMakerFillsFromLogs([mainnetLog], MON_PERP, 4734n, new Set(["7"]))).toEqual([]);
    expect(perpMakerFillsFromLogs([mainnetLog], perp40, 4734n, new Set(["8"]))).toEqual([]);
  });
});
