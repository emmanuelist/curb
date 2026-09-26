import { formatPrice } from "@/lib/format";
import type { Market } from "@/lib/markets/registry";

/**
 * The mid price, compressed and huge. Re-keyed on change so the width axis settles once
 * per real price move, and never otherwise (BRIEF §5, §15).
 */
export function PriceDisplay({ market, mid, className = "" }: { market: Market; mid: bigint | null; className?: string }) {
  const text = mid === null ? "—" : formatPrice(mid, market.pricePrecision);
  return (
    <div className={className}>
      <p
        key={text}
        className="price-settle font-display font-extrabold leading-[0.9] tracking-[-0.02em] [font-variation-settings:'wdth'_62]"
        aria-label={mid === null ? "Price loading" : `Mid price ${text} ${market.quote.symbol}`}
      >
        {text}
      </p>
      <p className="mt-1.5 text-[12px] text-muted">Mid price, read live from Kuru&apos;s onchain book</p>
    </div>
  );
}
