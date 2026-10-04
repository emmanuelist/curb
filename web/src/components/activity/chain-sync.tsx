"use client";

import { useNow, type ChainHistory } from "@/hooks/use-chain-history";

const secs = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

/**
 * Where this screen's record comes from (#40): read from Monad by the keys' nonces, with progress and a clock while it
 * runs. Green once it matches the chain, as everything confirmed onchain is.
 */
export function ChainSync({ h }: { h: ChainHistory }) {
  const now = useNow(h.status === "reading");
  if (h.status === "idle") return null;

  let text: string;
  if (h.status === "reading") {
    const elapsed = h.startedAt !== null && now > 0 ? Math.max(0, now - h.startedAt) : 0;
    text =
      h.progress && h.progress.total > 0
        ? `Reading your keys' transactions from Monad · ${h.progress.found} of ${h.progress.total} · ${secs(elapsed)}`
        : `Finding your account's transactions on Monad · ${secs(elapsed)}`;
  } else if (h.status === "error") {
    text = "Couldn't read Monad just now, so this shows what this device recorded. It reads again when you come back.";
  } else {
    const r = h.result!;
    text = r.first ? `Read from Monad in ${secs(r.ms)} · ${r.read} ${r.read === 1 ? "transaction" : "transactions"} from your keys` : r.added > 0 ? `Brought up to date from Monad · ${r.added} new` : "Up to date with Monad";
  }

  return (
    <p aria-live="polite" className="flex items-center gap-2 px-1 text-[12.5px] leading-snug text-muted tnum">
      <span className={`size-1.5 shrink-0 rounded-full ${h.status === "done" ? "bg-live" : "bg-faint"} ${h.status === "reading" ? "motion-safe:animate-pulse" : ""}`} aria-hidden="true" />
      {text}
    </p>
  );
}
