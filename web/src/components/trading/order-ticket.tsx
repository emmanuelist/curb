import { Fragment, useId, useState } from "react";
import { formatPrice, formatToken, parseDecimal } from "@/lib/format";
import { placeOrder, type Lane, type Placement, type Side } from "@/lib/lane";
import type { Market } from "@/lib/markets/registry";
import { Signer } from "@/components/keys/signer";
import { RefusedMoment, type RefusedView } from "@/components/curb/refused";
import { PerpPlaceOrder } from "@/components/trading/perp-place-order";
import { PlaceOrder } from "@/components/trading/place-order";
import { ProveCap, ProveOffLane } from "@/components/trading/prove-off-lane";
import { venueName } from "@/lib/markets/selected";
import { useCurbAccount } from "@/hooks/use-curb-account";

/** `leverage` (hundredths: 200 = 2x) only means something on a Perpl market. */
export type TicketState = { side: Side; priceText: string; sizeText: string; leverage?: number };

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

/** Leverage the ticket offers on a perpetual, in hundredths. Choices above the account's cap are drawn past a curb. */
const LEVERAGE = [100, 200, 300, 500, 1000] as const;

export function OrderTicket({ market, lane, value, onChange }: Props) {
  const id = useId();
  const [refused, setRefused] = useState<RefusedView | null>(null);
  const { state } = useCurbAccount();
  const perps = market.venue === "perpl";
  // The account's cap on this perpetual; before the account exists, the cap every new account starts with.
  const cap = state?.perps.capHdths ?? 500;
  const leverage = value.leverage ?? 200;
  const overCap = perps && leverage > cap;
  const words = perps ? { buy: "Long", sell: "Short" } : { buy: "Buy", sell: "Sell" };
  const r = readTicket(market, lane, value);
  const p = (x: bigint) => formatPrice(x, market.pricePrecision);
  const minSize = (market.minSize / market.sizePrecision).toString();
  const offBook = r.placement?.kind === "off-book" ? r.placement : null;

  let hint = "";
  if (lane?.status === "open" && r.price !== null && r.placement?.kind === "in-lane") {
    if (value.side === "buy") {
      hint = r.price >= lane.ask ? "takes the best ask" : r.price === lane.bid ? "joins the best bid" : r.price > lane.bid ? "inside the spread" : "rests below the best bid";
    } else {
      hint = r.price <= lane.bid ? "takes the best bid" : r.price === lane.ask ? "joins the best ask" : r.price < lane.ask ? "inside the spread" : "rests above the best ask";
    }
  }

  // A refusal shows where it happened. Past a curb, the ticket then goes back to the curb the account named (BRIEF §11):
  // the lane's price, or the leverage cap.
  const onRefused = (view: RefusedView) => {
    const { limit, capHdths } = view.refusal;
    if (capHdths !== undefined) {
      setRefused({ ...view, after: `Your ticket is back at your cap, ${capHdths / 100}×.` });
      onChange({ ...value, leverage: capHdths });
      return;
    }
    if (limit === undefined) {
      setRefused(view);
      return;
    }
    setRefused({ ...view, after: `Your ticket is back at the curb, ${p(limit)}.` });
    onChange({ ...value, priceText: p(limit) });
  };

  const problem =
    r.placement?.kind === "invalid" && r.placement.reason === "not-on-tick"
      ? "Prices move in steps of 0.000001."
      : r.tooSmall
        ? `The smallest order on ${venueName(market)} is ${minSize} ${market.base.symbol}.`
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
            {words[side]}
          </button>
        ))}
      </div>

      <Field
        id={`${id}-size`}
        label="Amount"
        unit={market.base.symbol}
        value={value.sizeText}
        onChange={(v) => onChange({ ...value, sizeText: v })}
        helper={
          r.notional !== null
            ? perps
              ? `≈ ${formatToken(r.notional, market.quote.decimals)} ${market.quote.symbol} notional · margin ≈ ${formatToken((r.notional * 100n) / BigInt(leverage), market.quote.decimals)} at ${leverage / 100}×`
              : `≈ ${formatToken(r.notional, market.quote.decimals)} ${market.quote.symbol} · min ${minSize}`
            : `min ${minSize} ${market.base.symbol}`
        }
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

      {perps ? (
        <fieldset>
          <legend className="mb-2 flex w-full items-center justify-between text-[12px] text-muted">
            <span>Leverage</span>
            <span>
              Your cap <span className="font-semibold text-road">{cap / 100}×</span> · set by the <span className="text-kerb">owner key</span>
            </span>
          </legend>
          <div role="radiogroup" aria-label="Leverage" className="flex gap-1.5">
            {LEVERAGE.map((l, i) => {
              const past = l > cap;
              // The cap is a curb, drawn like the lane's: once, between the last choice under it and the first past it.
              const curb = past && (i === 0 || LEVERAGE[i - 1] <= cap);
              return (
                <Fragment key={l}>
                  {curb ? <span className="w-[7px] shrink-0 border-x-2 border-road" aria-hidden="true" /> : null}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={leverage === l}
                    aria-label={past ? `${l / 100}x, over your cap` : `${l / 100}x`}
                    onClick={() => onChange({ ...value, leverage: l })}
                    className={`h-11 min-w-0 flex-1 rounded-[10px] border text-[14px] font-semibold tnum transition-colors ${past ? "hatch border-dashed" : ""} ${
                      leverage === l ? "border-road bg-high text-road" : past ? "border-faint text-muted" : "border-rule text-muted hover:text-road"
                    }`}
                  >
                    {l / 100}×
                  </button>
                </Fragment>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <div id={`${id}-status`} aria-live="polite" className="min-h-5 text-[13px] leading-snug">
        {overCap ? (
          <p className="text-muted">
            <span className="font-semibold text-road">Over your cap.</span> The cap is <span className="text-road tnum">{cap / 100}×</span>. The contract would refuse {leverage / 100}×, so
            Curb won&apos;t send it.
          </p>
        ) : offBook ? (
          <p className="text-muted">
            <span className="font-semibold text-road">Off the lane.</span> {value.side === "buy" ? "Max buy" : "Min sell"} is{" "}
            <span className="text-road tnum">{p(offBook.limit)}</span>. The contract would refuse this, so Curb won&apos;t send it.
          </p>
        ) : problem ? (
          <p className="text-muted">{problem}</p>
        ) : lane?.status === "no-market" ? (
          <p className="text-muted">{venueName(market)}&apos;s book is empty on one side, so there is no lane to trade in.</p>
        ) : (
          <Signer role="trading" detail="held to the lane" />
        )}
      </div>

      {refused ? <RefusedMoment key={refused.hash} view={refused} onDismiss={() => setRefused(null)} /> : null}

      {overCap ? (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => onChange({ ...value, leverage: cap })}
              className="flex h-14 flex-col items-center justify-center rounded-[12px] border border-road text-[15px] font-semibold leading-tight"
            >
              Use your cap
              <span className="text-[12px] font-normal text-muted tnum">{cap / 100}×</span>
            </button>
            <button type="button" disabled className="hatch h-14 rounded-[12px] border border-dashed border-faint text-[15px] font-semibold text-muted">
              Over the cap
            </button>
          </div>
          {r.price !== null ? <ProveCap market={market} side={value.side} price={r.price} size={r.size} leverageHdths={leverage} capHdths={cap} onRefused={onRefused} /> : null}
        </div>
      ) : offBook ? (
        <div className="flex flex-col gap-2.5">
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
          {r.price !== null ? (
            <ProveOffLane market={market} side={value.side} price={r.price} size={r.size} leverageHdths={leverage} capHdths={cap} onRefused={onRefused} />
          ) : null}
        </div>
      ) : perps ? (
        <PerpPlaceOrder
          market={market}
          lane={lane}
          action={value.side === "buy" ? "open-long" : "open-short"}
          price={r.price}
          lots={r.size}
          leverageHdths={leverage}
          notional={r.notional}
          onRefused={onRefused}
          blocked={problem !== null || r.price === null || r.size === null || r.placement?.kind !== "in-lane" || lane?.status !== "open"}
        />
      ) : (
        <PlaceOrder
          market={market}
          lane={lane}
          side={value.side}
          price={r.price}
          size={r.size}
          notional={r.notional}
          onRefused={onRefused}
          blocked={problem !== null || r.price === null || r.size === null || r.placement?.kind !== "in-lane" || lane?.status !== "open"}
        />
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
