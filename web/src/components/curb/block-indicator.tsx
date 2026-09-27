"use client";

import { formatBlock } from "@/lib/format";
import { useLiveBlock, type BlockStatus } from "@/hooks/use-live-block";

const STATUS_LABEL: Record<BlockStatus, string> = {
  connecting: "Connecting",
  live: "Live",
  stalled: "Stalled",
  error: "Offline",
};

/** Monad's block stream as a status pill: the dot pulses only when a block actually arrives. */
export function BlockIndicator() {
  const { block, status, step, avgIntervalMs } = useLiveBlock();
  const live = status === "live";
  return (
    <p
      role="status"
      aria-label={block === null ? "Connecting to Monad" : `Monad block ${formatBlock(block)}, ${STATUS_LABEL[status].toLowerCase()}`}
      className="inline-flex h-10 items-center gap-2.5 rounded-full border border-rule bg-panel pl-3.5 pr-4 text-[13px]"
    >
      <span key={step} className={`size-2 rounded-full ${live ? "block-pulse bg-live [--pulse:var(--live)]" : status === "error" ? "border border-muted" : "bg-faint"}`} aria-hidden="true" />
      <span className={live ? "text-live" : "text-muted"} aria-hidden="true">
        {STATUS_LABEL[status]}
        {live && avgIntervalMs ? <span className="ml-1.5 font-display font-semibold text-road [font-variation-settings:'wdth'_80]">≈ {Math.round(avgIntervalMs)}ms</span> : null}
      </span>
      <span className="h-4 w-px bg-rule-strong" aria-hidden="true" />
      <span className="text-road tnum" aria-hidden="true">
        Block {block === null ? "—" : formatBlock(block)}
      </span>
    </p>
  );
}
