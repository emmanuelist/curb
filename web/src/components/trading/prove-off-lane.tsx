import { useState, type ReactNode } from "react";
import type { RefusedView } from "@/components/curb/refused";
import { KeyGlyph } from "@/components/keys/signer";
import { GAS, proofCalldata, restingOrderFromReceipt, sendProofOffLane } from "@/lib/curb/account";
import { appendLedger } from "@/lib/curb/ledger";
import { PERP_GAS, perpOrderCalldata, perpOrderFromReceipt, sendPerpOrder, type PerpAction, type PerpOrder } from "@/lib/curb/perp";
import { formatToken } from "@/lib/format";
import type { Side } from "@/lib/lane";
import type { Market } from "@/lib/markets/registry";
import { venueName } from "@/lib/markets/selected";
import { useCurbAccount } from "@/hooks/use-curb-account";
import { proofLabel, useProof, type ProofPhase } from "@/hooks/use-proof";
import { useTradingSession, useUnlockTrading } from "@/hooks/use-trading-session";

/** Monad's price as paid on mainnet (102 gwei, E-013): for showing a cost only. */
const GAS_PRICE_SEEN = 102n * 10n ** 9n;
const cost = (gas: bigint) => formatToken(gas * GAS_PRICE_SEEN, 18, 3);

type Props = {
  market: Market;
  side: Side;
  price: bigint;
  size: bigint | null;
  /** Perpl only: the ticket's leverage (hundredths) and the account's cap. */
  leverageHdths?: number;
  capHdths?: number;
  onRefused: (view: RefusedView) => void;
};

const openAction = (side: Side): PerpAction => (side === "buy" ? "open-long" : "open-short");

/**
 * Off the lane, Curb won't send an order by accident. This sends it on purpose, so the refusal happens where it
 * counts: onchain, in the account, with a transaction anyone can open. Post-only, so it can never trade.
 */
export function ProveOffLane({ market, side, price, size, leverageHdths, capHdths, onRefused }: Props) {
  const { state } = useCurbAccount();
  const [accepted, setAccepted] = useState<string | null>(null);
  if (!state?.deployed) return null;
  if (market.venue === "perpl" && !state.perps.supported) return null;

  const lots = size !== null && size >= market.minSize ? size : market.minSize;
  // The cap is checked before the lane, so the proof stays at or under it to be refused for the lane.
  const lev = BigInt(Math.min(leverageHdths ?? 100, capHdths ?? 100));
  const perpOrder: PerpOrder = { action: openAction(side), price, lots, leverageHdths: lev, postOnly: true };
  const kuruOrder = { side, price, size: lots };
  const perpl = market.venue === "perpl";

  return (
    <ProofBox
      title="Prove it onchain."
      body={`Send it anyway and your Curb account refuses it. About ${cost(perpl ? PERP_GAS.proofOffLane : GAS.proofOffLane)} MON of gas; it goes post-only, so it can't trade.`}
      label="Send it anyway"
      unlockLabel="Unlock trading to send it"
      accepted={accepted}
      run={(proof) =>
        proof.run({
          account: state.address,
          attempt: "order",
          market,
          data: perpl ? perpOrderCalldata(market, perpOrder) : proofCalldata.offLane(market, kuruOrder),
          send: (trader) =>
            perpl ? sendPerpOrder(trader, state.address, market, perpOrder, PERP_GAS.proofOffLane) : sendProofOffLane(trader, state.address, market, kuruOrder),
          onRefused,
          notRefused: "The lane moved: this price is inside it now, so there is nothing to refuse. Nothing was sent.",
          onAccepted: (receipt) => {
            // The lane moved between the dry run and the block, and the venue took it as a post-only resting order.
            if (perpl) {
              const fill = perpOrderFromReceipt(receipt, market, null);
              appendLedger(state.address, {
                kind: "perp-order",
                hash: receipt.transactionHash,
                at: Date.now(),
                market: market.id,
                action: perpOrder.action,
                price: price.toString(),
                lots: lots.toString(),
                leverageHdths: Number(lev),
                orderId: fill.orderId === null ? null : fill.orderId.toString(),
                filled: fill.filled.toString(),
              });
              setAccepted(fill.orderId !== null ? `The lane moved before it landed, so the account accepted it: it rests on Perpl as #${fill.orderId}.` : "The lane moved before it landed, so the account accepted it.");
              return;
            }
            const rest = restingOrderFromReceipt(receipt, market, state.address);
            appendLedger(state.address, {
              kind: "order",
              hash: receipt.transactionHash,
              at: Date.now(),
              side,
              price: price.toString(),
              size: lots.toString(),
              orderId: rest ? rest.orderId.toString() : null,
              takerFill: "0",
            });
            setAccepted(rest ? `The lane moved before it landed, so the account accepted it: it rests on ${venueName(market)} as #${rest.orderId}. Cancel it from Orders.` : "The lane moved before it landed, so the account accepted it.");
          },
        })
      }
    />
  );
}

