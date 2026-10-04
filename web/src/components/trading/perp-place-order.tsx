import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ExternalLink, Lock } from "lucide-react";
import type { Hash } from "viem";
import type { RefusedView } from "@/components/curb/refused";
import { KeyGlyph } from "@/components/keys/signer";
import { explorerUrl, publicClient } from "@/lib/chain/clients";
import { appendLedger } from "@/lib/curb/ledger";
import { perpOrderFromReceipt, sendPerpOrder, takingGas, type PerpAction } from "@/lib/curb/perp";
import { explainRefusal, feePaid, revertDataOf } from "@/lib/curb/refusal";
import { activeTradingKey, lockTrading } from "@/lib/curb/trading-session";
import { formatPrice, formatSize, formatToken } from "@/lib/format";
import type { Lane } from "@/lib/lane";
import type { Market } from "@/lib/markets/registry";
import { explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import { useCurbAccount } from "@/hooks/use-curb-account";
import { usePerpAccount } from "@/hooks/use-perp-account";
import { useTradingSession, useUnlockTrading } from "@/hooks/use-trading-session";

type Phase =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "confirming"; hash: Hash }
  | { kind: "done"; hash: Hash; orderId: bigint | null; filled: bigint; lots: bigint; avgPrice: bigint | null }
  | { kind: "error"; problem: PasskeyProblem };

type Props = {
  market: Market;
  lane: Lane | null;
  action: PerpAction;
  price: bigint | null;
  lots: bigint | null;
  leverageHdths: number;
  /** Notional in AUSD units at the ticket's price. */
  notional: bigint | null;
  blocked: boolean;
  onRefused: (view: RefusedView) => void;
};

const WORD: Record<PerpAction, string> = { "open-long": "Long", "open-short": "Short", "close-long": "Close long", "close-short": "Close short" };

/**
 * The futures ticket's action. It walks the real preconditions in order (account, the new account version, AUSD on
 * Perpl, free margin, the unlocked trading key) and then signs with the trading key: no prompt, and the account
 * checks the lane on Perpl's live book and the leverage cap onchain.
 */
