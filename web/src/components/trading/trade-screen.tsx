"use client";

import Link from "next/link";
import { useState } from "react";
import { CurbLane } from "@/components/curb/curb-lane";
import { OrderTicket, readTicket, type TicketState } from "@/components/trading/order-ticket";
import { PriceDisplay } from "@/components/trading/price-display";
import { formatPrice, shortAddress } from "@/lib/format";
import { MON_USDC } from "@/lib/markets/registry";
import { useAccount } from "@/hooks/use-account";
import { useLiveBlock } from "@/hooks/use-live-block";
import { useMarket } from "@/hooks/use-market";

const market = MON_USDC;

/** Trade: market, price, live block, the lane, the ticket, and who signs (BRIEF §7 hierarchy). */
export function TradeScreen() {
  const { snapshot, lane, error } = useMarket(market);
  const { step, status } = useLiveBlock();
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
    <main className="mx-auto w-full max-w-[1440px] pb-24 md:pb-10 md:pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)_minmax(0,0.9fr)] lg:gap-10 lg:px-8">
      <section aria-label="Market" className="px-5 pt-1.5 lg:px-0 lg:pt-0">
        <div className="flex items-baseline justify-between">
          <h1 className="text-[12px] font-semibold tracking-[0.14em] text-muted">
            {market.base.symbol} / {market.quote.symbol}
          </h1>
          <p className="figures text-[10px] text-muted">on Kuru · Monad</p>
        </div>
        <PriceDisplay market={market} mid={mid} className="mt-1.5 text-[clamp(64px,23vw,96px)] lg:text-[clamp(88px,7.2vw,124px)]" />
        <MarketFacts snapshot={snapshot} />
      </section>

      <div className="mt-4 lg:mt-0">
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
            <div className="lg:hidden">
              <CurbLane market={market} lane={lane} bids={snapshot.book.bids} asks={snapshot.book.asks} depth={3} draft={draft} step={step} blockStatus={status} />
            </div>
            <div className="hidden lg:block">
              <CurbLane market={market} lane={lane} bids={snapshot.book.bids} asks={snapshot.book.asks} depth={11} draft={draft} step={step} blockStatus={status} />
            </div>
          </>
        )}
      </div>

      <div className="px-5 pt-4 lg:px-0 lg:pt-0">
        <OrderTicket market={market} lane={lane} value={ticket} onChange={onTicket} />
        <AccountStrip />
      </div>
    </main>
  );
}

function MarketFacts({ snapshot }: { snapshot: ReturnType<typeof useMarket>["snapshot"] }) {
  if (!snapshot) return null;
  return (
    <dl className="figures mt-5 hidden grid-cols-2 gap-x-6 gap-y-3 text-[11px] lg:grid">
      <div>
        <dt className="text-muted">BOOK READ AT</dt>
        <dd>BLOCK {snapshot.block.toLocaleString("en-US")}</dd>
      </div>
      <div>
        <dt className="text-muted">LEVELS</dt>
        <dd>
          {snapshot.book.bids.length} bids · {snapshot.book.asks.length} asks
        </dd>
      </div>
      <div className="col-span-2 border-t border-rule pt-3 font-sans text-[12px] leading-relaxed text-muted">
        The two solid lines are the only prices your trading key can trade at: half a percent past Kuru&apos;s best bid
        and ask. Your Curb account checks the same line onchain.
      </div>
    </dl>
  );
}

function AccountStrip() {
  const account = useAccount();
  return (
    <div className="mt-6 flex items-center justify-between gap-3 border-t border-rule pt-4">
      {account ? (
        <>
          <p className="figures text-[11px] text-muted">
            TRADING KEY <span className="text-road">{shortAddress(account.trading)}</span>
          </p>
          <Link href="/keys" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-kerb">
            Keys &amp; deposit
          </Link>
        </>
      ) : (
        <>
          <p className="text-[12px] text-muted">No Curb account on this device yet.</p>
          <Link href="/start" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-road underline decoration-faint underline-offset-4">
            Create with a passkey
          </Link>
        </>
      )}
    </div>
  );
}

function LaneSkeleton() {
  return (
    <div className="bg-lane" aria-busy="true" aria-label="Reading Kuru's book">
      <div className="hatch h-6" />
      <div className="curb-line" />
      <div className="flex h-[260px] items-center justify-center">
        <p className="figures text-[11px] text-muted">READING KURU&apos;S BOOK…</p>
      </div>
      <div className="curb-line" />
      <div className="hatch h-6" />
    </div>
  );
}

function LaneMessage({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-lane px-5 py-8" role="status">
      <p className="font-semibold">{title}</p>
      <p className="mt-1.5 text-[13px] leading-snug text-muted">{body}</p>
    </div>
  );
}
