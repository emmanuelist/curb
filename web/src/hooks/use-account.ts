"use client";

import { useSyncExternalStore } from "react";
import type { CurbAccountRecord } from "@/lib/passkey/keys";
import { loadAccount, subscribeAccount } from "@/lib/passkey/store";

let cachedRaw: string | null | undefined;
let cached: CurbAccountRecord | null = null;

function snapshot(): CurbAccountRecord | null {
  const next = loadAccount();
  const raw = next ? JSON.stringify(next) : null;
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cached = next;
  }
  return cached;
}

/** The Curb account on this device (public record only), or null. */
export function useAccount(): CurbAccountRecord | null {
  return useSyncExternalStore(subscribeAccount, snapshot, () => null);
}
