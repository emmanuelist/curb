"use client";

import type { CSSProperties } from "react";
import { formatPrice } from "@/lib/format";
import { MON_USDC } from "@/lib/markets/registry";
import { useLiveBlock } from "@/hooks/use-live-block";
import { useMarket } from "@/hooks/use-market";

const market = MON_USDC;

/** The board's "Order lane preview": where an order may rest right now, live from Kuru, between the two curbs. */
export function LanePreview() {
  const { lane } = useMarket(market);
  const { step, status } = useLiveBlock();
  const open = lane?.status === "open" ? lane : null;
  const p = (x: bigint) => formatPrice(x, market.pricePrecision);

  return (
    <section aria-labelledby="lane-preview-h" className="panel rise overflow-hidden p-5" style={{ "--i": 2 } as CSSProperties}>
      <header className="flex items-baseline justify-between gap-3">
        <h2 id="lane-preview-h" className="text-[15px] font-semibold text-road">
          Order lane preview
        </h2>
        <p className="text-[12px] text-muted">
          {market.base.symbol} / {market.quote.symbol} · Kuru
        </p>
      </header>

      {/* The trade lane's grammar: hatching only beyond the curbs, plain asphalt and live dashes between them. */}
      <div className="mt-4" aria-live="off">
        <div className="hatch h-3 rounded-[6px]" aria-hidden="true" />
        <div className="curb-line mt-2" aria-hidden="true" />
        <Edge label="Max buy" value={open ? p(open.maxBuy) : "—"} />
        <Level label="Ask" value={open ? p(open.ask) : "—"} />
        <div className="flex h-7 items-center" aria-hidden="true">
          <span className="size-2 shrink-0 rounded-full bg-road" />
          <div className="lane-dashes ml-2 grow" data-status={status} style={{ "--step": step } as CSSProperties} />
        </div>
        <Level label="Bid" value={open ? p(open.bid) : "—"} />
        <Edge label="Min sell" value={open ? p(open.minSell) : "—"} />
        <div className="curb-line" aria-hidden="true" />
        <div className="hatch mt-2 h-3 rounded-[6px]" aria-hidden="true" />
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
        {open
          ? "Your orders rest between these curbs. Past either one, your Curb account refuses them."
          : lane
            ? "No lane right now: Kuru's book is empty on one side or crossed for a moment."
            : "Reading Kuru's book…"}
      </p>
    </section>
  );
}

function Edge({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between py-1.5 text-[12px]">
      <span className="text-muted">{label}</span>
      <span className="text-road tnum">{value}</span>
    </p>
  );
}

function Level({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between py-2">
      <span className="text-[14px] font-medium text-road">{label}</span>
      <span className="font-display text-[20px] font-semibold text-road tnum [font-variation-settings:'wdth'_70]">{value}</span>
    </p>
  );
}
