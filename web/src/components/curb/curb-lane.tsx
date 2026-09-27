import type { CSSProperties, ReactNode } from "react";
import type { Level } from "@/lib/kuru/book";
import type { Lane, Placement, Side } from "@/lib/lane";
import type { Market } from "@/lib/markets/registry";
import { formatPrice, formatSize } from "@/lib/format";
import type { BlockStatus } from "@/hooks/use-live-block";

export type DraftOrder = { side: Side; price: bigint; placement: Placement };

type Props = {
  market: Market;
  lane: Extract<Lane, { status: "open" }>;
  bids: Level[];
  asks: Level[];
  /** Levels drawn per side. */
  depth: number;
  draft?: DraftOrder | null;
  /** From the live block stream: dashes advance only when blocks arrive. */
  step: number;
  blockStatus: BlockStatus;
  title?: string;
};

const bandLabel = (bps: bigint) => `${(Number(bps) / 100).toFixed(2)}%`;

/**
 * The order lane: Kuru's live book between two curb lines the trading key may not cross. Every boundary here
 * comes from `lane`, the same numbers CurbAccount enforces (docs/BRIEF.md §6). Levels past a curb are drawn
 * inside the hatched off-book zone, where the trading key can't reach them.
 */
export function CurbLane({ market, lane, bids, asks, depth, draft, step, blockStatus, title = "Order lane" }: Props) {
  const shownAsks = asks.slice(0, depth);
  const shownBids = bids.slice(0, depth);
  const maxSize = [...shownAsks, ...shownBids].reduce((m, l) => (l.size > m ? l.size : m), 1n);

  const asksBeyond = shownAsks.filter((l) => l.price > lane.maxBuy).reverse();
  const asksInside = shownAsks.filter((l) => l.price <= lane.maxBuy).reverse();
  const bidsInside = shownBids.filter((l) => l.price >= lane.minSell);
  const bidsBeyond = shownBids.filter((l) => l.price < lane.minSell);

  const offBook = draft?.placement.kind === "off-book";
  const draftAbove = offBook && draft?.side === "buy";
  const draftBelow = offBook && draft?.side === "sell";
  const draftInLane = draft?.placement.kind === "in-lane";
  const p = (price: bigint) => formatPrice(price, market.pricePrecision);

  return (
    <section aria-label="Order lane: the prices your trading key may trade at" className="panel overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <h2 className="text-[15px] font-semibold text-road">{title}</h2>
        <p className="text-[12px] text-muted">
          Kuru ±{bandLabel(lane.bandBps)} · <span className="tnum">{lane.spreadBps.toFixed(1)} bps</span> spread
        </p>
      </header>

      <OffBook label="Off-book · refused onchain">
        {draftAbove && draft ? <DraftChip draft={draft} market={market} offBook /> : null}
        {asksBeyond.map((l) => (
          <BookRow key={`ab-${l.price}`} level={l} side="ask" market={market} maxSize={maxSize} beyond />
        ))}
      </OffBook>

      <CurbEdge label="Max buy" value={p(lane.maxBuy)} note={`best ask +${bandLabel(lane.bandBps)}`} />

      <ol aria-label="Asks inside the lane" className="flex flex-col px-5 py-1">
        {asksInside.map((l, i) => (
          <BookRow key={`a-${l.price}`} level={l} side="ask" market={market} maxSize={maxSize} best={i === asksInside.length - 1} />
        ))}
      </ol>

      <div className="flex h-8 items-center gap-2.5 px-5">
        {draftInLane && draft ? <DraftChip draft={draft} market={market} /> : <span className="size-2.5 shrink-0 rounded-full bg-road" aria-hidden="true" />}
        <div className="lane-dashes grow opacity-90" data-status={blockStatus} style={{ "--step": step } as CSSProperties} aria-hidden="true" />
      </div>

      <ol aria-label="Bids inside the lane" className="flex flex-col px-5 py-1">
        {bidsInside.map((l, i) => (
          <BookRow key={`b-${l.price}`} level={l} side="bid" market={market} maxSize={maxSize} best={i === 0} />
        ))}
      </ol>

      <CurbEdge label="Min sell" value={p(lane.minSell)} note={`best bid −${bandLabel(lane.bandBps)}`} bottom />

      <OffBook>
        {bidsBeyond.map((l) => (
          <BookRow key={`bb-${l.price}`} level={l} side="bid" market={market} maxSize={maxSize} beyond />
        ))}
        {draftBelow && draft ? <DraftChip draft={draft} market={market} offBook /> : null}
      </OffBook>
    </section>
  );
}