export function PerpPlaceOrder({ market, lane, action, price, lots, leverageHdths, notional, blocked, onRefused }: Props) {
  const { record, state } = useCurbAccount();
  const { perp } = usePerpAccount(market);
  const session = useTradingSession();
  const unlocker = useUnlockTrading(record);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const busy = phase.kind === "sending" || phase.kind === "confirming";
  const sizeText = lots !== null ? formatSize(lots, market.sizePrecision) : "—";
  const lev = `${leverageHdths / 100}×`;
  const closing = action === "close-long" || action === "close-short";

  if (!record) return <Go href="/start" label="Create your account to trade" note="One passkey makes both keys. No seed phrase." />;
  if (!state) return <Waiting label="Reading your account…" />;
  if (!state.deployed) return <Go href="/keys" label="Set up your Curb account" note="One Face ID on Keys creates it onchain." />;
  if (!state.perps.supported)
    return <Go href="/keys" label="Futures need the new account" note="This account trades Kuru spot only. Create the new account on Keys to trade Perpl." />;
  if (!state.perps.opened)
    return <Go href="/keys#ausd" label="Add AUSD to trade futures" note={`Perpl holds ${market.quote.symbol} as margin. Your owner key adds it with one Face ID; at least 10 opens the account.`} />;

  // Margin the order needs at this leverage, plus a little for fees; Perpl checks the real figure onchain.
  const margin = notional !== null && leverageHdths > 0 ? (notional * 100n) / BigInt(leverageHdths) : null;
  const free = perp ? perp.balance - perp.locked : null;
  const short = !closing && !busy && margin !== null && free !== null && (margin * 102n) / 100n > free;
  if (short && free !== null && margin !== null)
    return (
      <Go
        href="/keys#ausd"
        label="Add AUSD for this margin"
        note={`${formatToken(free, 6)} ${market.quote.symbol} free on Perpl; this order needs about ${formatToken(margin, 6)} at ${lev}.`}
      >
        <PhaseLine phase={phase} market={market} />
      </Go>
    );

  if (!session) {
    return (
      <Cta>
        <button type="button" onClick={unlocker.unlock} disabled={!unlocker.ready || unlocker.unlocking} className="btn btn-primary w-full">
          <KeyGlyph role="trading" size={19} />
          {unlocker.unlocking ? "Waiting for Face ID…" : "Unlock trading · Face ID once"}
        </button>
        <Note>After one Face ID, orders and cancels sign without a prompt until you lock it, leave, or 15 minutes pass unused.</Note>
        <PhaseLine phase={unlocker.problem ? { kind: "error", problem: unlocker.problem } : phase} market={market} />
      </Cta>
    );
  }

  const place = async () => {
    if (blocked || price === null || lots === null || lane?.status !== "open") return;
    const key = activeTradingKey();
    if (!key) return;
    setPhase({ kind: "sending" });
    try {
      const bid = action === "open-long" || action === "close-short";
      const takes = bid ? price >= lane.ask : price <= lane.bid;
      const order = { action, price, lots, leverageHdths: BigInt(leverageHdths), postOnly: !takes };
      // A taking order may walk several levels; its gas is measured rather than fixed (#59). A resting one costs the same every time.
      const gas = takes ? await takingGas(key.address, state.address, market, order) : undefined;
      const hash = await sendPerpOrder(key.account, state.address, market, order, gas);
      setPhase({ kind: "confirming", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        const refusal = explainRefusal(await revertDataOf(publicClient, hash), "order", market);
        appendLedger(state.address, { kind: "refused", hash, at: Date.now(), attempt: "order", signer: "trading", error: refusal.error, detail: refusal.body });
        onRefused({ refusal, hash, signer: "trading", signerAddress: key.address, fee: feePaid(receipt), source: "trace" });
        setPhase({ kind: "idle" });
        return;
      }
      const fill = perpOrderFromReceipt(receipt, market, perp?.accountId ?? null);
      appendLedger(state.address, {
        kind: "perp-order",
        hash,
        at: Date.now(),
        market: market.id,
        action,
        // What the lots that traded cost on average; the order's own price when nothing traded.
        price: (fill.avgPrice ?? price).toString(),
        lots: lots.toString(),
        leverageHdths,
        orderId: fill.orderId === null ? null : fill.orderId.toString(),
        filled: fill.filled.toString(),
        lane: { bid: lane.bid.toString(), ask: lane.ask.toString(), minSell: lane.minSell.toString(), maxBuy: lane.maxBuy.toString() },
      });
      setPhase({ kind: "done", hash, orderId: fill.orderId, filled: fill.filled, lots, avgPrice: fill.avgPrice });
    } catch (error) {
      setPhase({ kind: "error", problem: explainPasskeyError(error) });
    }
  };

  return (
    <Cta>
      <button type="button" onClick={place} disabled={blocked || busy} className="btn btn-primary w-full">
        {phase.kind === "sending" ? "Signing…" : phase.kind === "confirming" ? "Confirming on Monad…" : `${WORD[action]} ${sizeText} ${market.base.symbol}${closing ? "" : ` · ${lev}`}`}
      </button>
      <p className="flex items-center justify-center gap-2 text-center text-[12px] text-muted">
        <span>Trading key unlocked · no prompt</span>
        <button type="button" onClick={lockTrading} className="-my-2 inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-road hover:bg-high">
          <Lock size={12} aria-hidden="true" /> Lock
        </button>
      </p>
      <PhaseLine phase={phase} market={market} />
    </Cta>
  );
}

function Go({ href, label, note, children }: { href: string; label: string; note: string; children?: React.ReactNode }) {
  return (
    <Cta>
      <Link href={href} className="btn btn-primary w-full">
        {label} <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
      </Link>
      <Note>{note}</Note>
      {children}
    </Cta>
  );
}

function Waiting({ label }: { label: string }) {
  return (
    <Cta>
      <button type="button" disabled className="btn btn-primary w-full">
        {label}
      </button>
    </Cta>
  );
}

function Cta({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-[12px] leading-relaxed text-muted">{children}</p>;
}

/** What an order did, in full: resting, all traded, part traded, or nothing (an immediate order's rest is cancelled). */
function tradedText(phase: Extract<Phase, { kind: "done" }>, market: Market): string {
  const s = (x: bigint) => formatSize(x, market.sizePrecision);
  const at = phase.avgPrice !== null ? ` at ${formatPrice(phase.avgPrice, market.pricePrecision)}` : "";
  if (phase.orderId !== null) return `resting on Perpl #${phase.orderId}`;
  if (phase.filled === 0n) return "nothing traded: the book moved past your price";
  if (phase.filled < phase.lots) return `${s(phase.filled)} of ${s(phase.lots)} ${market.base.symbol} traded${at}; nothing else was there at your price`;
  return `${s(phase.filled)} ${market.base.symbol} traded${at}`;
}

function PhaseLine({ phase, market }: { phase: Phase; market: Market }) {
  if (phase.kind === "done") {
    return (
      <a className="pill mx-auto min-h-11 px-3 text-road" href={explorerUrl("tx", phase.hash)} target="_blank" rel="noreferrer">
        <span className="size-1.5 rounded-full bg-live" aria-hidden="true" />
        <span className="text-live">Confirmed</span>
        {` · ${tradedText(phase, market)}`}
        <ExternalLink size={13} aria-hidden="true" />
      </a>
    );
  }
  if (phase.kind === "error") {
    return (
      <div role="alert" className="rounded-[12px] border border-rule-strong bg-high px-3.5 py-3 text-[13px]">
        <p className="font-semibold text-road">{phase.problem.title}</p>
        <p className="mt-0.5 text-muted">{phase.problem.body}</p>
      </div>
    );
  }
  return null;
}
