import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { SessionLine } from "@/components/curb/session-line";
import { KeyGlyph } from "@/components/keys/signer";
import { explorerUrl, publicClient } from "@/lib/chain/clients";
import { confirm, seconds, stopwatch } from "@/lib/chain/confirm";
import type { RefusedView } from "@/components/curb/refused";
import { crosses, GAS, GAS_PRICE_SEEN, restingOrderFromReceipt, sendPlaceOrder, takerFillFromReceipt } from "@/lib/curb/account";
import { explainRefusal, feePaid, revertDataOf } from "@/lib/curb/refusal";
import { appendLedger } from "@/lib/curb/ledger";
import { activeTradingKey, IDLE_MINUTES } from "@/lib/curb/trading-session";
import { formatSize, formatToken } from "@/lib/format";
import type { Lane, Side } from "@/lib/lane";
import type { Market } from "@/lib/markets/registry";
import { explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import { useCurbAccount } from "@/hooks/use-curb-account";
import { useTradingSession, useUnlockTrading } from "@/hooks/use-trading-session";
import type { Hash } from "viem";

type Phase =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "confirming"; hash: Hash }
  | { kind: "done"; hash: Hash; orderId: bigint | null; filled: bigint; ms: number }
  | { kind: "error"; problem: PasskeyProblem; hash?: Hash };

type Props = {
  market: Market;
  lane: Lane | null;
  side: Side;
  price: bigint | null;
  size: bigint | null;
  /** Quote the order needs (USDC units), for a buy. */
  notional: bigint | null;
  /** True when the ticket has a problem or the price is outside the lane: nothing is sent. */
  blocked: boolean;
  /** The chain refused a placement (the book moved past the curb, say): the ticket shows the refusal. */
  onRefused: (view: RefusedView) => void;
};

const MON_UNITS = (size: bigint, market: Market) => (size * 10n ** BigInt(market.base.decimals)) / market.sizePrecision;

/**
 * The ticket's action. It walks the real preconditions in order (account, onchain account, margin, unlocked trading
 * key) and, once they hold, signs with the trading key: no prompt, the lane checked again onchain by CurbAccount.
 */
