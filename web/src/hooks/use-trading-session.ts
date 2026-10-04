"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { currentTradingSession, setTradingSession, subscribeTradingSession, tradingLockedBy, tradingLocksAt } from "@/lib/curb/trading-session";
import { explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import type { CurbAccountRecord } from "@/lib/passkey/keys";
import { usePasskeyKeys } from "@/hooks/use-passkey-keys";

/** The unlocked trading key for this tab, or null while locked. */
export function useTradingSession() {
  return useSyncExternalStore(subscribeTradingSession, currentTradingSession, () => null);
}

/** When the unlocked key locks if unused (epoch ms), or null while locked. */
export function useTradingLocksAt() {
  return useSyncExternalStore(subscribeTradingSession, tradingLocksAt, () => null);
}

/** Why the key last locked: "idle" after the timeout, "you" from a Lock button, null if it hasn't. */
export function useTradingLockedBy() {
  return useSyncExternalStore(subscribeTradingSession, tradingLockedBy, () => null);
}

/** One Face ID that derives the trading key into memory for this tab (the ticket and Orders share it). */
export function useUnlockTrading(record: CurbAccountRecord | null) {
  const keys = usePasskeyKeys();
  const [unlocking, setUnlocking] = useState(false);
  const [problem, setProblem] = useState<PasskeyProblem | null>(null);
  const unlock = useCallback(async () => {
    if (!keys || !record) return;
    setUnlocking(true);
    setProblem(null);
    try {
      setTradingSession(await keys.openTradingSession(window.location.hostname, record));
    } catch (error) {
      setProblem(explainPasskeyError(error));
    } finally {
      setUnlocking(false);
    }
  }, [keys, record]);
  return { ready: Boolean(keys && record), unlocking, problem, unlock };
}
