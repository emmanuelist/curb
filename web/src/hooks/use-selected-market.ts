"use client";

import { useSyncExternalStore } from "react";
import { MON_USDC } from "@/lib/markets/registry";
import { selectedMarket, subscribeMarket } from "@/lib/markets/selected";

/** The Trade screen's market (spot on Kuru, or the Perpl perpetual). The server render always shows spot. */
export function useSelectedMarket() {
  return useSyncExternalStore(subscribeMarket, selectedMarket, () => MON_USDC);
}