function CurbEdge({ label, value, note, bottom = false }: { label: string; value: string; note: string; bottom?: boolean }) {
  return (
    <div className={`px-5 ${bottom ? "pt-1" : "pb-1"}`}>
      {bottom ? null : <div className="curb-line" aria-hidden="true" />}
      <p className="flex items-baseline justify-between py-1.5 text-[12px]">
        <span className="font-medium text-road">
          {label} <span className="tnum">{value}</span>
        </span>
        <span className="text-muted">{note}</span>
      </p>
      {bottom ? <div className="curb-line" aria-hidden="true" /> : null}
    </div>
  );
}

function OffBook({ label, children }: { label?: string; children?: ReactNode }) {
  const hasRows = Array.isArray(children) ? children.flat().some(Boolean) : Boolean(children);
  return (
    <div className="mx-3 my-1 rounded-[10px] border border-rule">
      <div className="hatch rounded-[9px] px-2 py-1.5">
        {label ? (
          <p className="flex justify-end">
            <span className="rounded-full bg-panel px-2 py-0.5 font-stencil text-[11px] font-extrabold uppercase tracking-[0.14em] text-muted">{label}</span>
          </p>
        ) : null}
        {hasRows ? <ol className="flex flex-col px-2">{children}</ol> : <div className="h-2" aria-hidden="true" />}
      </div>
    </div>
  );
}

function BookRow({
  level,
  side,
  market,
  maxSize,
  best = false,
  beyond = false,
}: {
  level: Level;
  side: "ask" | "bid";
  market: Market;
  maxSize: bigint;
  best?: boolean;
  beyond?: boolean;
}) {
  const ratio = Math.sqrt(Number(level.size) / Number(maxSize));
  const width = `${Math.max(5, Math.round(ratio * 100))}%`;
  const tone = best ? "text-road" : "text-muted";
  return (
    <li className={`grid h-[26px] grid-cols-[6.4rem_minmax(0,1fr)_5.6rem] items-center gap-3 ${beyond ? "opacity-55" : ""}`}>
      <span className={`font-display text-[15px] font-semibold tnum [font-variation-settings:'wdth'_72] ${tone}`}>
        <span className="sr-only">{side === "ask" ? "Ask" : "Bid"} </span>
        {formatPrice(level.price, market.pricePrecision)}
      </span>
      <span className="flex h-[5px] items-center" aria-hidden="true">
        <span
          className={`block h-full rounded-full ${side === "ask" ? (best ? "bg-road/85" : "bg-road/30") : best ? "bg-road" : "bg-road/55"}`}
          style={{ width }}
        />
      </span>
      <span className={`text-right font-display text-[13px] tnum [font-variation-settings:'wdth'_80] ${tone}`}>
        {formatSize(level.size, market.sizePrecision)}
        <span className="sr-only"> {market.base.symbol}</span>
      </span>
    </li>
  );
}

function DraftChip({ draft, market, offBook = false }: { draft: DraftOrder; market: Market; offBook?: boolean }) {
  const label = `${draft.side === "buy" ? "Buy" : "Sell"} ${formatPrice(draft.price, market.pricePrecision)}`;
  return offBook ? (
    <li className="list-none py-1">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-road px-2.5 py-1 text-[11.5px] font-semibold text-asphalt tnum">
        {label} · off the lane
      </span>
    </li>
  ) : (
    <span className="shrink-0 rounded-full border border-dashed border-road px-2.5 py-0.5 text-[11.5px] font-semibold text-road tnum">
      Your {label.toLowerCase()}
    </span>
  );
}
