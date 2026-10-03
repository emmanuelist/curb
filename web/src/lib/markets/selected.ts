import { MARKETS, MON_USDC, type Market } from "@/lib/markets/registry";

/**
 * The market the Trade screen shows, shared by its parts and remembered on this device (a convenience only:
 * nothing about the account depends on it). Spot on Kuru until the person picks the Perpl perpetual.
 */
const KEY = "curb.market.v1";
const listeners = new Set<() => void>();
let current: Market | null = null;

function load(): Market {
  try {
    const id = localStorage.getItem(KEY);
    return MARKETS.find((m) => m.id === id) ?? MON_USDC;
  } catch {
    return MON_USDC;
  }
}

export function selectedMarket(): Market {
  current ??= load();
  return current;
}

export function selectMarket(market: Market) {
  current = market;
  try {
    localStorage.setItem(KEY, market.id);
  } catch {
    // Storage blocked: the choice lasts for this visit.
  }
  for (const l of listeners) l();
}

export function subscribeMarket(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The venue's name, for the words around the numbers. */
export const venueName = (market: Market) => (market.venue === "perpl" ? "Perpl" : "Kuru");

/** How a market reads in the switch and the hero. */
export const marketLabel = (market: Market) =>
  market.venue === "perpl" ? `${market.base.symbol} Perp` : `${market.base.symbol} / ${market.quote.symbol}`;
