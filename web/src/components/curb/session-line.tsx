"use client";

import { Lock } from "lucide-react";
import { KeyGlyph } from "@/components/keys/signer";
import { IDLE_MINUTES, lockTrading } from "@/lib/curb/trading-session";
import { useNow } from "@/hooks/use-chain-history";
import { useTradingLockedBy, useTradingLocksAt, useTradingSession } from "@/hooks/use-trading-session";

const mmss = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * The trading session, said where it matters (#42). Unlocked: the time left before it locks itself if unused, and a
 * Lock button. Locked by the timeout: says so once, so a screen that changed under you explains itself.
 */
export function SessionLine({ scope }: { scope?: string }) {
  const session = useTradingSession();
  const locksAt = useTradingLocksAt();
  const lockedBy = useTradingLockedBy();
  const now = useNow(session !== null, 1000);

  if (!session) {
    if (lockedBy !== "idle") return null;
    // The same row as while unlocked, its key gone grey: the state changed, the place didn't.
    return (
      <p role="status" className="flex items-start gap-2 text-[12px] leading-relaxed text-muted">
        <span className="mt-0.5 shrink-0">
          <KeyGlyph role="trading" size={15} />
        </span>
        Locked after {IDLE_MINUTES} minutes unused, so an unattended phone holds no live key.
      </p>
    );
  }

  const left = locksAt !== null && now > 0 ? Math.max(0, locksAt - now) : null;
  return (
    <div className="flex items-center justify-between gap-3 text-[12px] text-muted">
      <p className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-road">
          <KeyGlyph role="trading" size={15} />
        </span>
        {/* Phrases never split, so a narrow screen breaks the line at a dot. */}
        <span className="tnum">
          <span className="whitespace-nowrap">Unlocked</span>
          {scope ? (
            <>
              {" · "}
              <span className="whitespace-nowrap">{scope}</span>
            </>
          ) : null}
          {left !== null ? (
            <>
              {" · "}
              <span className="whitespace-nowrap">
                locks in <span className="text-road">{mmss(left)}</span> if unused
              </span>
            </>
          ) : null}
        </span>
      </p>
      <button type="button" onClick={() => lockTrading()} className="-my-2 -mr-3 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-road hover:bg-high">
        <Lock size={12} aria-hidden="true" /> Lock
      </button>
    </div>
  );
}
