import { describe, expect, it } from "vitest";
import { decodeFunctionData, encodeAbiParameters, encodeEventTopics, encodeFunctionData, erc20Abi, toFunctionSelector, type Hex } from "viem";
import { ausdReceived, checkFlowQuote, FlowQuoteError, KURU_FLOW_ROUTER, kuruFlowAbi, withMinimum } from "@/lib/kuru/flow";
import { AUSD } from "@/lib/markets/registry";
import quote450 from "./__fixtures__/kuru-flow-quote-450mon.json";

// A real Kuru Flow quote (2026-10-04) for 450 MON → AUSD from the empty deployer address 0x508e…4E87.
const USER = "0x508eF51C834f7B8A5c1E8ECCFebA0F78c1654E87" as const;
const MON_450 = 450n * 10n ** 18n;

/** The fixture with its calldata re-encoded after `edit` changes the decoded swap. */
function withCall(edit: (args: ReturnType<typeof decode>) => Parameters<typeof encodeFunctionData<typeof kuruFlowAbi>>[0]) {
  const data = encodeFunctionData(edit(decode()));
  return { ...quote450, transaction: { ...quote450.transaction, calldata: data.slice(2) } };
}
const decode = () => {
  const d = decodeFunctionData({ abi: kuruFlowAbi, data: `0x${quote450.transaction.calldata}` as Hex });
  if (d.functionName !== "executeSwap") throw new Error("fixture changed");
  return d.args;
};

describe("checkFlowQuote", () => {
  it("accepts Kuru Flow's real quote and keeps the onchain minimum", () => {
    const q = checkFlowQuote(quote450, MON_450, USER);
    expect(q).toMatchObject({ to: KURU_FLOW_ROUTER, value: MON_450, out: 15_269_243n, estimate: 15_269_243n, minOut: 15_209_692n, feeBps: 0n });
    expect(q.data.slice(0, 10)).toBe(toFunctionSelector(kuruFlowAbi[0]));
    expect(toFunctionSelector(kuruFlowAbi[0])).toBe("0xce1e7030");
  });

  it("refuses another contract or another amount of MON", () => {
    expect(() => checkFlowQuote({ ...quote450, transaction: { ...quote450.transaction, to: "0x0000000000000000000000000000000000000bad" } }, MON_450, USER)).toThrow(/contract Curb doesn't know/);
    expect(() => checkFlowQuote(quote450, MON_450 - 1n, USER)).toThrow(/different amount of MON/);
  });

  it("refuses a swap that buys something else or sells something else", () => {
    const usdc = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" as const;
    const buysUsdc = withCall(([i, f, p]) => ({ abi: kuruFlowAbi, functionName: "executeSwap", args: [{ ...i, tokenUserBuys: usdc }, f, p] }));
    expect(() => checkFlowQuote(buysUsdc, MON_450, USER)).toThrow(/other than AUSD/);
    const sellsLess = withCall(([i, f, p]) => ({ abi: kuruFlowAbi, functionName: "executeSwap", args: [{ ...i, amountUserSells: 1n }, f, p] }));
    expect(() => checkFlowQuote(sellsLess, MON_450, USER)).toThrow(/other than your MON/);
  });

  it("refuses paying the AUSD to someone else, and fees over the cap", () => {
    const elsewhere = withCall(([i, f, p]) => ({ abi: kuruFlowAbi, functionName: "executeSwapWithReceiver", args: [i, f, p, "0x000000000000000000000000000000000000dEaD"] }));
    expect(() => checkFlowQuote(elsewhere, MON_450, USER)).toThrow(/another address/);
    const toSelf = withCall(([i, f, p]) => ({ abi: kuruFlowAbi, functionName: "executeSwapWithReceiver", args: [i, f, p, USER] }));
    expect(checkFlowQuote(toSelf, MON_450, USER).minOut).toBe(15_209_692n);
    const fee = withCall(([i, f, p]) => ({ abi: kuruFlowAbi, functionName: "executeSwap", args: [i, { ...f, feeBps: 30n, referrerFeeBps: 30n }, p] }));
    expect(() => checkFlowQuote(fee, MON_450, USER)).toThrow(/0.6% fee/);
  });

  it("passes Kuru Flow's own refusal through, and calls nothing else a quote", () => {
    expect(() => checkFlowQuote({ status: "error", message: "no route" }, MON_450, USER)).toThrow("Kuru Flow: no route");
    expect(() => checkFlowQuote(null, MON_450, USER)).toThrow(FlowQuoteError);
    expect(() => checkFlowQuote({ ...quote450, transaction: { ...quote450.transaction, calldata: "deadbeef" } }, MON_450, USER)).toThrow(/isn't a Kuru Flow swap/);
  });
});

describe("withMinimum", () => {
  it("replaces only the onchain minimum: the route, tokens, amount and fees stay as Kuru Flow wrote them", () => {
    const data = `0x${quote450.transaction.calldata}` as Hex;
    const before = decode();
    const after = decodeFunctionData({ abi: kuruFlowAbi, data: withMinimum(data, 15_000_000n) });
    if (after.functionName !== "executeSwap") throw new Error("function changed");
    const [intent, fee, program] = after.args;
    expect(intent).toEqual({ ...before[0], minAmountUserBuys: 15_000_000n });
    expect(fee).toEqual(before[1]);
    expect(program).toBe(before[2]);
  });

  it("keeps the receiver of executeSwapWithReceiver", () => {
    const toSelf = withCall(([i, f, p]) => ({ abi: kuruFlowAbi, functionName: "executeSwapWithReceiver", args: [i, f, p, USER] }));
    const after = decodeFunctionData({ abi: kuruFlowAbi, data: withMinimum(`0x${toSelf.transaction.calldata}` as Hex, 1n) });
    expect(after.functionName).toBe("executeSwapWithReceiver");
    expect(after.args[3]).toBe(USER);
    expect(after.args[0].minAmountUserBuys).toBe(1n);
  });
});

describe("ausdReceived", () => {
  const transfer = (token: `0x${string}`, from: `0x${string}`, to: `0x${string}`, value: bigint) => ({
    address: token,
    topics: encodeEventTopics({ abi: erc20Abi, eventName: "Transfer", args: { from, to } }) as [Hex, ...Hex[]],
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
  });

  it("sums only AUSD that reached the owner key", () => {
    const logs = [
      transfer(AUSD, KURU_FLOW_ROUTER, USER, 15_000_000n),
      transfer(AUSD, KURU_FLOW_ROUTER, USER, 233_055n),
      transfer(AUSD, USER, KURU_FLOW_ROUTER, 1n),
      transfer("0x754704Bc059F8C67012fEd69BC8A327a5aafb603", KURU_FLOW_ROUTER, USER, 99n),
    ];
    expect(ausdReceived({ logs: logs as never }, USER)).toBe(15_233_055n);
  });
});
