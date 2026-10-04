// Who places the orders on Kuru's MON-USDC book and Perpl's MON perpetual? A read-only sample of Monad mainnet (#46).
//
//   node scripts/order-flow-sample.mjs [blocks=3000] [rpc=https://rpc.monad.xyz]
//
// Reads each venue's order events for the last `blocks` blocks (Monad's eth_getLogs takes at most 100 blocks a call):
// Kuru's OrderCreated, OrdersCanceled and Trade, and Perpl's OrderRequestV2 on perpetual 10 (MON). It tallies them by
// the account that owns the orders, then, for each venue's top owners, reads who signed a sample of their transactions
// and what those signers hold. Prints JSON. Nothing is sent, signed or stored.
import { createPublicClient, http, parseAbi } from "viem";

const KURU_BOOK = "0x065C9d28E428A0db40191a54d33d5b7c71a9C394"; // Kuru MON-USDC (docs/CONTEXT.md)
const KURU_MARGIN = "0x2A68ba1833cDf93fa9Da1EEbd7F46242aD8E90c5";
const USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
const PERPL = "0x34B6552d57a35a1D042CcAe1951BD1C370112a6F"; // Perpl exchange
const MON_PERP = 10n;
const PERPL_TYPES = { 0: "open long", 1: "open short", 2: "close long", 3: "close short", 4: "cancel" };

const blocks = BigInt(process.argv[2] ?? 3000);
const rpc = process.argv[3] ?? "https://rpc.monad.xyz";
const client = createPublicClient({ transport: http(rpc, { batch: { batchSize: 20, wait: 10 }, retryCount: 6, retryDelay: 400, timeout: 30_000 }) });
// Logs unbatched: ten windows of Perpl's order events in one HTTP body outgrow viem's 10 MB response limit.
const logClient = createPublicClient({ transport: http(rpc, { retryCount: 6, retryDelay: 400, timeout: 60_000 }) });

const kuruAbi = parseAbi([
  "event OrderCreated(uint40 orderId, address owner, uint96 size, uint32 price, bool isBuy)",
  "event OrdersCanceled(uint40[] orderId, address owner)",
  "event Trade(uint40 orderId, address makerAddress, bool isBuy, uint256 price, uint96 updatedSize, address takerAddress, address txOrigin, uint96 filledSize)",
]);
const perplAbi = parseAbi([
  "event OrderRequestV2(uint256 perpId, uint256 accountId, uint256 orderDescId, uint256 orderId, uint8 orderType, uint256 pricePNS, uint256 lotLNS, uint256 expiryBlock, bool postOnly, bool fillOrKill, bool immediateOrCancel, uint256 maxMatches, uint256 leverageHdths, uint256 lastExecutionBlock, uint256 amountCNS, uint256 maxNegPnlCollatBPS, uint256 gasLeft, bytes extension)",
]);
const marginAbi = parseAbi(["function getBalance(address user, address token) view returns (uint256)"]);

const latest = await client.getBlockNumber();
const from = latest - blocks + 1n;
const [first, last] = await Promise.all([client.getBlock({ blockNumber: from }), client.getBlock({ blockNumber: latest })]);
const minutes = Number(last.timestamp - first.timestamp) / 60;

async function logsOf(address, events) {
  const windows = [];
  for (let lo = from; lo <= latest; lo += 100n) windows.push([lo, lo + 99n > latest ? latest : lo + 99n]);
  const out = [];
  for (let i = 0; i < windows.length; i += 10) {
    const part = await Promise.all(windows.slice(i, i + 10).map(([fromBlock, toBlock]) => logClient.getLogs({ address, events, fromBlock, toBlock })));
    for (const l of part) out.push(...l);
  }
  return out;
}

/** Who signed a sample of an owner's transactions, what each signer holds, and which contract they called. */
async function signers(hashes) {
  const txs = await Promise.all([...hashes].slice(0, 6).map((hash) => client.getTransaction({ hash })));
  const froms = [...new Set(txs.map((t) => t.from))];
  const held = await Promise.all(froms.map((a) => client.getBalance({ address: a })));
  return { signers: froms.map((a, i) => ({ address: a, mon: +(Number(held[i]) / 1e18).toFixed(2) })), called: [...new Set(txs.map((t) => t.to))] };
}

