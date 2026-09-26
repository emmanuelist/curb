import type { CSSProperties } from "react";
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
};

const bandLabel = (bps: bigint) => `${(Number(bps) / 100).toFixed(2)}%`;

/**
 * The lane: Kuru's live book between two curb lines the trading key may not cross.
 * Every boundary here comes from `lane`, the same numbers CurbAccount enforces (docs/BRIEF.md §6).
 */
export function CurbLane({ market, lane, bids, asks, depth, draft, step, blockStatus }: Props) {
  const shownAsks = asks.slice(0, depth);
  const shownBids = bids.slice(0, depth);
  const maxSize = [...shownAsks, ...shownBids].reduce((m, l) => (l.size > m ? l.size : m), 1n);

  // Levels past a curb line are unreachable for the trading key: they are drawn in the hatched zone.
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
    <section aria-label="The lane: prices your trading key may trade at" className="bg-lane">
      <OffBookZone position="top" label="OFF-BOOK · REFUSED ONCHAIN">
        {draftAbove && draft ? <DraftChip draft={draft} market={market} offBook /> : null}
        {asksBeyond.map((l) => (
          <BookRow key={`ab-${l.price}`} level={l} side="ask" market={market} maxSize={maxSize} beyond />
        ))}
      </OffBookZone>

      <div className="curb-line" aria-hidden="true" />
      <p className="figures flex justify-between px-5 pb-1 pt-1.5 text-[10px] tracking-wide">
        <span>MAX BUY {p(lane.maxBuy)}</span>
        <span className="text-muted">best ask +{bandLabel(lane.bandBps)}</span>
      </p>

      <ol aria-label="Asks inside the lane" className="flex flex-col px-5">
        {asksInside.map((l, i) => (
          <BookRow key={`a-${l.price}`} level={l} side="ask" market={market} maxSize={maxSize} best={i === asksInside.length - 1} />
        ))}
      </ol>

      <div className="flex h-7 items-center gap-2.5 px-5">
        {draftInLane && draft ? <DraftChip draft={draft} market={market} /> : null}
        <div
          className="lane-dashes grow opacity-85"
          data-status={blockStatus}
          style={{ "--step": step } as CSSProperties}
          aria-hidden="true"
        />
        <span className="figures shrink-0 text-[10px] text-muted">
          <span className="sr-only">Spread </span>
          {lane.spreadBps.toFixed(1)} bps
        </span>
      </div>

      <ol aria-label="Bids inside the lane" className="flex flex-col px-5">
        {bidsInside.map((l, i) => (
          <BookRow key={`b-${l.price}`} level={l} side="bid" market={market} maxSize={maxSize} best={i === 0} />
        ))}
      </ol>

      <p className="figures flex justify-between px-5 pb-1.5 pt-1 text-[10px] tracking-wide">
        <span>MIN SELL {p(lane.minSell)}</span>
        <span className="text-muted">best bid −{bandLabel(lane.bandBps)}</span>
      </p>
      <div className="curb-line" aria-hidden="true" />

      <OffBookZone position="bottom">
        {bidsBeyond.map((l) => (
          <BookRow key={`bb-${l.price}`} level={l} side="bid" market={market} maxSize={maxSize} beyond />
        ))}
        {draftBelow && draft ? <DraftChip draft={draft} market={market} offBook /> : null}
      </OffBookZone>
    </section>
  );
}

function OffBookZone({ position, label, children }: { position: "top" | "bottom"; label?: string; children?: React.ReactNode }) {
  return (
    <div className="hatch flex min-h-6 flex-col justify-center gap-0.5 py-1" data-position={position}>
      {label ? (
        <p className="flex justify-end px-5">
          <span className="bg-lane px-1.5 font-stencil text-[11px] font-extrabold tracking-[0.16em] text-muted [font-variation-settings:'opsz'_72]">
            {label}
          </span>
        </p>
      ) : null}
      {children ? <ol className="flex flex-col px-5">{children}</ol> : null}
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
  // Square-root scale keeps small levels visible next to 400k-MON walls.
  const ratio = Math.sqrt(Number(level.size) / Number(maxSize));
  const width = `${Math.max(6, Math.round(ratio * 100))}%`;
  const tone = best ? "text-road" : "text-muted";
  const size = formatSize(level.size, market.sizePrecision);
  const price = formatPrice(level.price, market.pricePrecision);

  return (
    <li className={`flex h-[23px] items-center gap-3 ${beyond ? "opacity-60" : ""}`}>
      <span className={`figures w-[4.6rem] shrink-0 text-[13px] ${tone}`}>
        <span className="sr-only">{side === "ask" ? "Ask" : "Bid"} </span>
        {price}
      </span>
      <span className="flex h-[11px] grow items-center" aria-hidden="true">
        {side === "ask" ? (
          <span className={`block h-full border-[1.5px] ${best ? "border-road" : "border-faint"}`} style={{ width }} />
        ) : (
          <span className={`block h-full ${best ? "bg-road" : "bg-muted"}`} style={{ width }} />
        )}
      </span>
      <span className={`figures w-[4.8rem] shrink-0 text-right text-[11px] ${tone}`}>
        {size}
        <span className="sr-only"> {market.base.symbol}</span>
      </span>
    </li>
  );
}

function DraftChip({ draft, market, offBook = false }: { draft: DraftOrder; market: Market; offBook?: boolean }) {
  const label = `${draft.side === "buy" ? "BUY" : "SELL"} ${formatPrice(draft.price, market.pricePrecision)}`;
  return offBook ? (
    <li className="list-none px-0 py-0.5">
      <span className="figures inline-block bg-road px-1.5 py-0.5 text-[11px] font-semibold text-asphalt">
        NEW {label} · off the lane
      </span>
    </li>
  ) : (
    <span className="figures shrink-0 border-[1.5px] border-dashed border-road px-1.5 py-0.5 text-[11px] font-semibold">
      NEW {label}
    </span>
  );
}
