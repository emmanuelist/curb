"use client";

import type { TradingSession } from "@/lib/passkey/keys";

/**
 * The unlocked trading key, shared by every screen in this tab. One Face ID opens it; it ends on `lockTrading()`,
 * leaving the page, or after IDLE_MS without use, so an unattended phone doesn't keep a live key.
 */
export const IDLE_MINUTES = 15;
const IDLE_MS = IDLE_MINUTES * 60_000;

let session: TradingSession | null = null;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
/** When the idle lock fires (epoch ms), while unlocked: every use of the key pushes it back (#42). */
let locksAt: number | null = null;
/** Why the last lock happened, so a screen can say "locked after 15 minutes unused" rather than just changing. */
let lockedBy: "idle" | "you" | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function armIdle() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => lockTrading("idle"), IDLE_MS);
  locksAt = Date.now() + IDLE_MS;
}

/** Past the idle deadline. A sleeping phone can hold a timer back; this makes it hold back nothing else. */
const expired = () => locksAt !== null && Date.now() >= locksAt;

let watching = false;
function watchPage() {
  if (watching || typeof document === "undefined") return;
  watching = true;
  // Waking the phone: lock first if the deadline passed while it slept, before anything else can use the key.
  document.addEventListener("visibilitychange", () => {
    if (session && expired()) lockTrading("idle");
  });
  // Leaving the page ends the session, so a page restored from the back-forward cache comes back locked.
  window.addEventListener("pagehide", () => {
    if (session) lockTrading();
  });
}

export function setTradingSession(next: TradingSession) {
  session?.end();
  session = next;
  lockedBy = null;
  armIdle();
  watchPage();
  emit();
}

/** The live session, touching the idle timer (call this when the key is about to sign). Null once it should have locked. */
export function activeTradingKey(): TradingSession | null {
  if (session && expired()) lockTrading("idle");
  if (session) {
    armIdle();
    emit();
  }
  return session;
}

export function currentTradingSession(): TradingSession | null {
  return session;
}

/** End the session: from a Lock button, or after IDLE_MINUTES unused. Anything already sent finishes on its own. */
export function lockTrading(by: "idle" | "you" = "you") {
  clearTimeout(idleTimer);
  session?.end();
  session = null;
  locksAt = null;
  lockedBy = by;
  emit();
}

export const tradingLocksAt = () => locksAt;
export const tradingLockedBy = () => lockedBy;

export function subscribeTradingSession(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
