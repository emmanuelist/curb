"use client";

import Image from "next/image";
import Link from "next/link";
import { memo } from "react";
import { ArrowRightLeft, ChevronDown, Menu } from "lucide-react";
import { SettlingNumber } from "@/components/curb/settling-number";
import { Wordmark } from "@/components/curb/wordmark";
import { formatBlock, formatPrice, formatSize } from "@/lib/format";
import type { Level } from "@/lib/kuru/book";
import type { Lane } from "@/lib/lane";
import type { Market } from "@/lib/markets/registry";
import { useBlockSelector, type BlockState } from "@/hooks/use-live-block";
import { LaneDashes } from "@/components/curb/lane-dashes";
import { MarketMenuButton } from "@/components/trading/market-switch";
import { venueName } from "@/lib/markets/selected";

type Props = {
  market: Market;
  lane: Lane | null;
  bids: Level[];
  asks: Level[];
  /** The draft the BUY bar would send: follows the best bid until the ticket changes it. */
  draftSide: "buy" | "sell";
  draftSize: string;
  draftPrice: string;
};

const STATUS: Record<BlockState["status"], string> = { connecting: "Connecting", live: "Live", stalled: "Stalled", error: "Offline" };

/**
 * The phone's first viewport, built against the approved comp (the user's concept board): the price stands
 * over a photograph of a real curb, and Kuru's best ask and bid sit either side of the lane's centre line.
 */
export const TradeHero = memo(function TradeHero({ market, lane, bids, asks, draftSide, draftSize, draftPrice }: Props) {
  const draft = { side: draftSide, sizeText: draftSize, priceText: draftPrice };
  const open = lane?.status === "open" ? lane : null;
  const p = (x: bigint) => formatPrice(x, market.pricePrecision);
  const bestAsk = asks[0];
  const bestBid = bids[0];

  // The bar measures exactly the number printed beside it: the best level's size, on one scale shared by ask and bid,
  // over a faint track. Depth beyond the top of book lives in the lane panel below.
  const topMax = (bestAsk && bestBid ? (bestAsk.size > bestBid.size ? bestAsk.size : bestBid.size) : (bestAsk ?? bestBid)?.size) || 1n;
  const pct = (v: bigint) => `${Math.max(3, Number((v * 1000n) / topMax) / 10)}%`;

  const spread = open ? open.ask - open.bid : null;

  return (
    <section aria-label="Market" className="relative isolate overflow-hidden md:hidden">
      <Image
        src="/plates/curb-photo.png"
        alt=""
        width={1170}
        height={1044}
        // The phone's LCP. Next 16 dropped `priority`, and its images default to lazy: eager + high, or it waits for layout.
        loading="eager"
        fetchPriority="high"
        // The hero is phone-only (md:hidden); from md up the smallest candidate stands in, so desktop never downloads it.
        sizes="(min-width: 768px) 1px, 100vw"
        // The plate's top fades into the ground under the header instead of starting on a hard line (the comp's edge).
        className="pointer-events-none absolute left-0 top-[55px] -z-10 h-[348px] w-full object-cover [mask-image:linear-gradient(180deg,transparent,#000_56px)]"
      />

      <header className="relative h-[54px] px-[22px] pt-[24px]">
        <Wordmark />
        <Link href="/more" aria-label="Menu" className="absolute right-[12px] top-[22px] grid size-[44px] place-items-center rounded-[12px] text-road transition-colors hover:bg-high/70">
          <Menu size={24} strokeWidth={2.4} />
        </Link>
      </header>

      <NetworkRow />

      <MarketMenuButton market={market} className="mt-[30px]" />

      <p
        className="mt-[6px] h-[76px] px-[22px] font-stencil text-[81px] font-bold leading-[0.94] tracking-[-0.02em] text-road"
      >
        <SettlingNumber text={open ? p(open.mid) : "—"} label={open ? `Mid price ${p(open.mid)} ${market.quote.symbol}` : "Price loading"} />
      </p>

      <p className="mt-[13px] flex h-[21px] items-center gap-2 px-[22px] text-[15px] text-road">
        <ArrowRightLeft size={17} strokeWidth={2} aria-hidden="true" />
        {spread !== null && open ? (
          <span className="tnum">
            Spread {p(spread)} <span className="text-muted">({open.spreadBps.toFixed(1)} bps)</span>
          </span>
        ) : (
          <span className="text-muted">Reading {venueName(market)}&apos;s book…</span>
        )}
      </p>

      <LivePill />

      <div className="mt-[43px] px-[22px]" aria-hidden="true">
        <LaneDashes className="my-1 opacity-90" />
      </div>

      <BookSide
        label="Ask"
        price={bestAsk ? p(bestAsk.price) : "—"}
        exact={bestAsk ? p(bestAsk.price) : undefined}
        size={bestAsk ? `${formatSize(bestAsk.size, market.sizePrecision)} ${market.base.symbol}` : "—"}
        bestWidth={bestAsk ? pct(bestAsk.size) : "0%"}
        rowGap={12}
        sizeTop
        joined={draft.side === "sell"}
        className="mt-[30px]"
      />

      <div className="mt-[10px] flex h-[22px] items-center gap-0 px-[18px]" aria-hidden="true">
        <span className="size-2.5 shrink-0 rounded-full bg-road" />
        <LaneDashes className="grow opacity-90" />
      </div>

      <BookSide
        label="Bid"
        price={bestBid ? p(bestBid.price) : "—"}
        exact={bestBid ? p(bestBid.price) : undefined}
        size={bestBid ? `${formatSize(bestBid.size, market.sizePrecision)} ${market.base.symbol}` : "—"}
        bestWidth={bestBid ? pct(bestBid.size) : "0%"}
        rowGap={5}
        joined={draft.side === "buy"}
        className="mt-[10px]"
      />

      <div className="px-[22px] pb-6 pt-[41px]">
        <a
          href="#ticket"
          aria-label={`Review draft: ${draft.side} ${draft.sizeText || "—"} ${market.base.symbol} at ${draft.priceText || "—"}`}
          className="flex h-[55px] items-center gap-2 rounded-[10px] border-2 border-road bg-asphalt/60 pl-[18px] pr-3.5 text-[17px] text-road transition-colors hover:bg-road/5"
        >
          <span className="font-display text-[20.5px] font-bold tracking-[0.02em] [font-variation-settings:'wdth'_80]">
            {market.venue === "perpl" ? (draft.side === "buy" ? "LONG" : "SHORT") : draft.side === "buy" ? "BUY" : "SELL"}
          </span>
          <span className="font-display text-[20.5px] font-medium tnum [font-variation-settings:'wdth'_80]">
            {draft.sizeText || "—"} {market.base.symbol} @ {draft.priceText || "—"}
          </span>
          <span className="ml-auto flex items-center gap-1 text-[13px] font-medium text-muted" aria-hidden="true">
            Review <ChevronDown size={16} strokeWidth={2} />
          </span>
        </a>
      </div>
    </section>
  );
});

