"use client";

import { useState, type CSSProperties } from "react";
import { ClipboardList, ExternalLink, Lock } from "lucide-react";
import { LanePreview } from "@/components/activity/lane-preview";
import { KeyGlyph } from "@/components/keys/signer";
import { EmptyPanel } from "@/components/curb/empty-state";
import { FilterTabs } from "@/components/curb/tabs";
import { ScreenHeader } from "@/components/navigation/app-nav";
import { explorerUrl, publicClient } from "@/lib/chain/clients";
import { cancelledIdsFromReceipt, sendCancel } from "@/lib/curb/account";
import { appendLedger, setCancelling } from "@/lib/curb/ledger";
import { activeTradingKey, lockTrading } from "@/lib/curb/trading-session";
import { formatPrice, formatSize } from "@/lib/format";
import { MON_USDC } from "@/lib/markets/registry";
import { explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import type { CurbAccountRecord } from "@/lib/passkey/keys";
import { useCurbAccount } from "@/hooks/use-curb-account";
import { useLedger } from "@/hooks/use-ledger";
import { useOrders, type OrderView } from "@/hooks/use-orders";
import { useTradingSession, useUnlockTrading } from "@/hooks/use-trading-session";

const market = MON_USDC;

const TABS = [
  { id: "open", label: "Open" },
  { id: "filled", label: "Filled" },
  { id: "cancelled", label: "Cancelled" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const EMPTY: Record<Tab, { title: string; body: string }> = {
  open: { title: "No open orders", body: "Orders your trading key places on Kuru rest here until they fill or you cancel them, each drawn against the lane it was placed in." },
  filled: { title: "No filled orders", body: "When an order fills on Kuru, it moves here with a link to the transaction on Monad." },
  cancelled: { title: "No cancelled orders", body: "Cancelled orders stay here, so you can see what your trading key pulled and when." },
};

/** Which tab an order sits in. An order that left the book unseen sits with the filled ones, labelled for what is known. */
const tabOf = (o: OrderView): Tab | null => (o.status === "open" || o.status === "cancelling" ? "open" : o.status === "cancelled" ? "cancelled" : o.status === "unknown" ? null : "filled");

export function OrdersScreen() {
  const [tab, setTab] = useState<Tab>("open");
  const { record, state } = useCurbAccount();
  const account = state?.deployed ? state.address : null;
  const entries = useLedger(account);
  const { orders, isLoading, refetch } = useOrders(account, entries);
  const shown = orders.filter((o) => tabOf(o) === tab);

  return (
    <main className="mx-auto w-full max-w-[860px] pb-32 md:px-8">
      <ScreenHeader title="Orders" lede="Everything your trading key has placed on Kuru's book." />
      <div className="mt-5 flex flex-col gap-4 px-4 md:mt-8 md:px-0">
        <FilterTabs label="Order status" items={TABS} value={tab} onChange={setTab} />
        {tab === "open" ? <LanePreview /> : null}
        <div role="tabpanel" aria-label={TABS.find((t) => t.id === tab)?.label} className="flex flex-col gap-3">
          {shown.length > 0 && record && account ? (
            <>
              {tab === "open" ? <SessionBar /> : null}
              {shown.map((o, i) => (
                <OrderRow key={o.entry.hash} order={o} i={i + 3} record={record} account={account} onCancelled={() => void refetch()} />
              ))}
              {tab === "filled" && shown.some((o) => o.status === "closed") ? (
                <p className="px-1 text-[12.5px] leading-relaxed text-muted">
                  Kuru usually clears a filled order from its book the same way as a cancelled one. Curb records fills it sees while it&apos;s open; an order
                  that left while Curb was closed, with no cancel from this device, shows as &ldquo;Left the book&rdquo;.
                </p>
              ) : null}
            </>
          ) : isLoading && tab === "open" ? (
            <p className="panel rise px-5 py-6 text-[13px] text-muted" style={{ "--i": 3 } as CSSProperties}>
              Reading your orders from Kuru…
            </p>
          ) : (
            <EmptyPanel key={tab} i={3} icon={ClipboardList} title={EMPTY[tab].title} action={tab === "open" ? { href: "/", label: "Go to the lane" } : undefined}>
              {EMPTY[tab].body}
            </EmptyPanel>
          )}
        </div>
        {orders.length > 0 ? <p className="px-1 text-[12px] text-muted">Orders sent from this device. Each status is read from Kuru&apos;s book on Monad.</p> : null}
      </div>
    </main>
  );
}

/** Shown while the trading key is unlocked in this tab: cancels sign with no prompt, and it can be locked from here. */
function SessionBar() {
  const session = useTradingSession();
  if (!session) return null;
  return (
    <div className="rise flex items-center justify-between gap-2 rounded-[12px] border border-rule bg-panel py-1.5 pl-4 pr-1.5 text-[12.5px] text-muted" style={{ "--i": 3 } as CSSProperties}>
      <span className="flex items-center gap-2">
        <span className="text-road">
          <KeyGlyph role="trading" size={15} />
        </span>
        Trading key unlocked · cancels sign with no prompt
      </span>
      <button type="button" onClick={lockTrading} className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-road hover:bg-high">
        <Lock size={12} aria-hidden="true" /> Lock
      </button>
    </div>
  );
}

type CancelState = { kind: "idle" } | { kind: "sending" } | { kind: "error"; problem: PasskeyProblem };

function OrderRow({ order, i, record, account, onCancelled }: { order: OrderView; i: number; record: CurbAccountRecord; account: `0x${string}`; onCancelled: () => void }) {
  const session = useTradingSession();
  const unlocker = useUnlockTrading(record);
  const [cancel, setCancel] = useState<CancelState>({ kind: "idle" });
  const { entry } = order;
  const size = BigInt(entry.size);
  const price = BigInt(entry.price);
  const p = (x: bigint) => formatPrice(x, market.pricePrecision);
  const s = (x: bigint) => formatSize(x, market.sizePrecision);

  const doCancel = async () => {
    const key = activeTradingKey();
    const id = entry.orderId;
    if (!key || !id) return;
    setCancel({ kind: "sending" });
    setCancelling([id], true);
    try {
      const hash = await sendCancel(key.account, account, market, [BigInt(id)]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setCancel({ kind: "error", problem: { title: "The cancel reverted.", body: "The order is unchanged; the gas was spent." } });
        return;
      }
      const removed = cancelledIdsFromReceipt(receipt, market, account).map(String);
      if (removed.length > 0) appendLedger(account, { kind: "cancel", hash, at: Date.now(), orderIds: removed });
      setCancel(removed.length > 0 ? { kind: "idle" } : { kind: "error", problem: { title: "Nothing to cancel.", body: "The order had already left Kuru's book." } });
      onCancelled();
    } catch (error) {
      setCancel({ kind: "error", problem: explainPasskeyError(error) });
    } finally {
      setCancelling([id], false);
    }
  };

  const status =
    order.status === "cancelling"
      ? "Cancelling…"
      : order.status === "open"
      ? order.remaining < size
        ? `Open · ${s(order.remaining)} left`
        : "Open"
      : order.status === "cancelled"
        ? "Cancelled"
        : order.status === "filled"
          ? "Filled"
          : "Left the book";

  return (
    <article className="panel rise flex flex-col gap-3.5 p-4 md:p-5" style={{ "--i": i } as CSSProperties} aria-label={`${entry.side} ${s(size)} ${market.base.symbol} at ${p(price)}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{entry.side === "buy" ? "Buy" : "Sell"}</p>
          <p className="mt-0.5 font-display text-[22px] font-semibold leading-tight text-road tnum [font-variation-settings:'wdth'_75]">
            {s(size)} {market.base.symbol} <span className="text-muted">@</span> {p(price)}
          </p>
        </div>
        <span className={`pill shrink-0 ${order.status === "open" || order.status === "cancelling" ? "border-road text-road" : "text-muted"}`}>{status}</span>
      </header>

      {entry.lane ? <OrderLane lane={entry.lane} price={price} side={entry.side} /> : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px] md:grid-cols-4">
        <Meta label="Kuru order">{entry.orderId ? `#${entry.orderId}` : "filled on arrival"}</Meta>
        <Meta label="Filled">{order.filled > 0n ? `${s(order.filled)} ${market.base.symbol}` : "none seen"}</Meta>
        <Meta label="Placed">{when(entry.at)}</Meta>
        <Meta label="Transaction">
          <a className="inline-flex items-center gap-1 text-road underline decoration-faint underline-offset-4" href={explorerUrl("tx", entry.hash)} target="_blank" rel="noreferrer">
            {entry.hash.slice(0, 8)}… <ExternalLink size={11} aria-hidden="true" />
          </a>
        </Meta>
      </dl>

      {order.fills.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {order.fills.map((f) => (
            <li key={f.hash}>
              <a className="pill min-h-11 text-road" href={explorerUrl("tx", f.hash)} target="_blank" rel="noreferrer">
                <span className="size-1.5 rounded-full bg-live" aria-hidden="true" />
                Filled {s(BigInt(f.size))} {market.base.symbol} <ExternalLink size={11} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {order.status === "open" || order.status === "cancelling" ? (
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
 * The order against the lane it was placed in: the two curbs at the ends (min sell, max buy), Kuru's best bid and ask
 * between them, and the order's price. The same grammar as the Trade screen, shrunk to a strip.
 */
function OrderLane({ lane, price, side }: { lane: { bid: string; ask: string; minSell: string; maxBuy: string }; price: bigint; side: "buy" | "sell" }) {
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
        <span>{side === "buy" ? "Buy" : "Sell"} at {p(price)}</span>
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
