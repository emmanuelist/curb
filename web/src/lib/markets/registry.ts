import type { Address } from "viem";

/** Where a market's book lives. Both are onchain order books, which is what lets CurbAccount check the lane. */
export type Venue = "kuru" | "perpl";

/** A market as Curb uses it: Kuru spot or a Perpl perpetual. Values are verified onchain (docs/CONTEXT.md). */
export type Market = {
  id: string;
  venue: Venue;
  /** Kuru: the OrderBook proxy. Perpl: the Exchange proxy (one contract for every perpetual). */
  orderBook: Address;
  /** Perpl only: the perpetual's id on the Exchange. */
  perpId?: bigint;
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
  venue: "kuru",
  orderBook: "0x065C9d28E428A0db40191a54d33d5b7c71a9C394",
  base: { symbol: "MON", decimals: 18, address: null },
  quote: { symbol: "USDC", decimals: 6, address: "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" },
  pricePrecision: 10n ** 8n,
  sizePrecision: 10n ** 10n,
  tickSize: 100n,
  minSize: 2_000_000_000_000n,
};

/** Perpl's Exchange on Monad mainnet (docs/CONTEXT.md → Perpl): perpetuals on an onchain order book. */
export const PERPL_EXCHANGE: Address = "0x34B6552d57a35a1D042CcAe1951BD1C370112a6F";

/** Agora's AUSD: Perpl's collateral, 6 decimals. */
export const AUSD: Address = "0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a";

/**
 * Perpl's MON perpetual on Monad mainnet (id 10): priceDecimals 6, lotDecimals 0, so a price unit is $0.000001 and
 * a size unit is 1 MON. Collateral is AUSD. Verified with getPerpetualInfo, 2026-10-03.
 */
export const MON_PERP: Market = {
  id: "mon-perp",
  venue: "perpl",
  orderBook: PERPL_EXCHANGE,
  perpId: 10n,
  base: { symbol: "MON", decimals: 0, address: null },
  quote: { symbol: "AUSD", decimals: 6, address: AUSD },
  pricePrecision: 10n ** 6n,
  sizePrecision: 1n,
  tickSize: 1n,
  minSize: 1n,
};


/**
 * How far from the venue's best bid/ask the trading key may trade, in basis points.
 * CurbAccount (M2) enforces the same number onchain; the UI must never draw a different lane.
 */
export const LANE_BAND_BPS = 50n;

/** Kuru MarginAccount on Monad mainnet (docs/CONTEXT.md). */
export const KURU_MARGIN_ACCOUNT: Address = "0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5";

/**
 * CurbFactory on Monad mainnet (#31, D-017): creates one CurbAccount per owner at a CREATE2 address that
 * `accountOf(owner, trader)` recomputes. Deployed at block 108,627,002; source verified (Sourcify exact match).
 * NEXT_PUBLIC_CURB_FACTORY points the app at another factory (a fork deploy of v2 during development, #51).
 */
export const CURB_FACTORY: Address =
  (process.env.NEXT_PUBLIC_CURB_FACTORY as Address | undefined) || "0x633Bf378031d694Bcb8E39E6CF160efD75Af18e8";

/** The v1 factory (#31): its accounts trade Kuru only. */
const FACTORY_V1: Address = "0x633Bf378031d694Bcb8E39E6CF160efD75Af18e8";

/**
 * Futures need CurbAccount v2. While the app still points at the v1 factory (before #50's deploy), an account made
 * here couldn't trade Perpl, so the Perpl market stays hidden rather than leading anyone to an account that can't.
 */
export const PERPS_ENABLED = CURB_FACTORY.toLowerCase() !== FACTORY_V1.toLowerCase();

/** Every market the app trades, in the order the switch shows them. */
export const MARKETS: readonly Market[] = PERPS_ENABLED ? [MON_USDC, MON_PERP] : [MON_USDC];
