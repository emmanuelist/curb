"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRightLeft, ArrowUpFromLine, Ban, ChevronRight } from "lucide-react";
import { KeyGlyph } from "@/components/keys/signer";
import { useState } from "react";
import { BlockIndicator } from "@/components/curb/block-indicator";
import { CurbLane } from "@/components/curb/curb-lane";
import { OrderTicket, readTicket, type TicketState } from "@/components/trading/order-ticket";
import { PriceDisplay } from "@/components/trading/price-display";
import { TradeHero } from "@/components/trading/trade-hero";
import { formatPrice, shortAddress } from "@/lib/format";
import { MON_USDC } from "@/lib/markets/registry";
import { useAccount } from "@/hooks/use-account";
import { useLiveBlock } from "@/hooks/use-live-block";
import { useMarket } from "@/hooks/use-market";

const market = MON_USDC;

/** Trade: market, price, live block, the lane, the ticket, and who signs (BRIEF §7 hierarchy). */
export function TradeScreen() {
  const { snapshot, lane, error } = useMarket(market);
  const liveBlock = useLiveBlock();
  const { step, status } = liveBlock;
  // A null price means "follow the book": the draft joins the best bid (buy) or best ask (sell) until typed over.
  const [draftState, setDraftState] = useState<{ side: TicketState["side"]; priceText: string | null; sizeText: string }>({
    side: "buy",
    priceText: null,
    sizeText: "200",
  });
  const followed =
    lane?.status === "open" ? formatPrice(draftState.side === "buy" ? lane.bid : lane.ask, market.pricePrecision) : "";
  const ticket: TicketState = { side: draftState.side, sizeText: draftState.sizeText, priceText: draftState.priceText ?? followed };

  const reading = readTicket(market, lane, ticket);
  const draft =
    reading.price !== null && reading.placement && reading.placement.kind !== "invalid"
      ? { side: ticket.side, price: reading.price, placement: reading.placement }
      : null;

  const onTicket = (next: TicketState) =>
    setDraftState((d) => ({
      side: next.side,
      sizeText: next.sizeText,
      priceText: next.priceText !== ticket.priceText ? next.priceText : d.priceText,
    }));

  const mid = lane?.status === "open" ? lane.mid : null;

  return (
    <>
      <TradeHero
        market={market}
        lane={lane}
        bids={snapshot?.book.bids ?? []}
        asks={snapshot?.book.asks ?? []}
        block={liveBlock}
        draft={{ side: ticket.side, sizeText: ticket.sizeText, priceText: ticket.priceText }}
      />
      <main className="mx-auto grid w-full max-w-[1480px] gap-4 px-4 pb-32 md:grid-cols-2 md:gap-6 md:px-8 md:pb-12 md:pt-8 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)_minmax(0,0.95fr)]">
        <div className="hidden flex-col gap-6 md:col-span-2 md:flex xl:col-span-1">
          <MarketPanel market={market} mid={mid} lane={lane} snapshot={snapshot} className="grow" />
          <KeyLimits className="hidden xl:block" />
        </div>

        <div className="md:order-none">
          {error && !snapshot ? (
            <LaneMessage title="Can't reach Monad right now." body="Kuru's book couldn't be read from the public RPC. Curb retries on its own; nothing is shown until it's real." />
          ) : !snapshot || !lane ? (
            <LaneSkeleton />
          ) : lane.status !== "open" ? (
            <LaneMessage
              title="No lane right now."
              body={lane.reason === "crossed" ? "Kuru's book is crossed for a moment. The lane returns with the next clean block." : "One side of Kuru's book is empty, so there is nothing to trade against."}
            />
          ) : (
            <>
              <div className="md:hidden">
                <CurbLane market={market} lane={lane} bids={snapshot.book.bids} asks={snapshot.book.asks} depth={4} draft={draft} step={step} blockStatus={status} />
              </div>
              <div className="hidden md:block">
                <CurbLane market={market} lane={lane} bids={snapshot.book.bids} asks={snapshot.book.asks} depth={9} draft={draft} step={step} blockStatus={status} />
              </div>
            </>
          )}
        </div>

        <div id="ticket" className="flex scroll-mt-4 flex-col gap-4">
          <OrderTicket market={market} lane={lane} value={ticket} onChange={onTicket} />
          <AccountStrip />
          <KeyLimits className="hidden md:block xl:hidden" />
        </div>
      </main>
    </>
  );
}

