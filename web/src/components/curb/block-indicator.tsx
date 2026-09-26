"use client";

import { formatBlock } from "@/lib/format";
import { useLiveBlock, type BlockStatus } from "@/hooks/use-live-block";

const STATUS_LABEL: Record<BlockStatus, string> = {
  connecting: "CONNECTING",
  live: "LIVE",
  stalled: "STALLED",
  error: "OFFLINE",
};

const SEGMENTS = 6;

/** Monad's block stream, as it arrives. Nothing here moves unless a block does. */
export function BlockIndicator({ align = "end" }: { align?: "start" | "end" }) {
  const { block, status, step } = useLiveBlock();
  const lit = step % SEGMENTS;
  const live = status === "live";

  return (
    <div
      className={`flex flex-col gap-1.5 ${align === "end" ? "items-end" : "items-start"}`}
      aria-label={block === null ? "Connecting to Monad" : `Monad block ${formatBlock(block)}, ${STATUS_LABEL[status].toLowerCase()}`}
      role="status"
    >
      <p className="figures text-[10px] tracking-[0.06em] text-muted" aria-hidden="true">
        <span className={live ? "text-road" : status === "error" ? "text-stop" : ""}>{STATUS_LABEL[status]}</span>
        {" · "}
        {block === null ? "BLOCK —" : `BLOCK ${formatBlock(block)}`}
      </p>
      <div className="flex gap-[3px]" aria-hidden="true">
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span key={i} className={`h-[3px] w-[9px] ${live && i === lit ? "bg-road" : "bg-faint"}`} />
        ))}
      </div>
    </div>
  );
}
