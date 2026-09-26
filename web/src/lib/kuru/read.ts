import type { PublicClient } from "viem";
import { kuruOrderBookAbi } from "@/lib/kuru/abi";
import { decodeL2Book, toTopOfBook, type L2Book, type TopOfBook } from "@/lib/kuru/book";
import type { Market } from "@/lib/markets/registry";

export type MarketSnapshot = {
  /** Block the L2 book was read at (from the book payload itself). */
  block: bigint;
  top: TopOfBook;
  book: L2Book;
};

/** One multicall, one block: the top of book the lane is built from, plus the depth drawn around it. */
export async function readMarket(client: PublicClient, market: Market): Promise<MarketSnapshot> {
  const [[rawBid, rawAsk], l2] = await client.multicall({
    allowFailure: false,
    contracts: [
      { address: market.orderBook, abi: kuruOrderBookAbi, functionName: "bestBidAsk" },
      { address: market.orderBook, abi: kuruOrderBookAbi, functionName: "getL2Book" },
    ],
  });
  const book = decodeL2Book(l2);
  return { block: book.block, top: toTopOfBook(rawBid, rawAsk, market.pricePrecision), book };
}
