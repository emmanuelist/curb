import { describe, expect, it } from "vitest";
import { encodeErrorResult, encodeFunctionData, type Hash } from "viem";
import { curbAccountAbi, curbFactoryAbi } from "@/lib/curb/abi";
import { classify, firstBlockWhere, nonceBlocks } from "@/lib/curb/rebuild";
import { KURU_FLOW_ROUTER } from "@/lib/kuru/flow";
import { CURB_FACTORY } from "@/lib/markets/registry";

const keys = {
  account: "0x59C87e37a9bb219C517f01fd6cB3AdB5Cb7aFDB1",
  owner: "0x222Bc473153617Db03455Ab18C1cab8D6249037C",
  trading: "0x01e8a0919011a31E6C30a782A12496ddbbb523D1",
} as const;
const hash = `0x${"ab".repeat(32)}` as Hash;
const ok = { status: "success" as const, logs: [] };

describe("firstBlockWhere", () => {
  const from = (target: bigint) => async (b: bigint) => b >= target;

  it("finds the first block a condition holds from, one probe or many at a time", async () => {
    for (const fanout of [1, 8, 24]) {
      expect(await firstBlockWhere(100n, 1_000_000n, from(123_457n), fanout)).toBe(123_457n);
      expect(await firstBlockWhere(100n, 1_000_000n, from(100n), fanout)).toBe(100n);
      expect(await firstBlockWhere(100n, 1_000_000n, from(1_000_000n), fanout)).toBe(1_000_000n);
    }
  });

  it("says never when it never holds", async () => {
    expect(await firstBlockWhere(1n, 50n, async () => false, 8)).toBeNull();
  });
});

describe("nonceBlocks", () => {
  // A key that sent in blocks 1,005 (twice), 2,000 and 9,999: its nonce after each block.
  const sentIn = [1_005n, 1_005n, 2_000n, 9_999n];
  const nonceAt = async (b: bigint) => sentIn.filter((x) => x <= b).length;

  it("finds every block the nonce rose in, a block twice when it holds two transactions", async () => {
    expect(await nonceBlocks(nonceAt, 1_000n, 0, 20_000n, 4, 8)).toEqual([1_005n, 1_005n, 2_000n, 9_999n]);
  });

  it("finds only what came after a known point", async () => {
    expect(await nonceBlocks(nonceAt, 2_000n, 3, 20_000n, 4, 12)).toEqual([9_999n]);
    expect(await nonceBlocks(nonceAt, 2_000n, 3, 5_000n, 3, 12)).toEqual([]);
  });
});

describe("classify", () => {
  const tx = (from: string, to: string, input: `0x${string}`, value = 0n) => ({ hash, from: from as `0x${string}`, to: to as `0x${string}`, input, value });

  it("reads the account's creation, a swap and AUSD going onto Perpl", () => {
    const create = tx(keys.owner, CURB_FACTORY, encodeFunctionData({ abi: curbFactoryAbi, functionName: "create", args: [keys.trading] }));
    expect(classify(create, ok, 1, keys, null, null)).toEqual({ kind: "created", hash, at: 1 });
    const swap = tx(keys.owner, KURU_FLOW_ROUTER, "0xce1e7030", 354_080_000_000_000_000_000n);
    expect(classify(swap, ok, 2, keys, null, null)).toMatchObject({ kind: "swap", monIn: "354080000000000000000", ausdOut: "0" });
    const deposit = tx(keys.owner, keys.account, encodeFunctionData({ abi: curbAccountAbi, functionName: "perplDeposit", args: [11_859_509n] }));
    expect(classify(deposit, ok, 3, keys, null, null)).toEqual({ kind: "ausd-in", hash, at: 3, amount: "11859509" });
  });

  it("keeps a plain MON send, and drops what isn't the account's", () => {
    expect(classify(tx(keys.owner, keys.trading, "0x", 10n ** 18n), ok, 4, keys, null, null)).toMatchObject({ kind: "send", amount: "1000000000000000000", to: keys.trading });
    expect(classify(tx(keys.owner, "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a", "0xa9059cbb"), ok, 5, keys, null, null)).toBeNull();
    expect(classify(tx("0x000000000000000000000000000000000000dEaD", keys.account, "0x"), ok, 6, keys, null, null)).toBeNull();
  });

  it("reads a perp order's action, size and leverage from its calldata", () => {
    const desc = { orderDescId: 1n, perpId: 10n, orderType: 0, orderId: 0n, pricePNS: 33_389n, lotLNS: 300n, expiryBlock: 0n, postOnly: true, fillOrKill: false, immediateOrCancel: false, maxMatches: 0n, leverageHdths: 200n, lastExecutionBlock: 0n, amountCNS: 0n, maxNegPnlCollatBPS: 1000n };
    const order = tx(keys.trading, keys.account, encodeFunctionData({ abi: curbAccountAbi, functionName: "perplOrder", args: [desc] }));
    expect(classify(order, ok, 7, keys, 5_395n, null)).toMatchObject({ kind: "perp-order", action: "open-long", price: "33389", lots: "300", leverageHdths: 200, orderId: null, filled: "0" });
  });

  it("turns a refused transaction into the refusal it was, with the reason decoded", () => {
    const desc = { orderDescId: 1n, perpId: 10n, orderType: 0, orderId: 0n, pricePNS: 40_000n, lotLNS: 300n, expiryBlock: 0n, postOnly: true, fillOrKill: false, immediateOrCancel: false, maxMatches: 0n, leverageHdths: 1000n, lastExecutionBlock: 0n, amountCNS: 0n, maxNegPnlCollatBPS: 1000n };
    const order = tx(keys.trading, keys.account, encodeFunctionData({ abi: curbAccountAbi, functionName: "perplOrder", args: [desc] }));
    const revert = encodeErrorResult({ abi: curbAccountAbi, errorName: "LeverageAboveCap", args: [1000n, 500n] });
    expect(classify(order, { status: "reverted", logs: [] }, 8, keys, 5_395n, revert)).toMatchObject({ kind: "refused", attempt: "order", signer: "trading", error: "LeverageAboveCap" });
    const withdraw = tx(keys.trading, keys.account, encodeFunctionData({ abi: curbAccountAbi, functionName: "withdraw", args: [keys.account, 1n, keys.trading] }));
    expect(classify(withdraw, { status: "reverted", logs: [] }, 9, keys, null, encodeErrorResult({ abi: curbAccountAbi, errorName: "NotOwner" }))).toMatchObject({ kind: "refused", attempt: "withdraw", error: "NotOwner" });
  });
});
