import { useId } from "react";
import { formatPrice, formatToken, parseDecimal } from "@/lib/format";
import { placeOrder, type Lane, type Placement, type Side } from "@/lib/lane";
import type { Market } from "@/lib/markets/registry";
import { Signer } from "@/components/keys/signer";

export type TicketState = { side: Side; priceText: string; sizeText: string };

export type TicketReading = {
  price: bigint | null;
  size: bigint | null;
  placement: Placement | null;
  /** Quote units (USDC, 6 decimals). */
  notional: bigint | null;
  tooSmall: boolean;
};

/** Everything the lane and the ticket need to know about a draft, computed once. */
export function readTicket(market: Market, lane: Lane | null, t: TicketState): TicketReading {
  const price = parseDecimal(t.priceText, market.pricePrecision);
  const size = parseDecimal(t.sizeText, market.sizePrecision);
  const placement = lane && price !== null ? placeOrder(lane, t.side, price, market.tickSize) : null;
  const notional =
    price !== null && size !== null
      ? (price * size * 10n ** BigInt(market.quote.decimals)) / (market.pricePrecision * market.sizePrecision)
      : null;
  return { price, size, placement, notional, tooSmall: size !== null && size < market.minSize };
}

type Props = {
  market: Market;
  lane: Lane | null;
  value: TicketState;
  onChange: (next: TicketState) => void;
};

export function OrderTicket({ market, lane, value, onChange }: Props) {
  const id = useId();
  const r = readTicket(market, lane, value);
  const p = (x: bigint) => formatPrice(x, market.pricePrecision);
  const minSize = (market.minSize / market.sizePrecision).toString();
  const offBook = r.placement?.kind === "off-book" ? r.placement : null;
  const sideWord = value.side === "buy" ? "BUY" : "SELL";

  let hint = "";
  if (lane?.status === "open" && r.price !== null && r.placement?.kind === "in-lane") {
    if (value.side === "buy") {
      hint = r.price >= lane.ask ? "takes the best ask" : r.price === lane.bid ? "joins the best bid" : r.price > lane.bid ? "inside the spread" : "rests below the best bid";
    } else {
      hint = r.price <= lane.bid ? "takes the best bid" : r.price === lane.ask ? "joins the best ask" : r.price < lane.ask ? "inside the spread" : "rests above the best ask";
    }
  }

  const problem =
    r.placement?.kind === "invalid" && r.placement.reason === "not-on-tick"
      ? "Prices move in steps of 0.000001."
      : r.tooSmall
        ? `The smallest order on Kuru is ${minSize} ${market.base.symbol}.`
        : null;

  return (
    <section aria-label="New order" className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Side" className="grid grid-cols-2 border-[1.5px] border-road">
        {(["buy", "sell"] as const).map((side) => (
          <button
            key={side}
            type="button"
            role="radio"
            aria-checked={value.side === side}
            onClick={() => onChange({ ...value, side })}
            className={`h-11 font-display text-[15px] font-extrabold tracking-[0.08em] [font-variation-settings:'wdth'_80] ${
              value.side === side ? "bg-road text-asphalt" : "text-road"
            }`}
          >
            {side.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1" htmlFor={`${id}-price`}>
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted">PRICE · {market.quote.symbol}</span>
          <input
            id={`${id}-price`}
            className={`figures h-10 border-0 border-b-2 bg-transparent px-1 text-[19px] text-road outline-offset-4 ${
              offBook ? "hatch border-dashed border-road" : "border-road"
            }`}
            inputMode="decimal"
            autoComplete="off"
            value={value.priceText}
            aria-invalid={offBook !== null || problem !== null}
            aria-describedby={`${id}-status`}
            onChange={(e) => onChange({ ...value, priceText: e.target.value })}
          />
          <span className="text-[11px] text-muted">{offBook ? "past the curb" : hint || " "}</span>
        </label>
        <label className="flex flex-col gap-1" htmlFor={`${id}-size`}>
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted">SIZE · {market.base.symbol}</span>
          <input
            id={`${id}-size`}
            className="figures h-10 border-0 border-b-2 border-road bg-transparent px-1 text-[19px] text-road outline-offset-4"
            inputMode="decimal"
            autoComplete="off"
            value={value.sizeText}
            onChange={(e) => onChange({ ...value, sizeText: e.target.value })}
          />
          <span className="text-[11px] text-muted">
            {r.notional !== null ? `≈ ${formatToken(r.notional, market.quote.decimals)} ${market.quote.symbol}` : " "} · min {minSize}
          </span>
        </label>
      </div>

      <div id={`${id}-status`} aria-live="polite" className="min-h-5 text-[13px] leading-snug">
        {offBook ? (
          <p className="text-muted">
            <span className="font-semibold text-road">Off the lane.</span> {value.side === "buy" ? "Max buy" : "Min sell"} is{" "}
            <span className="figures text-road">{p(offBook.limit)}</span>. The contract would refuse this, so Curb won&apos;t send it.
          </p>
        ) : problem ? (
          <p className="text-muted">{problem}</p>
        ) : lane?.status === "no-market" ? (
          <p className="text-muted">Kuru&apos;s book is empty on one side, so there is no lane to trade in.</p>
        ) : (
          <Signer role="trading" detail="held to the lane" />
        )}
      </div>

      {offBook ? (
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => onChange({ ...value, priceText: p(offBook.limit) })}
            className="flex h-14 flex-col items-center justify-center rounded-[2px] border-[1.5px] border-road font-display text-[15px] font-extrabold leading-tight tracking-[0.04em] [font-variation-settings:'wdth'_75]"
          >
            SNAP TO
            <span className="figures text-[12px] font-medium tracking-normal">{p(offBook.limit)}</span>
          </button>
          <button
            type="button"
            disabled
            className="hatch h-14 rounded-[2px] border-[1.5px] border-dashed border-faint font-display text-[15px] font-extrabold tracking-[0.06em] text-muted [font-variation-settings:'wdth'_75]"
          >
            OFF THE LANE
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled
            aria-describedby={`${id}-notlive`}
            className="flex h-14 items-center justify-center gap-2.5 rounded-[2px] bg-road font-display text-[21px] font-extrabold tracking-[0.04em] text-asphalt [font-variation-settings:'wdth'_72] disabled:opacity-45"
          >
            {sideWord} {value.sizeText || "—"} {market.base.symbol}
            <span className="figures text-[13px] font-medium tracking-normal">@ {value.priceText || "—"}</span>
          </button>
          <p id={`${id}-notlive`} className="text-center text-[11px] text-muted">
            Not live yet: placing orders arrives with your Curb account.
          </p>
        </div>
      )}
    </section>
  );
}
