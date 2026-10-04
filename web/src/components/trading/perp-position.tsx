import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";
import type { Hash } from "viem";
import type { RefusedView } from "@/components/curb/refused";
import { RefusedMoment } from "@/components/curb/refused";
import { KeyGlyph } from "@/components/keys/signer";
import { explorerUrl, publicClient } from "@/lib/chain/clients";
import { appendLedger, setCancelling } from "@/lib/curb/ledger";
import { closePrice, perpOrderFromReceipt, sendPerpCancel, sendPerpOrder, takingGas } from "@/lib/curb/perp";
import { perpCancelKey } from "@/lib/curb/perp-orders";
import { explainRefusal, feePaid, revertDataOf } from "@/lib/curb/refusal";
import { activeTradingKey } from "@/lib/curb/trading-session";
import { formatPrice, formatSize, formatToken } from "@/lib/format";
import type { Lane } from "@/lib/lane";
import type { Market } from "@/lib/markets/registry";
import { explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import { useCurbAccount } from "@/hooks/use-curb-account";
import { useLedger } from "@/hooks/use-ledger";
import { usePerpAccount } from "@/hooks/use-perp-account";
import { usePerpOrders } from "@/hooks/use-perp-orders";
import { useTradingSession, useUnlockTrading } from "@/hooks/use-trading-session";

/** When a ledger entry happened. Only ever called from tap handlers, never while rendering. */
const now = () => Date.now();

type Tx = { kind: "idle" } | { kind: "sending" } | { kind: "done"; hash: Hash; text: string } | { kind: "error"; problem: PasskeyProblem };

/**
 * The account on Perpl: its AUSD margin, the open position on this perpetual (with a one-tap close inside the
 * lane), and the orders resting on Perpl's book. Every figure is read from Perpl; nothing here is computed for show.
 */
export function PerpPosition({ market, lane }: { market: Market; lane: Lane | null }) {
  const { record, state } = useCurbAccount();
  const { perp, refetch } = usePerpAccount(market);
  const session = useTradingSession();
  const unlocker = useUnlockTrading(record);
  const entries = useLedger(state?.address ?? null);
  const [tx, setTx] = useState<Tx>({ kind: "idle" });
  const [refused, setRefused] = useState<RefusedView | null>(null);

  // Resting orders this device placed on this perpetual, each checked on Perpl's book (by transaction: Perpl reuses ids).
  const { orders } = usePerpOrders(state?.address ?? null, entries, market);
  const open = orders.filter((o) => o.status === "open" || o.status === "cancelling");

  if (!state?.deployed || !state.perps.supported || !state.perps.opened || !perp) return null;

  const pos = perp.position;
  const mark = perp.mark;
  const p = (x: bigint) => formatPrice(x, market.pricePrecision);
  const usd = (x: bigint) => formatToken(x < 0n ? -x : x, market.quote.decimals);
  const pnl = pos ? usd(pos.pnl) : "";
  // Under a cent either way shows as 0.00, and a zero carries no sign.
  const pnlSign = !pos || /^0\.0+$/.test(pnl) ? "" : pos.pnl > 0n ? "+" : "−";

  const run = async (send: () => Promise<Hash>, record: (hash: Hash, receipt: Awaited<ReturnType<typeof publicClient.waitForTransactionReceipt>>) => string) => {
    const key = activeTradingKey();
    if (!key) return;
    setRefused(null);
    setTx({ kind: "sending" });
    try {
      const hash = await send();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        const refusal = explainRefusal(await revertDataOf(publicClient, hash), "order", market);
        appendLedger(state.address, { kind: "refused", hash, at: now(), attempt: "order", signer: "trading", error: refusal.error, detail: refusal.body });
        setRefused({ refusal, hash, signer: "trading", signerAddress: key.address, fee: feePaid(receipt), source: "trace" });
        setTx({ kind: "idle" });
        return;
      }
      setTx({ kind: "done", hash, text: record(hash, receipt) });
      void refetch();
    } catch (error) {
      setTx({ kind: "error", problem: explainPasskeyError(error) });
    }
  };

  const close = () => {
    if (!pos || lane?.status !== "open") return;
    // Priced at the far curb, not the top level: the close walks the book inside the lane until the position is gone,
    // filling at each bid's (or ask's) own price (#59).
    const action = pos.type === "long" ? ("close-long" as const) : ("close-short" as const);
    const limit = closePrice(pos.type, lane);
    const order = { action, price: limit, lots: pos.lots, leverageHdths: BigInt(Math.min(state.perps.capHdths ?? 100, 100)), postOnly: false };
    void run(
      async () => {
        const trader = activeTradingKey()!.account;
        return sendPerpOrder(trader, state.address, market, order, await takingGas(trader.address, state.address, market, order));
      },
      (hash, receipt) => {
        const fill = perpOrderFromReceipt(receipt, market, perp.accountId);
        const price = fill.avgPrice ?? limit;
        appendLedger(state.address, { kind: "perp-order", hash, at: now(), market: market.id, action, price: price.toString(), lots: pos.lots.toString(), leverageHdths: 100, orderId: fill.orderId === null ? null : fill.orderId.toString(), filled: fill.filled.toString() });
        const s = (x: bigint) => formatSize(x, market.sizePrecision);
        if (fill.closed) return `Position closed at ${p(price)}`;
        if (fill.filled > 0n) return `Closed ${s(fill.filled)} of ${s(pos.lots)} ${market.base.symbol} at ${p(price)}`;
        return `Nothing closed: no ${pos.type === "long" ? "bids" : "asks"} inside the lane`;
      },
    );
  };

  const cancel = (orderId: string) => {
    // Held as in flight until the receipt is handled, so the order reads as cancelling rather than vanishing early.
    const flight = perpCancelKey(market.id, orderId);
    setCancelling([flight], true);
    void run(() => sendPerpCancel(activeTradingKey()!.account, state.address, market, BigInt(orderId)), (hash) => {
      appendLedger(state.address, { kind: "perp-cancel", hash, at: now(), market: market.id, orderId });
      return `Cancelled #${orderId}`;
    }).finally(() => setCancelling([flight], false));
  };

  const busy = tx.kind === "sending";
  return (
    <section aria-labelledby="perp-pos" className="panel rise flex flex-col gap-4 p-4" style={{ "--i": 2 } as CSSProperties}>
      <header className="flex items-center justify-between gap-3">
        <h2 id="perp-pos" className="text-[15px] font-semibold text-road">
          On Perpl
        </h2>
        <Link href="/keys#ausd" className="inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-[13px] font-semibold text-kerb hover:bg-high">
          {market.quote.symbol} <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <dl className="grid grid-cols-2 gap-2.5">
        <Cell label={`${market.quote.symbol} free`} value={formatToken(perp.balance - perp.locked, market.quote.decimals)} />
        <Cell label="In orders and margin" value={formatToken(perp.locked + (pos?.deposit ?? 0n), market.quote.decimals)} />
      </dl>

      {pos ? (
        <div className="rounded-[12px] border border-rule bg-asphalt p-3.5">
          <p className="flex items-baseline justify-between gap-3">
            <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">{pos.type}</span>
            <span className={`text-[13px] tnum ${pnlSign === "−" ? "text-muted" : "text-road"}`}>
              PnL at mark {pnlSign}
              {`${pnl} ${market.quote.symbol}`}
            </span>
          </p>
          <p className="mt-1 font-display text-[22px] font-semibold leading-tight text-road tnum [font-variation-settings:'wdth'_75]">
            {formatSize(pos.lots, market.sizePrecision)} {market.base.symbol}
          </p>
          <p className="mt-1 text-[12.5px] text-muted tnum">
            Entry {p(pos.entry)} · mark {mark !== null ? p(mark) : "—"} · margin {`${formatToken(pos.deposit, market.quote.decimals)} ${market.quote.symbol}`}
          </p>
          {session ? (
            <button type="button" onClick={close} disabled={busy || lane?.status !== "open"} className="btn btn-quiet mt-3 min-h-11 w-full text-[14px]">
              {busy ? "Closing on Monad…" : lane?.status === "open" ? `Close now · no worse than ${p(closePrice(pos.type, lane))}` : "Close: no lane right now"}
            </button>
          ) : (
            <button type="button" onClick={unlocker.unlock} disabled={!unlocker.ready || unlocker.unlocking} className="btn btn-quiet mt-3 min-h-11 w-full text-[14px]">
              <KeyGlyph role="trading" size={16} />
              {unlocker.unlocking ? "Waiting for Face ID…" : "Unlock to close"}
            </button>
          )}
        </div>
      ) : (
        <p className="text-[12.5px] text-muted">No open position on {market.base.symbol} Perp.</p>
      )}

      {open.length > 0 ? (
        <ul className="flex flex-col divide-y divide-rule rounded-[12px] border border-rule">
          {open.map(({ entry: e, remaining, status }) => (
            <li key={e.hash} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[13px]">
              <span className="min-w-0">
                <span className="text-road">
                  {e.action === "open-long" ? "Long" : e.action === "open-short" ? "Short" : "Close"} {formatSize(remaining > 0n ? remaining : BigInt(e.lots), market.sizePrecision)} @{" "}
                  {p(BigInt(e.price))}
                </span>
                <span className="block text-[12px] text-muted tnum">
                  #{e.orderId} · {e.leverageHdths / 100}×
                </span>
              </span>
              <button type="button" onClick={() => cancel(e.orderId!)} disabled={busy || !session || status === "cancelling"} className="btn btn-quiet min-h-11 shrink-0 px-4 text-[13px]">
                {status === "cancelling" ? "Cancelling…" : "Cancel"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div aria-live="polite" className="empty:hidden">
        {tx.kind === "done" ? (
          <a className="pill min-h-11 px-3 text-road" href={explorerUrl("tx", tx.hash)} target="_blank" rel="noreferrer">
            <span className="size-1.5 rounded-full bg-live" aria-hidden="true" />
            <span className="text-live">Confirmed</span> · {tx.text}
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        ) : null}
        {tx.kind === "error" ? (
          <p role="alert" className="text-[12.5px] text-muted">
            <span className="font-semibold text-road">{tx.problem.title}</span> {tx.problem.body}
          </p>
        ) : null}
        {unlocker.problem ? (
          <p role="alert" className="text-[12.5px] text-muted">
            <span className="font-semibold text-road">{unlocker.problem.title}</span> {unlocker.problem.body}
          </p>
        ) : null}
      </div>
      {refused ? <RefusedMoment key={refused.hash} view={refused} onDismiss={() => setRefused(null)} /> : null}
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-rule bg-asphalt px-3.5 py-2.5">
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-[20px] font-semibold text-road tnum [font-variation-settings:'wdth'_75]">{value}</dd>
    </div>
  );
}
