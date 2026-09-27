import Link from "next/link";
import { useId } from "react";
import { ArrowRight } from "lucide-react";
import { useAccount } from "@/hooks/use-account";
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
  const account = useAccount();
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
    <section aria-label="New order" className="panel flex flex-col gap-4 p-4">
      <div role="radiogroup" aria-label="Side" className="grid grid-cols-2 gap-1.5 rounded-[12px] border border-rule bg-asphalt p-1">
        {(["buy", "sell"] as const).map((side) => (
          <button
            key={side}
            type="button"
            role="radio"
            aria-checked={value.side === side}
            onClick={() => onChange({ ...value, side })}
            className={`h-11 rounded-[9px] text-[15px] font-semibold transition-colors ${
              value.side === side ? "border border-road bg-high text-road" : "border border-transparent text-muted hover:text-road"
            }`}
          >
            {side === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      <Field
        id={`${id}-size`}
        label="Amount"
        unit={market.base.symbol}
        value={value.sizeText}
        onChange={(v) => onChange({ ...value, sizeText: v })}
        helper={r.notional !== null ? `≈ ${formatToken(r.notional, market.quote.decimals)} ${market.quote.symbol} · min ${minSize}` : `min ${minSize} ${market.base.symbol}`}
      />
      <Field
        id={`${id}-price`}
        label="Price"
        unit={market.quote.symbol}
        value={value.priceText}
        onChange={(v) => onChange({ ...value, priceText: v })}
        helper={offBook ? "past the curb" : hint || "\u00a0"}
        invalid={offBook !== null || problem !== null}
        describedBy={`${id}-status`}
        hatched={offBook !== null}
      />

      <div id={`${id}-status`} aria-live="polite" className="min-h-5 text-[13px] leading-snug">
        {offBook ? (
          <p className="text-muted">
            <span className="font-semibold text-road">Off the lane.</span> {value.side === "buy" ? "Max buy" : "Min sell"} is{" "}
            <span className="text-road tnum">{p(offBook.limit)}</span>. The contract would refuse this, so Curb won&apos;t send it.
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
            className="flex h-14 flex-col items-center justify-center rounded-[12px] border border-road text-[15px] font-semibold leading-tight"
          >
            Snap to curb
            <span className="text-[12px] font-normal text-muted tnum">{p(offBook.limit)}</span>
          </button>
          <button type="button" disabled className="hatch h-14 rounded-[12px] border border-dashed border-faint text-[15px] font-semibold text-muted">
            Off the lane
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {account ? (
            <>
              <button
                type="button"
                disabled
                aria-describedby={`${id}-notlive`}
                className="btn btn-primary w-full"
              >
                {sideWord === "BUY" ? "Buy" : "Sell"} {value.sizeText || "—"} {market.base.symbol}
              </button>
              <p id={`${id}-notlive`} className="text-center text-[12px] text-muted">
                Orders go live with the Curb account contract.
              </p>
            </>
          ) : (
            <>
              <Link
                href="/start"
                className="btn btn-primary w-full"
              >
                Create your account to trade
                <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
              </Link>
              <p className="text-center text-[12px] text-muted">One passkey makes both keys. No seed phrase.</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function Field({
  id,
  label,
  unit,
  value,
  onChange,
  helper,
  invalid = false,
  describedBy,
  hatched = false,
}: {
  id: string;
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  helper: string;
  invalid?: boolean;
  describedBy?: string;
  hatched?: boolean;
}) {
  return (
    <label htmlFor={id} className={`block rounded-[12px] border bg-asphalt px-4 pb-2.5 pt-3 transition-colors focus-within:border-road ${invalid ? "border-road" : "border-rule"} ${hatched ? "hatch" : ""}`}>
      <span className="flex items-center justify-between text-[12px] text-muted">
        {label}
        <span className="font-medium text-road">{unit}</span>
      </span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-transparent font-display text-[26px] font-semibold text-road outline-none tnum [font-variation-settings:'wdth'_75]"
      />
      <span className="block text-[12px] text-muted tnum">{helper}</span>
    </label>
  );
}
