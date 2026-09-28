// Generated from contracts/out (forge build). Regenerate after changing CurbAccount or CurbFactory.
// The deployed factory's source is verified on Sourcify/MonadVision (exact match), see docs/CONTEXT.md.

export const curbAccountAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "owner_",
        type: "address",
        internalType: "address",
      },
      {
        name: "trader_",
        type: "address",
        internalType: "address",
      },
      {
        name: "margin_",
        type: "address",
        internalType: "contract IKuruMarginAccount",
      },
      {
        name: "market_",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "receive",
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "LANE_BAND_BPS",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "NATIVE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "cancel",
    inputs: [
      {
        name: "market",
        type: "address",
        internalType: "address",
      },
      {
        name: "orderIds",
        type: "uint40[]",
        internalType: "uint40[]",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "lane",
    inputs: [
      {
        name: "market",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "maxBuy",
        type: "uint32",
        internalType: "uint32",
      },
      {
        name: "minSell",
        type: "uint32",
        internalType: "uint32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "margin",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IKuruMarginAccount",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "markets",
    inputs: [
      {
        name: "market",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "allowed",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "pricePrecision",
        type: "uint32",
        internalType: "uint32",
      },
      {
        name: "tickSize",
        type: "uint32",
        internalType: "uint32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "placeBuy",
    inputs: [
      {
        name: "market",
        type: "address",
        internalType: "address",
      },
      {
        name: "price",
        type: "uint32",
        internalType: "uint32",
      },
      {
        name: "size",
        type: "uint96",
        internalType: "uint96",
      },
      {
        name: "postOnly",
        type: "bool",
        internalType: "bool",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "placeSell",
    inputs: [
      {
        name: "market",
        type: "address",
        internalType: "address",
      },
      {
        name: "price",
        type: "uint32",
        internalType: "uint32",
      },
      {
        name: "size",
        type: "uint96",
        internalType: "uint96",
      },
      {
        name: "postOnly",
        type: "bool",
        internalType: "bool",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setMarket",
    inputs: [
      {
        name: "market",
        type: "address",
        internalType: "address",
      },
      {
        name: "allowed",
        type: "bool",
        internalType: "bool",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setTrader",
    inputs: [
      {
        name: "next",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "sweep",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "trader",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [
      {
        name: "token",
        type: "address",
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "to",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "event",
    name: "MarketSet",
    inputs: [
      {
        name: "market",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "allowed",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "OrderSent",
    inputs: [
      {
        name: "market",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "isBuy",
        type: "bool",
        indexed: false,
        internalType: "bool",
      },
      {
        name: "price",
        type: "uint32",
        indexed: false,
        internalType: "uint32",
      },
      {
        name: "size",
        type: "uint96",
        indexed: false,
        internalType: "uint96",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "TraderSet",
    inputs: [
      {
        name: "previous",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "next",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Withdrawn",
    inputs: [
      {
        name: "token",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "amount",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "to",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "MarketNotAllowed",
    inputs: [
      {
        name: "market",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "NoMarket",
    inputs: [
      {
        name: "market",
        type: "address",
        internalType: "address",
      },
    ],
  },
  {
    type: "error",
    name: "NotOnTick",
    inputs: [
      {
        name: "price",
        type: "uint32",
        internalType: "uint32",
      },
      {
        name: "tickSize",
        type: "uint32",
        internalType: "uint32",
      },
    ],
  },
  {
    type: "error",
    name: "NotOwner",
    inputs: [],
  },
  {
    type: "error",
    name: "NotOwnerOrTrader",
    inputs: [],
  },
  {
    type: "error",
    name: "NotTrader",
    inputs: [],
  },
  {
    type: "error",
    name: "OffLane",
    inputs: [
      {
        name: "isBuy",
        type: "bool",
        internalType: "bool",
      },
      {
        name: "price",
        type: "uint32",
        internalType: "uint32",
      },
      {
        name: "limit",
        type: "uint32",
        internalType: "uint32",
      },
    ],
  },
  {
    type: "error",
    name: "TransferFailed",
    inputs: [],
  },
  {
    type: "error",
    name: "ZeroAddress",
    inputs: [],
  },
  {
    type: "error",
    name: "ZeroPrice",
    inputs: [],
  },
] as const;

export const curbFactoryAbi = [
  {
    type: "constructor",
    inputs: [
      {
        name: "margin_",
        type: "address",
        internalType: "contract IKuruMarginAccount",
      },
      {
        name: "defaultMarket_",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "accountOf",
    inputs: [
      {
        name: "owner",
        type: "address",
        internalType: "address",
      },
      {
        name: "trader",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "create",
    inputs: [
      {
        name: "trader",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "account",
        type: "address",
        internalType: "contract CurbAccount",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "defaultMarket",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "margin",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "address",
        internalType: "contract IKuruMarginAccount",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "AccountCreated",
    inputs: [
      {
        name: "owner",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "account",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "trader",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "ZeroAddress",
    inputs: [],
  },
] as const;