/** Desktop and tablet: the hero's photograph and stencil price, as one panel. Live status lives in the top bar. */
function MarketPanel({
  market,
  mid,
  lane,
  snapshot,
  className,
}: {
  market: typeof MON_USDC;
  mid: bigint | null;
  lane: ReturnType<typeof useMarket>["lane"];
  snapshot: ReturnType<typeof useMarket>["snapshot"];
  className?: string;
}) {
  const open = lane?.status === "open" ? lane : null;
  return (
    <section aria-label="Market" className={`panel relative isolate flex min-h-[440px] flex-col justify-between overflow-hidden p-6 ${className ?? ""}`}>
      <Image src="/plates/curb-photo.png" alt="" fill sizes="(min-width: 1280px) 33vw, 100vw" className="pointer-events-none -z-10 object-cover object-[70%_100%]" priority />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgb(11_13_15/0.94)_0%,rgb(11_13_15/0.88)_50%,rgb(11_13_15/0.12)_76%,rgb(11_13_15/0.6)_100%)]" aria-hidden="true" />
      <div>
        <div className="flex items-start justify-between gap-4">
          <p className="text-[22px] font-medium text-road">
            {market.base.symbol} / {market.quote.symbol}
          </p>
          {/* Tablet only: the top bar has no room for the live pill below lg. */}
          <div className="lg:hidden">
            <BlockIndicator />
          </div>
        </div>
        <PriceDisplay market={market} mid={mid} className="mt-1" />
        {open ? (
          <p className="mt-3 flex items-center gap-2 text-[15px] text-road tnum">
            <ArrowRightLeft size={16} strokeWidth={2} aria-hidden="true" />
            Spread {formatPrice(open.ask - open.bid, market.pricePrecision)} <span className="text-muted">({open.spreadBps.toFixed(1)} bps)</span>
          </p>
        ) : null}
      </div>
      {snapshot ? (
        <p className="mt-10 text-[12px] text-muted tnum">
          Book read at block {snapshot.block.toLocaleString("en-US")} · {snapshot.book.bids.length} bids, {snapshot.book.asks.length} asks on Kuru
        </p>
      ) : null}
    </section>
  );
}

function AccountStrip() {
  const account = useAccount();
  if (!account) return null;
  return (
    <div className="panel flex items-center justify-between gap-3 py-2 pl-4 pr-2">
      <p className="flex min-w-0 items-center gap-2 text-[13px] text-muted">
        <KeyGlyph role="trading" />
        <span className="truncate">
          Trading key <span className="text-road tnum">{shortAddress(account.trading)}</span>
        </span>
      </p>
      <Link href="/keys" className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-kerb hover:bg-high">
        Keys &amp; deposit <ChevronRight size={16} aria-hidden="true" />
      </Link>
    </div>
  );
}

/** The thesis, stated where the trading happens: what the trading key can and can't do. */
function KeyLimits({ className = "" }: { className?: string }) {
  const rows = [
    { icon: ArrowRightLeft, title: "Trade inside the lane", body: "Kuru's live best price ±0.50%", verdict: "Allowed", tone: "text-road" },
    { icon: Ban, title: "Trade off the lane", body: "Past either curb line", verdict: "Refused", tone: "text-muted" },
    { icon: ArrowUpFromLine, title: "Withdraw funds", body: "Needs Face ID", verdict: "Owner key", tone: "text-kerb" },
  ] as const;
  return (
    <section aria-labelledby="key-limits" className={`panel p-5 ${className}`}>
      <h2 id="key-limits" className="flex items-center gap-2 text-[15px] font-semibold text-road">
        <KeyGlyph role="trading" /> What the trading key can do
      </h2>
      <ul className="mt-4 flex flex-col divide-y divide-rule">
        {rows.map(({ icon: Icon, title, body, verdict, tone }) => (
          <li key={title} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-rule bg-asphalt text-road">
              <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <span className="min-w-0 grow">
              <span className="block text-[14px] font-medium text-road">{title}</span>
              <span className="block text-[12px] text-muted">{body}</span>
            </span>
            <span className={`shrink-0 text-[12px] font-semibold ${tone}`}>{verdict}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LaneSkeleton() {
  return (
    <div className="panel overflow-hidden p-5" aria-busy="true" aria-label="Reading Kuru's book">
      <div className="hatch h-6 rounded-[9px]" />
      <div className="curb-line mt-3" />
      <div className="flex h-[240px] items-center justify-center">
        <p className="text-[13px] text-muted">Reading Kuru&apos;s book…</p>
      </div>
      <div className="curb-line" />
      <div className="hatch mt-3 h-6 rounded-[9px]" />
    </div>
  );
}

function LaneMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="panel px-5 py-8" role="status">
      <p className="font-semibold">{title}</p>
      <p className="mt-1.5 text-[13px] leading-snug text-muted">{body}</p>
    </div>
  );
}