/** Monad and the block height: re-renders per block on its own, never the hero around it. */
function NetworkRow() {
  const block = useBlockSelector((s) => s.block);
  const status = useBlockSelector((s) => s.status);
  const step = useBlockSelector((s) => s.step);
  const live = status === "live";
  return (
    <p className="mt-[9px] flex h-[21px] items-center gap-2 px-[22px] text-[13.5px] text-muted" role="status" aria-live="off">
      <span key={step} className={`size-2 rounded-full ${live ? "block-pulse bg-live [--pulse:var(--live)]" : status === "error" ? "border border-muted" : "bg-faint"}`} aria-hidden="true" />
      <span className="text-road">Monad</span>
      <span aria-hidden="true">•</span>
      <span className="tnum">Block {block === null ? "—" : formatBlock(block)}</span>
    </p>
  );
}

/** Live status and the measured block cadence, as the board's pill. */
function LivePill() {
  const status = useBlockSelector((s) => s.status);
  const avg = useBlockSelector((s) => (s.avgIntervalMs === null ? null : Math.round(s.avgIntervalMs)));
  const live = status === "live";
  return (
    <p className={`mt-[72px] ml-[22px] inline-flex h-[32px] w-[115px] items-center justify-center gap-1.5 rounded-full border bg-asphalt/70 transition-colors ${live ? "border-live/35" : "border-rule-strong"} text-[12px] backdrop-blur-sm`}>
      <span className={`size-1.5 rounded-full ${live ? "bg-live" : "bg-faint"}`} aria-hidden="true" />
      <span className={live ? "text-live" : "text-muted"}>{STATUS[status]}</span>
      <span className="font-display text-[13.5px] font-semibold text-road tnum [font-variation-settings:'wdth'_80]">{avg === null ? "≈ —" : `≈ ${avg}ms`}</span>
    </p>
  );
}

function BookSide({
  label,
  price,
  exact,
  size,
  bestWidth,
  rowGap,
  joined = false,
  sizeTop = false,
  className,
}: {
  label: string;
  price: string;
  /** Full-precision price for assistive tech. Shown in full too: a one-tick spread must never read as zero. */
  exact?: string;
  size: string;
  /** The best level's size, on the scale shared by both sides. */
  bestWidth: string;
  rowGap: number;
  /** The side the draft order would join: drawn larger, as the price the BUY/SELL bar quotes. */
  joined?: boolean;
  /** Size aligned to the top of the row (the ask, as the comp sets it). */
  sizeTop?: boolean;
  className?: string;
}) {
  return (
    <div className={`px-[22px] ${className ?? ""}`}>
      <p className="h-[17px] text-[15px] font-medium leading-none text-road">{label}</p>
      <div style={{ marginTop: rowGap }} className="grid h-[28px] grid-cols-[120px_minmax(0,90px)_minmax(0,1fr)] items-end">
        <span
          className={`relative font-display font-semibold tracking-[0] text-road tnum transition-[font-size] duration-200 [font-variation-settings:'wdth'_66] ${joined ? "text-[26px]" : "text-[21px]"}`}
          title={exact}
        >
          {price}
        </span>
        <span className="relative mt-[6px] block h-[4px] self-start rounded-full bg-road/12" aria-hidden="true">
          <span className="absolute inset-y-0 left-0 rounded-full bg-road transition-[width] duration-300" style={{ width: bestWidth }} />
        </span>
        <span className={`text-right font-display text-[19px] text-road/75 tnum [font-variation-settings:'wdth'_76] ${sizeTop ? "-mt-[6px] self-start" : "self-center"}`}>{size}</span>
      </div>
    </div>
  );
}
