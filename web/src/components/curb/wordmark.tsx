import Link from "next/link";

/** CURB in street lettering, with two painted kerb slashes (the brand's one fixed use of kerb yellow). */
export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  const text = size === "lg" ? "text-[36px]" : "text-[33px]";
  return (
    <Link href="/" aria-label="Curb, trade" className="flex items-center gap-2 leading-none text-road">
      <span className={`font-stencil ${text} font-extrabold tracking-[0.02em]`}>CURB</span>
      {/* Filled parallelograms, as thick as the letter stems: painted road marks, not strokes. */}
      <svg width="34" height="24" viewBox="0 0 34 24" aria-hidden="true" className="text-kerb">
        <path d="M9.5 0H17L8 24H0.5Z M26 0H33.5L24.5 24H17Z" fill="currentColor" />
      </svg>
    </Link>
  );
}
