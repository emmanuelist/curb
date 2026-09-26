import type { Address } from "viem";

/** A Kuru market as Curb uses it. Values are verified onchain (docs/CONTEXT.md). */
export type Market = {
  id: string;
  /** Kuru OrderBook proxy. */
  orderBook: Address;
  base: { symbol: string; decimals: number; address: Address | null };
  quote: { symbol: string; decimals: number; address: Address };
  /** Order prices are integers in these units: price = units / pricePrecision. */
  pricePrecision: bigint;
  /** Order sizes are integers in these units: size = units / sizePrecision (base asset). */
  sizePrecision: bigint;
  /** Smallest price step, in price units. */
  tickSize: bigint;
  /** Smallest order, in size units. */
  minSize: bigint;
};

/** Kuru MON-USDC on Monad mainnet. getMarketParams() at block 108,227,602 (E-001). */
export const MON_USDC: Market = {
  id: "mon-usdc",
  orderBook: "0x065C9d28E428A0db40191a54d33d5b7c71a9C394",
  base: { symbol: "MON", decimals: 18, address: null },
  quote: { symbol: "USDC", decimals: 6, address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" },
  pricePrecision: 10n ** 8n,
  sizePrecision: 10n ** 10n,
  tickSize: 100n,
  minSize: 2_000_000_000_000n,
};

/**
 * How far from Kuru's best bid/ask the trading key may trade, in basis points.
 * CurbAccount (M2) enforces the same number onchain; the UI must never draw a different lane.
 */
export const LANE_BAND_BPS = 50n;

/** Kuru MarginAccount on Monad mainnet (docs/CONTEXT.md). */
export const KURU_MARGIN_ACCOUNT: Address = "0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5";