// Kuru: orders are owned by the address in OrderCreated / OrdersCanceled.
const kuruLogs = await logsOf(KURU_BOOK, kuruAbi);
const kuru = new Map();
const kOwner = (a) => (kuru.get(a.toLowerCase()) ?? kuru.set(a.toLowerCase(), { address: a, created: 0, cancelled: 0, makerFills: 0, txs: new Set() }).get(a.toLowerCase()));
let kCreated = 0, kCancelled = 0, kTrades = 0;
for (const l of kuruLogs) {
  if (l.eventName === "OrderCreated") { kCreated++; const o = kOwner(l.args.owner); o.created++; o.txs.add(l.transactionHash); }
  if (l.eventName === "OrdersCanceled") { kCancelled += l.args.orderId.length; const o = kOwner(l.args.owner); o.cancelled += l.args.orderId.length; o.txs.add(l.transactionHash); }
  if (l.eventName === "Trade") { kTrades++; const m = kuru.get(l.args.makerAddress.toLowerCase()); if (m) m.makerFills++; }
}
const kRows = [...kuru.values()].filter((o) => o.created + o.cancelled > 0).sort((a, b) => b.created - a.created);
const kTop = await Promise.all(
  kRows.slice(0, 3).map(async (o) => {
    const [code, mon, usdc, who] = await Promise.all([
      client.getCode({ address: o.address }),
      client.readContract({ address: KURU_MARGIN, abi: marginAbi, functionName: "getBalance", args: [o.address, "0x0000000000000000000000000000000000000000"] }),
      client.readContract({ address: KURU_MARGIN, abi: marginAbi, functionName: "getBalance", args: [o.address, USDC] }),
      signers(o.txs),
    ]);
    return { owner: o.address, contract: Boolean(code && code !== "0x"), marginMon: +(Number(mon) / 1e18).toFixed(1), marginUsdc: +(Number(usdc) / 1e6).toFixed(2), ...who };
  }),
);

// Perpl: orders belong to a Perpl account id; the request names it.
const perplLogs = (await logsOf(PERPL, perplAbi)).filter((l) => l.args.perpId === MON_PERP);
const perpl = new Map();
for (const l of perplLogs) {
  const id = l.args.accountId.toString();
  const a = perpl.get(id) ?? perpl.set(id, { accountId: id, requests: 0, byType: {}, txs: new Set() }).get(id);
  a.requests++;
  const t = PERPL_TYPES[l.args.orderType] ?? `type ${l.args.orderType}`;
  a.byType[t] = (a.byType[t] ?? 0) + 1;
  a.txs.add(l.transactionHash);
}
const pRows = [...perpl.values()].sort((a, b) => b.requests - a.requests);
const pTop = await Promise.all(pRows.slice(0, 3).map(async (a) => ({ accountId: a.accountId, ...(await signers(a.txs)) })));

const row = (o, total) => ({ ...o, txs: o.txs.size, perMinute: +(o.txs.size / minutes).toFixed(1), share: +(((o.created ?? o.requests) / Math.max(total, 1))).toFixed(4) });
console.log(
  JSON.stringify(
    {
      blocks: { from: from.toString(), to: latest.toString() },
      window: { from: new Date(Number(first.timestamp) * 1000).toISOString(), to: new Date(Number(last.timestamp) * 1000).toISOString(), minutes: +minutes.toFixed(1) },
      kuru: { book: KURU_BOOK, ordersCreated: kCreated, ordersCancelled: kCancelled, trades: kTrades, owners: kRows.map((o) => row(o, kCreated)), top: kTop },
      perpl: { exchange: PERPL, perpId: MON_PERP.toString(), requests: perplLogs.length, accounts: pRows.map((a) => row(a, perplLogs.length)), top: pTop },
    },
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ),
);
