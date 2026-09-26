import type { Hex } from "viem";

/** One price level. `price` is in pricePrecision units, `size` in sizePrecision units. */
export type Level = { price: bigint; size: bigint };

export type L2Book = { block: bigint; bids: Level[]; asks: Level[] };

/** Best bid/ask in pricePrecision units; `null` when that side of the book is empty. */
export type TopOfBook = { bid: bigint | null; ask: bigint | null };

export const MAX_UINT256 = 2n ** 256n - 1n;
const WAD = 10n ** 18n;

/**
 * Decode Kuru's `getL2Book()` bytes. Layout, from the Kuru SDK's own decoder:
 * one word block number, then (price, size) word pairs for bids until a zero price,
 * then (price, size) pairs for asks until a zero price or the end.
 */
export function decodeL2Book(hex: Hex): L2Book {
  const data = hex.slice(2);
  if (data.length % 64 !== 0) throw new Error("getL2Book: payload is not word-aligned");
  const word = (at: number) => BigInt(`0x${data.slice(at, at + 64)}`);

  let offset = 64;
  const readSide = (): Level[] => {
    const levels: Level[] = [];
    while (offset + 64 <= data.length) {
      const price = word(offset);
      offset += 64;
      if (price === 0n) break;
      if (offset + 64 > data.length) throw new Error("getL2Book: level without a size");
      levels.push({ price, size: word(offset) });
      offset += 64;
    }
    return levels;
  };

  const block = word(0);
  const bids = readSide();
  const asks = readSide();
  return { block, bids, asks };
}

/**
 * Convert `bestBidAsk()` (1e18-scaled, verified in E-001) to price units.
 * An empty side comes back as a sentinel (0 or 2^256-1; see docs/CONTEXT.md → Traps) and maps to null.
 */
export function toTopOfBook(rawBid: bigint, rawAsk: bigint, pricePrecision: bigint): TopOfBook {
  const side = (raw: bigint) => (raw === 0n || raw === MAX_UINT256 ? null : (raw * pricePrecision) / WAD);
  return { bid: side(rawBid), ask: side(rawAsk) };
}
