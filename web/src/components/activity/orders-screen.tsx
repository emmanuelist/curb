"use client";

import { useState, type CSSProperties } from "react";
import { ClipboardList, ExternalLink } from "lucide-react";
import type { Address, Hash, LocalAccount } from "viem";
import { ChainSync } from "@/components/activity/chain-sync";
import { LanePreview } from "@/components/activity/lane-preview";
import { KeyGlyph } from "@/components/keys/signer";
import { EmptyPanel } from "@/components/curb/empty-state";
import { SessionLine } from "@/components/curb/session-line";
import { FilterTabs } from "@/components/curb/tabs";
import { ScreenHeader } from "@/components/navigation/app-nav";
import { explorerUrl, publicClient } from "@/lib/chain/clients";
import { cancelledIdsFromReceipt, sendCancel } from "@/lib/curb/account";
import { appendLedger, setCancelling } from "@/lib/curb/ledger";
import { perpSide, sendPerpCancel } from "@/lib/curb/perp";
import { perpCancelKey, type PerpOrderStatus } from "@/lib/curb/perp-orders";
import { activeTradingKey } from "@/lib/curb/trading-session";
import { formatPrice, formatSize } from "@/lib/format";
import type { Side } from "@/lib/lane";
import { MON_USDC, PERPS_ENABLED, type Market } from "@/lib/markets/registry";
import { marketLabel } from "@/lib/markets/selected";
import { explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import type { CurbAccountRecord } from "@/lib/passkey/keys";
import { useChainHistory } from "@/hooks/use-chain-history";
import { useCurbAccount } from "@/hooks/use-curb-account";
import { useLedger } from "@/hooks/use-ledger";
import { useOrders, type OrderView } from "@/hooks/use-orders";
import { usePerpOrders, type PerpOrderView } from "@/hooks/use-perp-orders";
import { useTradingSession, useUnlockTrading } from "@/hooks/use-trading-session";

/** The venues an order can sit on, named the way the copy needs them. */
const VENUES = PERPS_ENABLED
  ? { or: "Kuru or Perpl", and: "Kuru and Perpl", books: "Kuru's and Perpl's books" }
  : { or: "Kuru", and: "Kuru", books: "Kuru's book" };

const TABS = [
  { id: "open", label: "Open" },
  { id: "filled", label: "Filled" },
  { id: "cancelled", label: "Cancelled" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const EMPTY: Record<Tab, { title: string; body: string }> = {
  open: { title: "No open orders", body: `Orders your trading key places on ${VENUES.or} rest here until they fill or you cancel them, each drawn against the lane it was placed in.` },
  filled: { title: "No filled orders", body: `When an order fills on ${VENUES.or}, it moves here with a link to the transaction on Monad.` },
  cancelled: { title: "No cancelled orders", body: "Cancelled orders stay here, so you can see what your trading key pulled and when." },
};

/** One order on this screen, from either venue: what it was, where it stands, and how to cancel it. */
type Row = {
  hash: Hash;
  at: number;
  market: Market;
  /** "Buy", "Long", "Close long": what the order does, in the venue's words. */
  word: string;
  eyebrow: string;
  side: Side;
  size: bigint;
  price: bigint;
  status: PerpOrderStatus;
  remaining: bigint;
  filled: bigint;
  idLabel: string;
  idValue: string;
  lane?: { bid: string; ask: string; minSell: string; maxBuy: string };
  fills: { hash: Hash; size: bigint }[];
  /** Resting orders only: the in-flight key and the cancel itself, which returns a problem or null. */
  cancel: { key: string; run: (trader: LocalAccount) => Promise<PasskeyProblem | null> } | null;
};

/** Which tab an order sits in. An order that left the book unseen sits with the filled ones, labelled for what is known. */
const tabOf = (status: PerpOrderStatus): Tab | null =>
  status === "open" || status === "cancelling" ? "open" : status === "cancelled" || status === "unfilled" ? "cancelled" : status === "unknown" ? null : "filled";

const REVERTED: PasskeyProblem = { title: "The cancel reverted.", body: "The order is unchanged; the gas was spent." };

function kuruRow(o: OrderView, account: Address): Row {
  const { entry } = o;
  const word = entry.side === "buy" ? "Buy" : "Sell";
  const id = entry.orderId;
  return {
    hash: entry.hash,
    at: entry.at,
    market: MON_USDC,
    word,
    eyebrow: PERPS_ENABLED ? `${word} · ${marketLabel(MON_USDC)}` : word,
    side: entry.side,
    size: BigInt(entry.size),
    price: BigInt(entry.price),
    status: o.status,
    remaining: o.remaining,
    filled: o.filled,
    idLabel: "Kuru order",
    idValue: id ? `#${id}` : "filled on arrival",
    lane: entry.lane,
    fills: o.fills.map((f) => ({ hash: f.hash, size: BigInt(f.size) })),
    cancel: id
      ? {
          key: id,
          run: async (trader) => {
            const hash = await sendCancel(trader, account, MON_USDC, [BigInt(id)]);
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status !== "success") return REVERTED;
            const removed = cancelledIdsFromReceipt(receipt, MON_USDC, account).map(String);
            if (removed.length === 0) return { title: "Nothing to cancel.", body: "The order had already left Kuru's book." };
            appendLedger(account, { kind: "cancel", hash, at: Date.now(), orderIds: removed });
            return null;
          },
        }
      : null,
  };
}

const PERP_WORD = { "open-long": "Long", "open-short": "Short", "close-long": "Close long", "close-short": "Close short" } as const;

function perpRow(o: PerpOrderView, account: Address): Row {
  const { entry, market } = o;
  const word = PERP_WORD[entry.action];
  const id = entry.orderId;
  const leverage = entry.action.startsWith("open") ? ` ${entry.leverageHdths / 100}×` : "";
  return {
    hash: entry.hash,
    at: entry.at,
    market,
    word,
    eyebrow: `${word}${leverage} · ${marketLabel(market)}`,
    side: perpSide(entry.action),
    size: BigInt(entry.lots),
    price: BigInt(entry.price),
    status: o.status,
    remaining: o.remaining,
    filled: o.filled,
    idLabel: "Perpl order",
    idValue: id ? `#${id}` : o.filled > 0n ? "traded on arrival" : "nothing traded",
    lane: entry.lane,
    fills: o.fills.map((f) => ({ hash: f.hash, size: BigInt(f.lots) })),
    cancel: id
      ? {
          key: perpCancelKey(market.id, id),
          run: async (trader) => {
            const hash = await sendPerpCancel(trader, account, market, BigInt(id));
            const receipt = await publicClient.waitForTransactionReceipt({ hash });
            if (receipt.status !== "success") return REVERTED;
            appendLedger(account, { kind: "perp-cancel", hash, at: Date.now(), market: market.id, orderId: id });
            return null;
          },
        }
      : null,
  };
}

export function OrdersScreen() {
  const [tab, setTab] = useState<Tab>("open");
  const { record, state } = useCurbAccount();
  const account = state?.deployed ? state.address : null;
  const entries = useLedger(account);
  const kuru = useOrders(account, entries);
  const perps = usePerpOrders(account, entries);
  const rows = account ? [...kuru.orders.map((o) => kuruRow(o, account)), ...perps.orders.map((o) => perpRow(o, account))].sort((a, b) => b.at - a.at) : [];
  const shown = rows.filter((r) => tabOf(r.status) === tab);
  const chain = useChainHistory();
  const refetch = () => {
    void kuru.refetch();
    void perps.refetch();
  };

  return (
    <main className="mx-auto w-full max-w-[860px] pb-32 md:px-8">
      <ScreenHeader title="Orders" lede={`Everything your trading key has placed on ${VENUES.books}.`} />
      <div className="mt-5 flex flex-col gap-4 px-4 md:mt-8 md:px-0">
        <FilterTabs label="Order status" items={TABS} value={tab} onChange={setTab} />
        <ChainSync h={chain} />
        {tab === "open" ? <LanePreview /> : null}
        <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label} className="flex flex-col gap-3">
          {shown.length > 0 && record && account ? (
            <>
              {tab === "open" ? <SessionLine scope="cancels sign with no prompt" /> : null}
              {shown.map((row, i) => (
                <OrderRow key={row.hash} row={row} i={i + 3} record={record} onCancelled={refetch} />
              ))}
              {tab === "filled" && shown.some((r) => r.status === "closed") ? (
                <p className="px-1 text-[12.5px] leading-relaxed text-muted">
                  A filled order usually leaves {VENUES.books} the same way as a cancelled one. Curb records fills it sees while it&apos;s open; an order that left
                  while Curb was closed, with no cancel from this device, shows as &ldquo;Left the book&rdquo;.
                </p>
              ) : null}
            </>
          ) : ((kuru.isLoading || perps.isLoading) && tab === "open") || (chain.status === "reading" && rows.length === 0) ? (
            <p className="panel rise px-5 py-6 text-[13px] text-muted" style={{ "--i": 3 } as CSSProperties}>
              {chain.status === "reading" && rows.length === 0 ? "Reading your orders from Monad…" : `Reading your orders from ${VENUES.and}…`}
            </p>
          ) : (
            <EmptyPanel key={tab} i={3} icon={ClipboardList} title={EMPTY[tab].title} action={tab === "open" ? { href: "/", label: "Go to the lane" } : undefined}>
              {EMPTY[tab].body}
            </EmptyPanel>
          )}
        </div>
        {rows.length > 0 ? <p className="px-1 text-[12px] text-muted">Orders your trading key sent, found on Monad. Each status is read from {VENUES.books}.</p> : null}
      </div>
    </main>
  );
}

type CancelState = { kind: "idle" } | { kind: "sending" } | { kind: "error"; problem: PasskeyProblem };

function OrderRow({ row, i, record, onCancelled }: { row: Row; i: number; record: CurbAccountRecord; onCancelled: () => void }) {
  const session = useTradingSession();
  const unlocker = useUnlockTrading(record);
  const [cancel, setCancel] = useState<CancelState>({ kind: "idle" });
  const { market } = row;
  const p = (x: bigint) => formatPrice(x, market.pricePrecision);
  const s = (x: bigint) => formatSize(x, market.sizePrecision);
  const open = row.status === "open" || row.status === "cancelling";

  const doCancel = async () => {
    const key = activeTradingKey();
    if (!key || !row.cancel) return;
    const { key: flight, run } = row.cancel;
    setCancel({ kind: "sending" });
    setCancelling([flight], true);
    try {
      const problem = await run(key.account);
      setCancel(problem ? { kind: "error", problem } : { kind: "idle" });
      onCancelled();
    } catch (error) {
      setCancel({ kind: "error", problem: explainPasskeyError(error) });
    } finally {
      setCancelling([flight], false);
    }
  };

  const status =
    row.status === "cancelling"
      ? "Cancelling…"
      : row.status === "open"
        ? row.remaining < row.size
          ? `Open · ${s(row.remaining)} left`
          : "Open"
        : row.status === "cancelled"
          ? "Cancelled"
          : row.status === "filled"
            ? "Filled"
            : row.status === "unfilled"
              ? "Not filled"
              : "Left the book";

  return (
    <article className="panel rise flex flex-col gap-3.5 p-4 md:p-5" style={{ "--i": i } as CSSProperties} aria-label={`${row.word} ${s(row.size)} ${market.base.symbol} at ${p(row.price)}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{row.eyebrow}</p>
          <p className="mt-0.5 font-display text-[22px] font-semibold leading-tight text-road tnum [font-variation-settings:'wdth'_75]">
            {s(row.size)} {market.base.symbol} <span className="text-muted">@</span> {p(row.price)}
          </p>
        </div>
        <span className={`pill shrink-0 ${open ? "border-road text-road" : "text-muted"}`}>{status}</span>
      </header>

      {row.lane ? <OrderLane market={market} lane={row.lane} price={row.price} word={row.word} /> : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] md:grid-cols-4">
        <Meta label={row.idLabel}>{row.idValue}</Meta>
        <Meta label="Filled">{row.filled > 0n ? `${s(row.filled)} ${market.base.symbol}` : "none seen"}</Meta>
        <Meta label="Placed">{when(row.at)}</Meta>
        <Meta label="Transaction">
          <a className="inline-flex items-center gap-1 text-road underline decoration-faint underline-offset-4" href={explorerUrl("tx", row.hash)} target="_blank" rel="noreferrer">
            {row.hash.slice(0, 8)}… <ExternalLink size={11} aria-hidden="true" />
          </a>
        </Meta>
      </dl>

      {row.fills.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {row.fills.map((f) => (
            <li key={f.hash}>
              <a className="pill min-h-11 text-road" href={explorerUrl("tx", f.hash)} target="_blank" rel="noreferrer">
                <span className="size-1.5 rounded-full bg-live" aria-hidden="true" />
                Filled {s(f.size)} {market.base.symbol} <ExternalLink size={11} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {open && row.cancel ? (
        <div className="flex flex-col gap-2">
          {session ? (
            <button type="button" onClick={doCancel} disabled={cancel.kind === "sending"} className="btn btn-quiet min-h-12 w-full text-[15px] md:w-auto md:self-start md:px-6">
              {cancel.kind === "sending" ? "Cancelling on Monad…" : "Cancel order"}
            </button>
          ) : (
            <button type="button" onClick={unlocker.unlock} disabled={!unlocker.ready || unlocker.unlocking} className="btn btn-quiet min-h-12 w-full text-[15px] md:w-auto md:self-start md:px-6">
              <KeyGlyph role="trading" size={17} />
              {unlocker.unlocking ? "Waiting for Face ID…" : "Unlock to cancel"}
            </button>
          )}
          {cancel.kind === "error" || unlocker.problem ? (
            <p role="alert" className="text-[12.5px] text-muted">
              <span className="font-semibold text-road">{cancel.kind === "error" ? cancel.problem.title : unlocker.problem?.title}</span>{" "}
              {cancel.kind === "error" ? cancel.problem.body : unlocker.problem?.body}
            </p>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted">{label}</dt>
      <dd className="truncate text-road tnum">{children}</dd>
    </div>
  );
}

/**
 * The order against the lane it was placed in: the two curbs at the ends (min sell, max buy), the venue's best bid and
 * ask between them, and the order's price. The same grammar as the Trade screen, shrunk to a strip.
 */
function OrderLane({ market, lane, price, word }: { market: Market; lane: { bid: string; ask: string; minSell: string; maxBuy: string }; price: bigint; word: string }) {
  const lo = BigInt(lane.minSell);
  const hi = BigInt(lane.maxBuy);
  const span = hi > lo ? hi - lo : 1n;
  const at = (x: bigint) => `${Math.min(100, Math.max(0, Number(((x - lo) * 10_000n) / span) / 100))}%`;
  const p = (x: bigint) => formatPrice(x, market.pricePrecision);
  return (
    <figure className="m-0" aria-label={`Placed at ${p(price)}, inside a lane from ${p(lo)} to ${p(hi)}`}>
      <div className="relative h-7" aria-hidden="true">
        <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-high" />
        <span className="absolute left-0 top-0 h-full w-[7px] border-x-2 border-road" />
        <span className="absolute right-0 top-0 h-full w-[7px] border-x-2 border-road" />
        <span className="absolute top-1.5 h-4 w-px bg-faint" style={{ left: at(BigInt(lane.bid)) }} />
        <span className="absolute top-1.5 h-4 w-px bg-faint" style={{ left: at(BigInt(lane.ask)) }} />
        <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-asphalt bg-road" style={{ left: at(price) }} />
      </div>
      <figcaption className="mt-1 flex justify-between text-[11px] text-muted tnum">
        <span>Min sell {p(lo)}</span>
        <span>
          {word} at {p(price)}
        </span>
        <span>Max buy {p(hi)}</span>
      </figcaption>
    </figure>
  );
}

function when(at: number): string {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString([], { month: "short", day: "numeric" });
}
