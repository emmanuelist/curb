import { decodeFunctionResult, encodeFunctionData, type Address, type PublicClient } from "viem";
import type { MarketSnapshot } from "@/lib/kuru/read";
import type { Level } from "@/lib/kuru/book";
import type { Market } from "@/lib/markets/registry";
import { perplExchangeAbi } from "@/lib/perpl/abi";
import { perplBookReaderAbi, perplBookReaderBytecode } from "@/lib/perpl/reader";

/** Levels drawn per side for a Perpl book (the reader walks Perpl's book one level at a time, onchain). */
const DEPTH = 8n;

/**
 * Perpl's book for `market`, read in one deployless eth_call (PerplBookReader is never deployed): the best bid and
 * ask the lane is built from, and the depth drawn around them, in the same shape as a Kuru snapshot.
 */
export async function readPerpMarket(client: PublicClient, market: Market): Promise<MarketSnapshot> {
  if (market.venue !== "perpl" || market.perpId === undefined) throw new Error(`${market.id} is not a Perpl market`);
  const block = await client.getBlockNumber();
  const { data } = await client.call({
    code: perplBookReaderBytecode,
    data: encodeFunctionData({ abi: perplBookReaderAbi, functionName: "book", args: [market.orderBook, market.perpId, DEPTH] }),
    blockNumber: block,
  });
  if (!data) throw new Error("Perpl book read returned nothing");
  const [bid, ask, bids, asks] = decodeFunctionResult({ abi: perplBookReaderAbi, functionName: "book", data });
  const levels = (side: readonly { pricePNS: bigint; lotLNS: bigint }[]): Level[] => side.map((l) => ({ price: l.pricePNS, size: l.lotLNS }));
  return {
    block,
    top: { bid: bid === 0n ? null : bid, ask: ask === 0n ? null : ask },
    book: { block, bids: levels(bids), asks: levels(asks) },
  };
}

export type PerpPosition = {
  /** 0 long, 1 short (Perpl's position types). */
  type: "long" | "short";
  lots: bigint;
  /** Entry price (PNS). */
  entry: bigint;
  /** Collateral in the position (AUSD units). */
  deposit: bigint;
  /** Unrealised PnL at the mark, in AUSD units (Perpl's own figure). */
  pnl: bigint;
};

export type PerpAccount = {
  accountId: bigint;
  /** AUSD on Perpl, free and locked by resting orders (AUSD units). */
  balance: bigint;
  locked: bigint;
  position: PerpPosition | null;
  mark: bigint | null;
};

/** The account's Perpl account and its position on `market`. Call only once the Curb account has opened it. */
export async function readPerpAccount(client: PublicClient, account: Address, market: Market): Promise<PerpAccount> {
  if (market.perpId === undefined) throw new Error(`${market.id} is not a Perpl market`);
  const info = await client.readContract({
    address: market.orderBook,
    abi: perplExchangeAbi,
    functionName: "getAccountByAddr",
    args: [account],
  });
  const [pos, mark, markValid] = await client.readContract({
    address: market.orderBook,
    abi: perplExchangeAbi,
    functionName: "getPositionV2",
    args: [market.perpId, info.accountId],
  });
  return {
    accountId: info.accountId,
    balance: info.balanceCNS,
    locked: info.lockedBalanceCNS,
    position:
      pos.lotLNS > 0n
        ? { type: pos.positionType === 1 ? "short" : "long", lots: pos.lotLNS, entry: pos.pricePNS, deposit: pos.depositCNS, pnl: pos.pnlCNS }
        : null,
    mark: markValid ? mark : null,
  };
}
