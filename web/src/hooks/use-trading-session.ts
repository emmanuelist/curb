"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { currentTradingSession, setTradingSession, subscribeTradingSession } from "@/lib/curb/trading-session";
import { explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import type { CurbAccountRecord } from "@/lib/passkey/keys";
import { usePasskeyKeys } from "@/hooks/use-passkey-keys";

/** The unlocked trading key for this tab, or null while locked. */
export function useTradingSession() {
  return useSyncExternalStore(subscribeTradingSession, currentTradingSession, () => null);
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
