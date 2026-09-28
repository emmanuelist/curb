"use client";

import { useSyncExternalStore } from "react";
import type { Address } from "viem";
import { readLedger, subscribeLedger, type LedgerEntry } from "@/lib/curb/ledger";

const EMPTY: LedgerEntry[] = [];
const cache = new Map<string, { raw: string; entries: LedgerEntry[] }>();

function snapshot(account: Address | null): LedgerEntry[] {
  if (!account) return EMPTY;
  const entries = readLedger(account);
  const raw = JSON.stringify(entries);
  const hit = cache.get(account);
  if (hit && hit.raw === raw) return hit.entries;
  cache.set(account, { raw, entries });
  return entries;
}

/** What this device sent for `account`, oldest first. */
export function useLedger(account: Address | null): LedgerEntry[] {
  return useSyncExternalStore(subscribeLedger, () => snapshot(account), () => EMPTY);
}
