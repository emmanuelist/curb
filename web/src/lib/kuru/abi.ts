/** Subset of Kuru's OrderBook ABI (from @kuru-labs/kuru-sdk 0.0.95 abi/OrderBook.json; docs/CONTEXT.md). */
export const kuruOrderBookAbi = [
  {
    type: "function",
    name: "bestBidAsk",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }, { type: "uint256" }],
  },
  {
    type: "function",
    name: "getL2Book",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bytes" }],
  },
] as const;