/** Over the cap, Curb won't send the order. This sends it on purpose, so the account refuses the leverage onchain. */
export function ProveCap({ market, side, price, size, leverageHdths, capHdths, onRefused }: Props & { leverageHdths: number; capHdths: number }) {
  const { state } = useCurbAccount();
  if (!state?.deployed || !state.perps.supported) return null;
  const lots = size !== null && size >= market.minSize ? size : market.minSize;
  const order: PerpOrder = { action: openAction(side), price, lots, leverageHdths: BigInt(leverageHdths), postOnly: true };
  return (
    <ProofBox
      title="Prove the cap holds."
      body={`Send it at ${leverageHdths / 100}× anyway and your Curb account refuses it: your cap is ${capHdths / 100}×. About ${cost(PERP_GAS.proofCap)} MON of gas; nothing can trade.`}
      label={`Send at ${leverageHdths / 100}× anyway`}
      unlockLabel="Unlock trading to send it"
      accepted={null}
      run={(proof) =>
        proof.run({
          account: state.address,
          attempt: "order",
          market,
          data: perpOrderCalldata(market, order),
          send: (trader) => sendPerpOrder(trader, state.address, market, order, PERP_GAS.proofCap),
          onRefused,
          notRefused: "The cap allows this leverage now, so there is nothing to refuse. Nothing was sent.",
        })
      }
    />
  );
}

function ProofBox({
  title,
  body,
  label,
  unlockLabel,
  accepted,
  run,
}: {
  title: string;
  body: string;
  label: string;
  unlockLabel: string;
  accepted: string | null;
  run: (proof: ReturnType<typeof useProof>) => Promise<void> | void;
}) {
  const { record } = useCurbAccount();
  const session = useTradingSession();
  const unlocker = useUnlockTrading(record);
  const proof = useProof();
  return (
    <div className="rounded-[12px] border border-dashed border-rule-strong px-3.5 py-3">
      <p className="text-[12.5px] leading-relaxed text-muted">
        <span className="font-semibold text-road">{title}</span> {body}
      </p>
      {session ? (
        <button type="button" onClick={() => void run(proof)} disabled={proof.busy} className="btn btn-quiet mt-2.5 min-h-11 w-full text-[14px]">
          {proofLabel(proof.phase, label)}
        </button>
      ) : (
        <button type="button" onClick={unlocker.unlock} disabled={!unlocker.ready || unlocker.unlocking} className="btn btn-quiet mt-2.5 min-h-11 w-full text-[14px]">
          <KeyGlyph role="trading" size={16} />
          {unlocker.unlocking ? "Waiting for Face ID…" : unlockLabel}
        </button>
      )}
      <Messages phase={proof.phase} problem={unlocker.problem}>
        {accepted ? <p className="mt-2 text-road">{accepted}</p> : null}
      </Messages>
    </div>
  );
}

function Messages({ phase, problem, children }: { phase: ProofPhase; problem: { title: string; body: string } | null; children?: ReactNode }) {
  return (
    <div aria-live="polite" className="text-[12.5px] empty:hidden">
      {phase.kind === "not-refused" ? <p className="mt-2 text-muted">{phase.message}</p> : null}
      {phase.kind === "error" ? (
        <p role="alert" className="mt-2 text-muted">
          <span className="font-semibold text-road">{phase.problem.title}</span> {phase.problem.body}
        </p>
      ) : null}
      {problem ? (
        <p role="alert" className="mt-2 text-muted">
          <span className="font-semibold text-road">{problem.title}</span> {problem.body}
        </p>
      ) : null}
      {children}
    </div>
  );
}
