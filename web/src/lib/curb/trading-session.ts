"use client";

import type { TradingSession } from "@/lib/passkey/keys";

/**
 * The unlocked trading key, shared by every screen in this tab. One Face ID opens it; it ends on `lock()`,
 * a reload, or after IDLE_MS without use, so an unattended phone doesn't keep a live key.
 */
const IDLE_MS = 15 * 60_000;

let session: TradingSession | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(lockTrading, IDLE_MS);
}

export function setTradingSession(next: TradingSession) {
  session?.end();
  session = next;
  armIdle();
  emit();
}

/** The live session, touching the idle timer (call this when the key is about to sign). */
export function activeTradingKey(): TradingSession | null {
  if (session) armIdle();
  return session;
}

export function currentTradingSession(): TradingSession | null {
  return session;
}

export function lockTrading() {
  clearTimeout(idleTimer);
  session?.end();
  session = null;
  emit();
}

export function subscribeTradingSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
