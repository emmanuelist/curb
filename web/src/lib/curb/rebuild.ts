import { decodeFunctionData, type Address, type Hex, type PublicClient, type Transaction, type TransactionReceipt } from "viem";
import { curbAccountAbi, curbFactoryAbi } from "@/lib/curb/abi";
import { cancelledIdsFromReceipt, makerFillsFromLogs, restingOrderFromReceipt, takerFillFromReceipt } from "@/lib/curb/account";
import type { LedgerEntry, SyncMarker } from "@/lib/curb/ledger";
import { perpOrderFromReceipt, type PerpAction } from "@/lib/curb/perp";
import { lotsResting, perpMakerFillsFromLogs, perpOrderRecords, type PerpBookOrder } from "@/lib/curb/perp-orders";
import { explainRefusal, revertDataOf, type Attempt } from "@/lib/curb/refusal";
import { kuruMarginAbi, kuruOrderBookAbi } from "@/lib/kuru/abi";
import { ausdReceived, KURU_FLOW_ROUTER } from "@/lib/kuru/flow";
import { CURB_FACTORY, CURB_FACTORY_BLOCK, KURU_MARGIN_ACCOUNT, MON_PERP, MON_USDC } from "@/lib/markets/registry";
import { perplExchangeAbi } from "@/lib/perpl/abi";

/**
 * Orders and History from the chain alone (#40). A fresh device has no ledger, and Kuru's and Perpl's events aren't
 * indexed by account. So every transaction the owner and trading keys sent since the account existed is found by its
 * nonce, then decoded into the same entries this device would have written. The device's ledger stays as a cache.
 */

export type Keys = { account: Address; owner: Address; trading: Address };
export type RebuildProgress = { found: number; total: number; ms: number };

/** Up to `k` distinct blocks strictly inside [lo, hi), spread evenly. */
function probes(lo: bigint, hi: bigint, k: number): bigint[] {
  const width = hi - lo;
  const n = BigInt(Math.max(1, Math.min(k, Number(width))));
  const out: bigint[] = [];
  for (let i = 1n; i <= n; i++) {
    const b = lo + (width * i) / (n + 1n);
    if (b < hi && b !== out.at(-1)) out.push(b);
  }
  return out.length > 0 ? out : [lo];
}

/**
 * The smallest block in [lo, hi] where `holds` is true, for a condition that stays true once it starts; null if
 * never. `fanout` blocks are tried at once per round, so a range of 160,000 blocks takes 5 rounds at 12, not 17 calls.
 */
export async function firstBlockWhere(lo: bigint, hi: bigint, holds: (block: bigint) => Promise<boolean>, fanout = 1): Promise<bigint | null> {
  if (lo > hi || !(await holds(hi))) return null;
  while (lo < hi) {
    const pts = probes(lo, hi, fanout);
    const results = await Promise.all(pts.map(holds));
    const first = results.indexOf(true);
    if (first === -1) lo = pts[pts.length - 1] + 1n;
    else {
      if (first > 0) lo = pts[first - 1] + 1n;
      hi = pts[first];
    }
  }
  return lo;
}

/**
 * The blocks in which an address's nonce rose between `lo` (nonce `nLo` after it) and `hi` (nonce `nHi`), one per
 * transaction. All of them are narrowed down together, a level at a time, `fanout` probes per open range.
 */
