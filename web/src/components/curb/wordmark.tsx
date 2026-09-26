import Link from "next/link";

/** CURB, stencilled like road lettering, with two lane slashes. */
export function Wordmark() {
  return (
    <Link href="/" aria-label="Curb, trade" className="flex items-center gap-2 leading-none">
      <span className="font-stencil text-[27px] font-extrabold tracking-[0.08em] [font-variation-settings:'opsz'_72]">CURB</span>
      <svg width="22" height="18" viewBox="0 0 22 18" aria-hidden="true" className="text-road">
        <path d="M6 1 1 17M14 1 9 17" stroke="currentColor" strokeWidth="3.2" strokeLinecap="square" />
      </svg>
    </Link>
  );
}