export function PlaceOrder({ market, lane, side, price, size, notional, blocked, onRefused }: Props) {
  const { record, state } = useCurbAccount();
  const session = useTradingSession();
  const unlocker = useUnlockTrading(record);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const word = side === "buy" ? "Buy" : "Sell";
  const sizeText = size !== null ? formatSize(size, market.sizePrecision) : "—";

  if (!record) {
    return (
      <Cta>
        <Link href="/start" className="btn btn-primary w-full">
          Create your account to trade <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </Link>
        <Note>One passkey makes both keys. No seed phrase.</Note>
      </Cta>
    );
  }
  if (!state) {
    return (
      <Cta>
        <button type="button" disabled className="btn btn-primary w-full">
          Reading your account…
        </button>
      </Cta>
    );
  }
  if (!state.deployed) {
    return (
      <Cta>
        <Link href="/keys" className="btn btn-primary w-full">
          Set up your Curb account <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </Link>
        <Note>One Face ID on Keys creates it onchain (about {formatToken(GAS.create * GAS_PRICE_SEEN, 18, 2)} MON of gas).</Note>
      </Cta>
    );
  }

  const needMon = side === "sell" && size !== null ? MON_UNITS(size, market) : 0n;
  const needUsdc = side === "buy" && notional !== null ? notional : 0n;
  const short = side === "sell" ? state.margin.mon < needMon : state.margin.usdc < needUsdc;
  const busy = phase.kind === "sending" || phase.kind === "confirming";
  // A resting order locks its margin, so the account can be short right after a placement: keep the result in view.
  if (short && !busy) {
    const has = side === "sell" ? `${formatToken(state.margin.mon, 18, 2)} MON` : `${formatToken(state.margin.usdc, 6)} USDC`;
    const needs = side === "sell" ? `${formatToken(needMon, 18, 2)} MON` : `${formatToken(needUsdc, 6)} USDC`;
    return (
      <Cta>
        <Link href="/keys" className="btn btn-primary w-full">
          Deposit to trade <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
        </Link>
        <Note>
          Your Curb account holds {has} free on Kuru; this order needs {needs}.
        </Note>
        <SessionLine />
        <PhaseLine phase={phase} market={market} />
      </Cta>
    );
  }

  if (!session) {
    return (
      <Cta>
        <button type="button" onClick={unlocker.unlock} disabled={!unlocker.ready || unlocker.unlocking} className="btn btn-primary w-full">
          <KeyGlyph role="trading" size={19} />
          {unlocker.unlocking ? "Waiting for Face ID…" : "Unlock trading · Face ID once"}
        </button>
        <SessionLine />
        <Note>
          One Face ID unlocks the trading key in this tab: it places and cancels orders inside the lane with no prompt. It can never withdraw: your Curb
          account refuses that onchain. It locks when you tap Lock, close the tab, or after {IDLE_MINUTES} minutes unused.
        </Note>
        <PhaseLine phase={unlocker.problem ? { kind: "error", problem: unlocker.problem } : phase} market={market} />
      </Cta>
    );
  }

  const place = async () => {
    if (blocked || price === null || size === null || lane?.status !== "open") return;
    const key = activeTradingKey();
    if (!key) return;
    // Tap to receipt: what "Confirmed in 0.9 s" reports (#44).
    const lap = stopwatch();
    setPhase({ kind: "sending" });
    try {
      const takes = crosses(side, price, { bid: lane.bid, ask: lane.ask });
      const hash = await sendPlaceOrder(key.account, state.address, market, { side, price, size, takes });
      setPhase({ kind: "confirming", hash });
      const receipt = await confirm(hash);
      const ms = lap();
      if (receipt.status !== "success") {
        const data = await revertDataOf(publicClient, hash);
        const refusal = explainRefusal(data, "order", market);
        appendLedger(state.address, { kind: "refused", hash, at: Date.now(), attempt: "order", signer: "trading", error: refusal.error, detail: refusal.body });
        onRefused({ refusal, hash, signer: "trading", signerAddress: key.address, fee: feePaid(receipt), source: "trace" });
        setPhase({ kind: "idle" });
        return;
      }
      const rest = restingOrderFromReceipt(receipt, market, state.address);
      const filled = takerFillFromReceipt(receipt, market, state.address);
      appendLedger(state.address, {
        kind: "order",
        hash,
        at: Date.now(),
        side,
        price: price.toString(),
        size: size.toString(),
        orderId: rest ? rest.orderId.toString() : null,
        takerFill: filled.toString(),
        lane: { bid: lane.bid.toString(), ask: lane.ask.toString(), minSell: lane.minSell.toString(), maxBuy: lane.maxBuy.toString() },
      });
      setPhase({ kind: "done", hash, orderId: rest?.orderId ?? null, filled, ms });
    } catch (error) {
      setPhase({ kind: "error", problem: explainPasskeyError(error) });
    }
  };

  return (
    <Cta>
      <button type="button" onClick={place} disabled={blocked || busy} className="btn btn-primary w-full">
        {phase.kind === "sending" ? "Signing…" : phase.kind === "confirming" ? "Confirming on Monad…" : `${word} ${sizeText} ${market.base.symbol}`}
      </button>
      <SessionLine />
      <PhaseLine phase={phase} market={market} />
    </Cta>
  );
}

function Cta({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-[12px] leading-relaxed text-pretty text-muted">{children}</p>;
}

function PhaseLine({ phase, market }: { phase: Phase; market?: Market }) {
  if (phase.kind === "done") {
    return (
      <a className="pill mx-auto min-h-11 px-3 text-road" href={explorerUrl("tx", phase.hash)} target="_blank" rel="noreferrer">
        <span className="size-1.5 rounded-full bg-live" aria-hidden="true" />
        <span>
          <span className="text-live">Confirmed</span> in {seconds(phase.ms)}
        </span>
        {phase.orderId !== null ? ` · resting on Kuru #${phase.orderId}` : " · filled on arrival"}
        {market && phase.filled > 0n && phase.orderId !== null ? ` · ${formatSize(phase.filled, market.sizePrecision)} filled` : null}
        <ExternalLink size={13} aria-hidden="true" />
      </a>
    );
  }
  if (phase.kind === "error") {
    return (
      <div role="alert" className="rounded-[12px] border border-rule-strong bg-high px-3.5 py-3 text-[13px]">
        <p className="font-semibold text-road">{phase.problem.title}</p>
        <p className="mt-0.5 text-muted">{phase.problem.body}</p>
        {phase.hash ? (
          <a className="mt-1 inline-flex items-center gap-1 text-road underline decoration-faint underline-offset-4" href={explorerUrl("tx", phase.hash)} target="_blank" rel="noreferrer">
            See the transaction <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    );
  }
  return null;
}
