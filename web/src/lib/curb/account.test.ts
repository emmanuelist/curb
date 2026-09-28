import { describe, expect, it } from "vitest";
import { encodeAbiParameters, encodeEventTopics, type Address, type Hex } from "viem";
import { cancelledIdsFromReceipt, crosses, makerFillsFromLogs, restingOrderFromReceipt, takerFillFromReceipt } from "@/lib/curb/account";
import { trackedOrderIds, type LedgerEntry } from "@/lib/curb/ledger";
import { kuruOrderBookAbi } from "@/lib/kuru/abi";
import { MON_USDC } from "@/lib/markets/registry";

const account = "0xf774a7013e1A0325830d5B4D9D45980cc30231BB" as Address;
const other = "0x34ae4d081c0d46b23ebf5292c1be4e45f8a73fc5" as Address;

function orderCreatedLog(owner: Address, orderId: number, size: bigint, price: number, isBuy: boolean) {
  return {
    address: MON_USDC.orderBook,
    topics: encodeEventTopics({ abi: kuruOrderBookAbi, eventName: "OrderCreated" }) as [Hex],
    data: encodeAbiParameters(
      [{ type: "uint40" }, { type: "address" }, { type: "uint96" }, { type: "uint32" }, { type: "bool" }],
      [orderId, owner, size, price, isBuy],
    ),
  };
}

function cancelLog(owner: Address, ids: number[]) {
  return {
    address: MON_USDC.orderBook,
    topics: encodeEventTopics({ abi: kuruOrderBookAbi, eventName: "OrdersCanceled" }) as [Hex],
    data: encodeAbiParameters([{ type: "uint40[]" }, { type: "address" }], [ids, owner]),
  };
}

function makerTradeLog(orderId: number, maker: Address, filled: bigint, hash: Hex, block: bigint) {
  return {
    address: MON_USDC.orderBook,
    topics: encodeEventTopics({ abi: kuruOrderBookAbi, eventName: "Trade" }) as [Hex],
    data: encodeAbiParameters(
      [{ type: "uint40" }, { type: "address" }, { type: "bool" }, { type: "uint256" }, { type: "uint96" }, { type: "address" }, { type: "address" }, { type: "uint96" }],
      [orderId, maker, false, 28_231_000_000_000_000n, 0n, other, other, filled],
    ),
    transactionHash: hash,
    blockNumber: block,
  };
}

function tradeLog(taker: Address, filled: bigint) {
  return {
    address: MON_USDC.orderBook,
    topics: encodeEventTopics({ abi: kuruOrderBookAbi, eventName: "Trade" }) as [Hex],
    data: encodeAbiParameters(
      [
        { type: "uint40" },
        { type: "address" },
        { type: "bool" },
        { type: "uint256" },
        { type: "uint96" },
        { type: "address" },
        { type: "address" },
        { type: "uint96" },
      ],
      [7, other, false, 28_231_000_000_000_000n, 0n, taker, taker, filled],
    ),
  };
}

describe("crosses", () => {
  const top = { bid: 2_822_200n, ask: 2_823_300n };
  it("a buy at or above the best ask takes; below rests", () => {
    expect(crosses("buy", 2_823_300n, top)).toBe(true);
    expect(crosses("buy", 2_823_200n, top)).toBe(false);
  });
  it("a sell at or below the best bid takes; above rests", () => {
    expect(crosses("sell", 2_822_200n, top)).toBe(true);
    expect(crosses("sell", 2_822_300n, top)).toBe(false);
  });
});

describe("receipt decoding (Kuru events have no indexed fields)", () => {
  it("finds the order this account left resting, ignoring other owners' orders", () => {
    const logs = [orderCreatedLog(other, 111_116_316, 715_890_000_000_000n, 2_793_100, true), orderCreatedLog(account, 111_200_000, 2_000_000_000_000n, 2_823_300, false)];
    expect(restingOrderFromReceipt({ logs } as never, MON_USDC, account)).toEqual({
      orderId: 111_200_000n,
      price: 2_823_300n,
      size: 2_000_000_000_000n,
      isBuy: false,
    });
  });

  it("returns null when nothing rested (fully filled on arrival)", () => {
    expect(restingOrderFromReceipt({ logs: [tradeLog(account, 2_000_000_000_000n)] } as never, MON_USDC, account)).toBeNull();
  });

  it("sums this account's taker fills", () => {
    const logs = [tradeLog(account, 1_200_000_000_000n), tradeLog(other, 5n), tradeLog(account, 800_000_000_000n)];
    expect(takerFillFromReceipt({ logs } as never, MON_USDC, account)).toBe(2_000_000_000_000n);
  });
});

describe("cancel and fill decoding", () => {
  it("reads only the ids a cancel removed for this account", () => {
    const logs = [cancelLog(other, [1, 2]), cancelLog(account, [111_200_000])];
    expect(cancelledIdsFromReceipt({ logs } as never, MON_USDC, account)).toEqual([111_200_000n]);
    expect(cancelledIdsFromReceipt({ logs: [] } as never, MON_USDC, account)).toEqual([]);
  });

  it("finds fills of this account's resting orders as maker, for the ids asked about", () => {
    const h1 = `0x${"a1".repeat(32)}` as Hex;
    const h2 = `0x${"b2".repeat(32)}` as Hex;
    const logs = [
      makerTradeLog(111_200_000, account, 700_000_000_000n, h1, 108_700_001n),
      makerTradeLog(111_200_000, other, 5n, h1, 108_700_001n),
      makerTradeLog(999, account, 5n, h2, 108_700_002n),
    ];
    expect(makerFillsFromLogs(logs, MON_USDC, account, new Set(["111200000"]))).toEqual([
      { hash: h1, block: 108_700_001n, orderId: 111_200_000n, size: 700_000_000_000n },
    ]);
  });
});

describe("trackedOrderIds", () => {
  it("keeps placed orders that this device hasn't cancelled", () => {
    const entries: LedgerEntry[] = [
      { kind: "order", hash: "0x1", at: 1, side: "sell", price: "2823300", size: "2000000000000", orderId: "10", takerFill: "0" },
      { kind: "order", hash: "0x2", at: 2, side: "buy", price: "2822200", size: "2000000000000", orderId: "11", takerFill: "0" },
      { kind: "order", hash: "0x3", at: 3, side: "buy", price: "2823300", size: "2000000000000", orderId: null, takerFill: "2000000000000" },
      { kind: "cancel", hash: "0x4", at: 4, orderIds: ["10"] },
    ];
    expect(trackedOrderIds(entries)).toEqual(["11"]);
  });
});
