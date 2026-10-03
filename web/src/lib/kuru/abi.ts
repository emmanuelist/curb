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
  {
    type: "function",
    name: "s_orders",
    stateMutability: "view",
    inputs: [{ name: "orderId", type: "uint40" }],
    outputs: [
      { name: "ownerAddress", type: "address" },
      { name: "size", type: "uint96" },
      { name: "prev", type: "uint40" },
      { name: "next", type: "uint40" },
      { name: "flippedId", type: "uint40" },
      { name: "price", type: "uint32" },
      { name: "flippedPrice", type: "uint32" },
      { name: "isBuy", type: "bool" },
    ],
  },
  // Events: none of the parameters are indexed (checked against live MON-USDC logs, 2026-09-28).
  {
    type: "event",
    name: "OrderCreated",
    inputs: [
      { name: "orderId", type: "uint40", indexed: false },
      { name: "owner", type: "address", indexed: false },
      { name: "size", type: "uint96", indexed: false },
      { name: "price", type: "uint32", indexed: false },
      { name: "isBuy", type: "bool", indexed: false },
    ],
  },
  {
    type: "event",
    name: "OrdersCanceled",
    inputs: [
      { name: "orderId", type: "uint40[]", indexed: false },
      { name: "owner", type: "address", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Trade",
    inputs: [
      { name: "orderId", type: "uint40", indexed: false },
      { name: "makerAddress", type: "address", indexed: false },
      { name: "isBuy", type: "bool", indexed: false },
      { name: "price", type: "uint256", indexed: false },
      { name: "updatedSize", type: "uint96", indexed: false },
      { name: "takerAddress", type: "address", indexed: false },
      { name: "txOrigin", type: "address", indexed: false },
      { name: "filledSize", type: "uint96", indexed: false },
    ],
  },
] as const;

/** Subset of Kuru's MarginAccount ABI (abi/MarginAccount.json). Native MON is the zero address. */
export const kuruMarginAbi = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "payable",
    inputs: [
      { name: "_user", type: "address" },
      { name: "_token", type: "address" },
      { name: "_amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "getBalance",
    stateMutability: "view",
    inputs: [
      { name: "_user", type: "address" },
      { name: "_token", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

/**
 * Kuru errors seen onchain, so a refusal that came from Kuru rather than CurbAccount still decodes. Selectors verified:
 * PostOnlyError 0x06e6da4d (a crossing post-only order, fork 2026-10-03), InsufficientBalance 0xf4d678b8,
 * SizeError 0x0a5c4f1f, Unauthorized 0x82b42900 (docs/CONTEXT.md).
 */
export const kuruErrorsAbi = [
  { type: "error", name: "PostOnlyError", inputs: [] },
  { type: "error", name: "InsufficientBalance", inputs: [] },
  { type: "error", name: "SizeError", inputs: [] },
  { type: "error", name: "Unauthorized", inputs: [] },
] as const;
