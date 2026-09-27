import { SettlingNumber } from "@/components/curb/settling-number";
import { formatPrice } from "@/lib/format";
import type { Market } from "@/lib/markets/registry";

/** The mid price in stencil, at full precision. Only the digits that move settle (BRIEF §5, §15). */
export function PriceDisplay({ market, mid, className = "" }: { market: Market; mid: bigint | null; className?: string }) {
  const text = mid === null ? "—" : formatPrice(mid, market.pricePrecision);
  return (
    <div className={className}>
      <p className="font-stencil text-[clamp(84px,7vw,112px)] font-bold leading-[0.94] tracking-[-0.02em] text-road">
        <SettlingNumber text={text} label={mid === null ? "Price loading" : `Mid price ${text} ${market.quote.symbol}`} />
      </p>
    </div>
  );
}
