/** Display helpers. Inputs are exact integers; nothing here rounds toward a nicer-looking number. */

const digitsOf = (precision: bigint) => precision.toString().length - 1;

/** `units / precision` as a fixed-point string, truncated (never rounded up) to `dp` decimals. */
export function formatFixed(units: bigint, precision: bigint, dp: number): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / precision;
  const fraction = (abs % precision).toString().padStart(digitsOf(precision), "0").slice(0, dp);
  const body = dp > 0 ? `${whole}.${fraction.padEnd(dp, "0")}` : `${whole}`;
  return negative ? `-${body}` : body;
}

/** Kuru price units → "0.026327" (6 decimals: MON-USDC ticks are 0.000001). */
export const formatPrice = (price: bigint, pricePrecision: bigint, dp = 6) => formatFixed(price, pricePrecision, dp);

const grouped = new Intl.NumberFormat("en-US");

/** Size units → whole base units with thousands separators ("18,988"); below 1 shows two decimals. */
export function formatSize(size: bigint, sizePrecision: bigint): string {
  const whole = size / sizePrecision;
  if (whole === 0n && size > 0n) return formatFixed(size, sizePrecision, 2);
  return grouped.format(whole);
}

export const formatBlock = (block: bigint) => grouped.format(block);

/** A token amount (e.g. USDC with 6 decimals) → "44.74". */
export const formatToken = (amount: bigint, decimals: number, dp = 2) =>
  formatFixed(amount, 10n ** BigInt(decimals), dp);

/** "0x6Fa0…6e4a" */
export const shortAddress = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/**
 * Parse a typed decimal ("0.026320", "200") into integer units of `precision` (a power of ten).
 * Returns null for anything that isn't a plain non-negative decimal, or has more digits than the unit allows.
 */
export function parseDecimal(text: string, precision: bigint): bigint | null {
  const trimmed = text.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return null;
  const [whole = "", fraction = ""] = trimmed.split(".");
  const digits = digitsOf(precision);
  if (fraction.length > digits) return null;
  return BigInt(whole || "0") * precision + BigInt((fraction || "").padEnd(digits, "0") || "0");
}
