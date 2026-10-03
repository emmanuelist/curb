"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { MARKETS, type Market } from "@/lib/markets/registry";
import { marketLabel, selectMarket, venueName } from "@/lib/markets/selected";

const detail = (m: Market) => (m.venue === "perpl" ? `Perpetual on Perpl · ${m.quote.symbol} collateral` : `Spot on Kuru`);

/** Desktop and tablet: the two markets side by side. Selection is road white, never yellow (selection isn't money). */
export function MarketTabs({ market }: { market: Market }) {
  if (MARKETS.length < 2) return <p className="text-[22px] font-medium text-road">{marketLabel(market)}</p>;
  return (
    <div role="radiogroup" aria-label="Market" className="grid grid-cols-2 gap-1.5 rounded-[12px] border border-rule bg-asphalt/80 p-1 backdrop-blur-sm">
      {MARKETS.map((m) => (
        <button
          key={m.id}
          type="button"
          role="radio"
          aria-checked={m.id === market.id}
          onClick={() => selectMarket(m)}
          className={`min-h-11 rounded-[9px] px-3 text-left transition-colors ${
            m.id === market.id ? "border border-road bg-high text-road" : "border border-transparent text-muted hover:text-road"
          }`}
        >
          <span className="block text-[14px] font-semibold">{marketLabel(m)}</span>
          <span className="block text-[11.5px] text-muted">{m.venue === "perpl" ? "Perpl perpetual" : "Kuru spot"}</span>
        </button>
      ))}
    </div>
  );
}

/** Phone: the hero's market name opens a short list of the two markets. */
export function MarketMenuButton({ market, className = "" }: { market: Market; className?: string }) {
  const [open, setOpen] = useState(false);
  const single = MARKETS.length < 2;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={root} className={`relative ${className}`}>
      {single ? (
        <p className="flex h-[44px] items-center px-[22px] text-[23px] font-medium tracking-[0.01em] text-road">{marketLabel(market)}</p>
      ) : (
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((o) => !o)}
          className="flex h-[44px] items-center gap-1.5 px-[22px] text-[23px] font-medium tracking-[0.01em] text-road"
        >
          {marketLabel(market)}
          <ChevronDown size={20} strokeWidth={2} className={`mt-0.5 text-road transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}
      {open ? (
        <ul id={id} role="listbox" aria-label="Market" className="panel absolute left-[16px] top-[46px] z-20 w-[min(320px,calc(100vw-32px))] p-1.5">
          {MARKETS.map((m) => (
            <li key={m.id} role="option" aria-selected={m.id === market.id}>
              <button
                type="button"
                onClick={() => {
                  selectMarket(m);
                  setOpen(false);
                }}
                className="flex min-h-14 w-full items-center gap-3 rounded-[10px] px-3 text-left hover:bg-high"
              >
                <span className="grow">
                  <span className="block text-[15px] font-semibold text-road">{marketLabel(m)}</span>
                  <span className="block text-[12px] text-muted">{detail(m)}</span>
                </span>
                {m.id === market.id ? <Check size={18} className="text-road" aria-label={`Selected, ${venueName(m)}`} /> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