export async function nonceBlocks(nonceAt: (block: bigint) => Promise<number>, lo: bigint, nLo: number, hi: bigint, nHi: number, fanout = 8): Promise<bigint[]> {
  const found: bigint[] = [];
  let open = nHi > nLo ? [{ lo, nLo, hi, nHi }] : [];
  while (open.length > 0) {
    const wide = open.filter((r) => r.hi - r.lo > 1n);
    for (const r of open) if (r.hi - r.lo <= 1n) for (let i = r.nLo; i < r.nHi; i++) found.push(r.hi);
    const planned = wide.map((r) => ({ r, pts: probes(r.lo, r.hi, fanout).filter((b) => b > r.lo) }));
    const counts = await Promise.all(planned.flatMap((p) => p.pts.map(nonceAt)));
    const next: typeof open = [];
    let i = 0;
    for (const { r, pts } of planned) {
      let prevB = r.lo;
      let prevN = r.nLo;
      for (const b of pts) {
        const n = counts[i++];
        if (n > prevN) next.push({ lo: prevB, nLo: prevN, hi: b, nHi: n });
        prevB = b;
        prevN = n;
      }
      if (r.nHi > prevN) next.push({ lo: prevB, nLo: prevN, hi: r.hi, nHi: r.nHi });
    }
    open = next;
  }
  return found.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

const PERP_ACTION: Record<number, PerpAction> = { 0: "open-long", 1: "open-short", 2: "close-long", 3: "close-short" };

type Tx = Pick<Transaction, "hash" | "from" | "to" | "input" | "value">;

/**
 * One transaction of the account's keys as the entry this device would have written for it, or null when it isn't
 * part of the account's story (the AUSD transfer that precedes `perplDeposit`, which carries the amount, for one).
 * `perplAccountId` is the account's id on Perpl, for telling its fills from the makers'.
 */
export function classify(tx: Tx, receipt: Pick<TransactionReceipt, "status" | "logs">, at: number, keys: Keys, perplAccountId: bigint | null, revertData: Hex | null): LedgerEntry | null {
  const lower = (a: string | null | undefined) => (a ?? "").toLowerCase();
  const [from, to, account] = [lower(tx.from), lower(tx.to), lower(keys.account)];
  const signer = from === lower(keys.owner) ? "owner" : from === lower(keys.trading) ? "trading" : null;
  if (!signer) return null;
  const hash = tx.hash;
  const decode = <A extends readonly unknown[]>(abi: A) => {
    try {
      return decodeFunctionData({ abi: abi as never, data: tx.input }) as { functionName: string; args: readonly unknown[] };
    } catch {
      return null;
    }
  };

  // Refused by the chain: kept with its decoded reason, as the refusal moment recorded it.
  if (receipt.status !== "success") {
    const fn = to === account ? decode(curbAccountAbi)?.functionName : undefined;
    const attempt: Attempt = fn === "withdraw" || fn === "perplWithdraw" || fn === "sweep" ? "withdraw" : fn === "cancel" || fn === "perplCancel" ? "cancel" : "order";
    const refusal = explainRefusal(revertData, attempt, fn === "perplOrder" || fn === "perplCancel" ? MON_PERP : MON_USDC);
    return { kind: "refused", hash, at, attempt, signer, error: refusal.error, detail: refusal.body };
  }

  if (signer === "owner") {
    if (to === lower(CURB_FACTORY)) {
      const c = decode(curbFactoryAbi);
      return c?.functionName === "create" && lower(c.args[0] as string) === lower(keys.trading) ? { kind: "created", hash, at } : null;
    }
    if (to === lower(KURU_MARGIN_ACCOUNT)) {
      const c = decode(kuruMarginAbi);
      if (c?.functionName !== "deposit" || lower(c.args[0] as string) !== account) return null;
      return { kind: "deposit", hash, at, token: c.args[1] as Address, amount: String(c.args[2]) };
    }
    if (to === lower(KURU_FLOW_ROUTER)) return { kind: "swap", hash, at, monIn: tx.value.toString(), ausdOut: ausdReceived(receipt, keys.owner).toString() };
    if (to === account) {
      const c = decode(curbAccountAbi);
      switch (c?.functionName) {
        case "withdraw":
          return { kind: "withdraw", hash, at, token: c.args[0] as Address, amount: String(c.args[1]), to: c.args[2] as Address };
        case "perplDeposit":
          return { kind: "ausd-in", hash, at, amount: String(c.args[0]) };
        case "perplWithdraw":
          return { kind: "ausd-out", hash, at, amount: String(c.args[0]), to: c.args[1] as Address };
        case "setPerp":
          return { kind: "cap", hash, at, market: MON_PERP.id, capHdths: Number(c.args[2]) };
        default:
          return null;
      }
    }
    // A plain MON transfer from the owner key: gas for the trading key, or anywhere else.
    if (tx.input === "0x" && tx.value > 0n && tx.to) return { kind: "send", hash, at, amount: tx.value.toString(), to: tx.to };
    return null;
  }

  if (to !== account) return null;
  const c = decode(curbAccountAbi);
  switch (c?.functionName) {
    case "placeBuy":
    case "placeSell": {
      const rest = restingOrderFromReceipt(receipt, MON_USDC, keys.account);
      return {
        kind: "order",
        hash,
        at,
        side: c.functionName === "placeBuy" ? "buy" : "sell",
        price: String(c.args[1]),
        size: String(c.args[2]),
        orderId: rest ? rest.orderId.toString() : null,
        takerFill: takerFillFromReceipt(receipt, MON_USDC, keys.account).toString(),
      };
    }
    case "cancel": {
      const ids = cancelledIdsFromReceipt(receipt, MON_USDC, keys.account).map(String);
      return ids.length > 0 ? { kind: "cancel", hash, at, orderIds: ids } : null;
    }
    case "perplOrder": {
      const d = c.args[0] as { orderType: number; pricePNS: bigint; lotLNS: bigint; leverageHdths: bigint };
      const action = PERP_ACTION[d.orderType];
      if (!action) return null;
      const fill = perpOrderFromReceipt(receipt, MON_PERP, perplAccountId);
      return {
        kind: "perp-order",
        hash,
        at,
        market: MON_PERP.id,
        action,
        price: (fill.avgPrice ?? d.pricePNS).toString(),
        lots: d.lotLNS.toString(),
        leverageHdths: Number(d.leverageHdths),
        orderId: fill.orderId === null ? null : fill.orderId.toString(),
        filled: fill.filled.toString(),
      };
    }
    case "perplCancel":
      return { kind: "perp-cancel", hash, at, market: MON_PERP.id, orderId: String(c.args[1]) };
    default:
      return null;
  }
}

type Found = { entry: LedgerEntry; block: bigint };

/** Every transaction `key` sent with a nonce in [from, to), found by the blocks its nonce rose in. */
async function sent(client: PublicClient, key: Address, from: number, to: number, floor: bigint, latest: bigint, each: (tx: Transaction, block: bigint, at: number) => Promise<void>) {
  if (to <= from) return;
  const nonceAt = (b: bigint) => client.getTransactionCount({ address: key, blockNumber: b });
  const blocks = [...new Set(await nonceBlocks(nonceAt, floor, from, latest, to, 12))];
  await Promise.all(
    blocks.map(async (block) => {
      const b = await client.getBlock({ blockNumber: block, includeTransactions: true });
      const mine = b.transactions.filter((t) => t.from.toLowerCase() === key.toLowerCase() && t.nonce >= from && t.nonce < to);
      for (const tx of mine) await each(tx, block, Number(b.timestamp) * 1000);
    }),
  );
}

/**
 * Fills of resting orders that left the book with no cancel from either key. Only a fill or our cancel removes a
 * Kuru order; a Perpl one can also be recycled, so Perpl's are matched on the account and order id. The block an order
 * left in is found by binary search on its slot, and that block's logs say whether it filled.
 */
async function fillsOfLeftOrders(
  client: PublicClient,
  keys: Keys,
  perplAccountId: bigint | null,
  all: LedgerEntry[],
  placedAt: Map<string, bigint>,
  latest: bigint,
  settled: Set<string>,
): Promise<Found[]> {
  const out: Found[] = [];
  const timestamp = async (block: bigint) => Number((await client.getBlock({ blockNumber: block })).timestamp) * 1000;

  // Kuru: resting when placed, never cancelled by us, not filled as far as the ledger knows, gone from the book now.
  const cancelled = new Set(all.flatMap((e) => (e.kind === "cancel" ? e.orderIds : [])));
  const filledIds = new Set(all.flatMap((e) => (e.kind === "fill" ? [e.orderId] : [])));
  const kuruResting = async (orderId: string, block: bigint) => {
    const [owner, size] = (await client.readContract({ address: MON_USDC.orderBook, abi: kuruOrderBookAbi, functionName: "s_orders", args: [Number(orderId)], blockNumber: block })) as readonly [Address, bigint, ...unknown[]];
    return owner.toLowerCase() === keys.account.toLowerCase() && size > 0n;
  };
  for (const e of all) {
    if (e.kind !== "order" || !e.orderId || settled.has(e.hash) || cancelled.has(e.orderId) || filledIds.has(e.orderId)) continue;
    const placed = placedAt.get(e.hash);
    if (placed === undefined || (await kuruResting(e.orderId, latest))) continue;
    const left = await firstBlockWhere(placed, latest, async (b) => !(await kuruResting(e.orderId!, b)), 8);
    settled.add(e.hash);
    if (left === null) continue;
    const logs = await client.getLogs({ address: MON_USDC.orderBook, fromBlock: left, toBlock: left });
    const at = await timestamp(left);
    for (const f of makerFillsFromLogs(logs, MON_USDC, keys.account, new Set([e.orderId]))) {
      out.push({ block: left, entry: { kind: "fill", hash: f.hash, at, orderId: f.orderId.toString(), size: f.size.toString(), block: f.block.toString() } });
    }
  }

  // Perpl: the same, by transaction rather than id, because Perpl reuses ids (D-025).
  if (perplAccountId === null || MON_PERP.perpId === undefined) return out;
  const perpId = MON_PERP.perpId;
  for (const r of perpOrderRecords(all, MON_PERP.id)) {
    if (!r.entry.orderId || settled.has(r.entry.hash) || r.cancel || r.fills.length > 0) continue;
    const placed = placedAt.get(r.entry.hash);
    if (placed === undefined) continue;
    const id = BigInt(r.entry.orderId);
    const ours = async (b: bigint) => {
      const [info, order] = await Promise.all([
        client.readContract({ address: MON_PERP.orderBook, abi: perplExchangeAbi, functionName: "getPerpetualInfo", args: [perpId], blockNumber: b }),
        client.readContract({ address: MON_PERP.orderBook, abi: perplExchangeAbi, functionName: "getOrderV2", args: [perpId, id], blockNumber: b }),
      ]);
      return lotsResting(r.entry, order as PerpBookOrder, perplAccountId, info.basePricePNS) > 0n;
    };
    if (await ours(latest)) continue;
    const left = await firstBlockWhere(placed, latest, async (b) => !(await ours(b)), 8);
    settled.add(r.entry.hash);
    if (left === null) continue;
    const logs = await client.getLogs({ address: MON_PERP.orderBook, fromBlock: left, toBlock: left });
    const at = await timestamp(left);
    for (const f of perpMakerFillsFromLogs(logs, MON_PERP, perplAccountId, new Set([r.entry.orderId]))) {
      out.push({ block: left, entry: { kind: "perp-fill", hash: f.hash, at, market: MON_PERP.id, orderId: f.orderId.toString(), lots: f.lots.toString(), block: f.block.toString() } });
    }
  }
  return out;
}

/**
 * The account's history read from Monad: every transaction of both keys after `since` (or since the account was
 * created), decoded, plus the fills of resting orders that left the book. `known` is what the device already holds,
 * so orders placed earlier are still settled. Returns the new entries, oldest first, and the marker to resume from.
 */
export async function rebuildLedger(
  client: PublicClient,
  keys: Keys,
  since: SyncMarker | null,
  known: LedgerEntry[],
  onProgress: (p: RebuildProgress) => void,
): Promise<{ entries: LedgerEntry[]; marker: SyncMarker | null; read: number }> {
  const t0 = Date.now();
  const latest = await client.getBlockNumber();
  const created =
    since !== null
      ? BigInt(since.created)
      : await firstBlockWhere(CURB_FACTORY_BLOCK, latest, async (b) => {
          const code = await client.getCode({ address: keys.account, blockNumber: b });
          return code !== undefined && code !== "0x";
        }, 24);
  if (created === null) return { entries: [], marker: null, read: 0 };

  const nonceAt = (key: Address, block: bigint) => client.getTransactionCount({ address: key, blockNumber: block });
  const [ownerFrom, tradingFrom, ownerTo, tradingTo] = await Promise.all([
    since !== null ? since.owner : nonceAt(keys.owner, created - 1n),
    since !== null ? since.trading : nonceAt(keys.trading, created - 1n),
    nonceAt(keys.owner, latest),
    nonceAt(keys.trading, latest),
  ]);
  let perplAccountId: bigint | null = null;
  try {
    perplAccountId = (await client.readContract({ address: MON_PERP.orderBook, abi: perplExchangeAbi, functionName: "getAccountByAddr", args: [keys.account] })).accountId;
  } catch {
    // No Perpl account yet: no Perpl history either.
  }

  const total = ownerTo - ownerFrom + (tradingTo - tradingFrom);
  let found = 0;
  const report = () => onProgress({ found, total, ms: Date.now() - t0 });
  report();
  const placedAt = new Map<string, bigint>();
  const fresh: Found[] = [];
  // Each search starts at a block whose nonce it knows: the one before creation (the create itself is in the creation
  // block), or the last block a previous read covered.
  const floor = since !== null ? BigInt(since.block) : created - 1n;
  const take = async (tx: Transaction, block: bigint, at: number) => {
    const receipt = await client.getTransactionReceipt({ hash: tx.hash });
    const revert = receipt.status === "success" ? null : await revertDataOf(client, tx.hash);
    const entry = classify(tx, receipt, at, { ...keys }, perplAccountId, revert);
    if (entry) {
      fresh.push({ entry, block });
      placedAt.set(entry.hash, block);
    }
    found++;
    report();
  };
  await Promise.all([sent(client, keys.owner, ownerFrom, ownerTo, floor, latest, take), sent(client, keys.trading, tradingFrom, tradingTo, floor, latest, take)]);

  // Orders already on this device need their placement block too; their transactions say where.
  const all = [...known, ...fresh.map((f) => f.entry)];
  for (const e of known) {
    if ((e.kind === "order" || e.kind === "perp-order") && e.orderId && !placedAt.has(e.hash)) {
      const r = await client.getTransactionReceipt({ hash: e.hash }).catch(() => null);
      if (r) placedAt.set(e.hash, r.blockNumber);
    }
  }
  const settled = new Set(since?.settled ?? []);
  const fills = await fillsOfLeftOrders(client, keys, perplAccountId, all, placedAt, latest, settled);

  const entries = [...fresh, ...fills].sort((a, b) => (a.block < b.block ? -1 : a.block > b.block ? 1 : 0)).map((f) => f.entry);
  report();
  return { entries, marker: { created: created.toString(), owner: ownerTo, trading: tradingTo, block: latest.toString(), settled: [...settled] }, read: total };
}
