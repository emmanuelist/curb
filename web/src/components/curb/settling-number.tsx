/**
 * A live number whose changed digits settle into place. Each character is keyed by position and value, so a
 * new block only re-animates the digits that actually moved; the rest of the number stays still and crisp.
 */
export function SettlingNumber({ text, label }: { text: string; /** What a screen reader hears instead. */ label?: string }) {
  return (
    <>
      <span className="sr-only">{label ?? text}</span>
      <span aria-hidden="true">
        {text.split("").map((ch, i) => (
          <span key={`${i}-${ch}`} className={`digit-settle inline-block ${ch === "4" ? "stencil-four" : ""}`}>
            {ch}
          </span>
        ))}
      </span>
    </>
  );
}
