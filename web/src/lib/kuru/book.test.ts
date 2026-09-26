import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Hex } from "viem";
import { describe, expect, it } from "vitest";
import { decodeL2Book } from "@/lib/kuru/book";

// Real getL2Book() bytes from Kuru MON-USDC, Monad mainnet block 108,275,787 (test fixture only; never shipped).
const fixture = readFileSync(join(__dirname, "__fixtures__/mon-usdc-l2book.hex"), "utf8").trim() as Hex;

describe("decodeL2Book", () => {
  const book = decodeL2Book(fixture);

  it("reads the block and both sides", () => {
    expect(book.block).toBe(108_275_787n);
    expect(book.bids).toHaveLength(23);
    expect(book.asks).toHaveLength(47);
  });

  it("orders bids down and asks up from the top of book", () => {
    expect(book.bids[0]).toEqual({ price: 2_611_600n, size: 3_637_564_225_696_517n });
    expect(book.asks[0]).toEqual({ price: 2_611_900n, size: 73_670_253_872_389n });
    for (let i = 1; i < book.bids.length; i++) expect(book.bids[i].price).toBeLessThan(book.bids[i - 1].price);
    for (let i = 1; i < book.asks.length; i++) expect(book.asks[i].price).toBeGreaterThan(book.asks[i - 1].price);
  });

  it("rejects a payload that is not word-aligned", () => {
    expect(() => decodeL2Book("0x1234")).toThrow(/word-aligned/);
  });
});
