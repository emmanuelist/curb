import type { RefusedView } from "@/components/curb/refused";
import { KeyGlyph } from "@/components/keys/signer";
import { GAS, proofCalldata, restingOrderFromReceipt, sendProofOffLane } from "@/lib/curb/account";
import { appendLedger } from "@/lib/curb/ledger";
import { formatToken } from "@/lib/format";
import type { Side } from "@/lib/lane";
import type { Market } from "@/lib/markets/registry";
import { useCurbAccount } from "@/hooks/use-curb-account";
import { proofLabel, useProof } from "@/hooks/use-proof";
import { useTradingSession, useUnlockTrading } from "@/hooks/use-trading-session";
import { useState } from "react";

/** Monad's price as paid on mainnet (102 gwei, E-013): for showing a cost only. */
const GAS_PRICE_SEEN = 102n * 10n ** 9n;

/**
 * Off the lane, Curb won't send an order by accident. This sends it on purpose, so the refusal happens where it
 * counts: onchain, in the account, with a transaction anyone can open.
 */
export function ProveOffLane({ market, side, price, size, onRefused }: { market: Market; side: Side; price: bigint; size: bigint | null; onRefused: (view: RefusedView) => void }) {
  const { record, state } = useCurbAccount();
  const session = useTradingSession();
  const unlocker = useUnlockTrading(record);
  const proof = useProof();
  const [accepted, setAccepted] = useState<string | null>(null);
  if (!record || !state?.deployed) return null;

  const order = { side, price, size: size !== null && size >= market.minSize ? size : market.minSize };
  const send = () =>
    proof.run({
      account: state.address,
      attempt: "order",
      market,
      data: proofCalldata.offLane(market, order),
      send: (trader) => sendProofOffLane(trader, state.address, market, order),
      onRefused,
      notRefused: "The lane moved: this price is inside it now, so there is nothing to refuse. Nothing was sent.",
      onAccepted: (receipt) => {
        // The lane moved between the dry run and the block, and Kuru took it as a post-only resting order.
        const rest = restingOrderFromReceipt(receipt, market, state.address);
        appendLedger(state.address, {
          kind: "order",
          hash: receipt.transactionHash,
          at: Date.now(),
          side,
          price: price.toString(),
          size: order.size.toString(),
          orderId: rest ? rest.orderId.toString() : null,
          takerFill: "0",
        });
        setAccepted(rest ? `The lane moved before it landed, so the account accepted it: it rests on Kuru as #${rest.orderId}. Cancel it from Orders.` : "The lane moved before it landed, so the account accepted it.");
      },
    });

  return (
    <div className="rounded-[12px] border border-dashed border-rule-strong px-3.5 py-3">
      <p className="text-[12.5px] leading-relaxed text-muted">
        <span className="font-semibold text-road">Prove it onchain.</span> Send it anyway and your Curb account refuses it. About{" "}
        {formatToken(GAS.proofOffLane * GAS_PRICE_SEEN, 18, 3)} MON of gas; it goes post-only, so it can&apos;t trade.
      </p>
      {session ? (
        <button type="button" onClick={send} disabled={proof.busy} className="btn btn-quiet mt-2.5 min-h-11 w-full text-[14px]">
          {proofLabel(proof.phase, "Send it anyway")}
        </button>
      ) : (
        <button type="button" onClick={unlocker.unlock} disabled={!unlocker.ready || unlocker.unlocking} className="btn btn-quiet mt-2.5 min-h-11 w-full text-[14px]">
          <KeyGlyph role="trading" size={16} />
          {unlocker.unlocking ? "Waiting for Face ID…" : "Unlock trading to send it"}
        </button>
      )}
      <div aria-live="polite" className="text-[12.5px] empty:hidden">
        {proof.phase.kind === "not-refused" ? <p className="mt-2 text-muted">{proof.phase.message}</p> : null}
        {proof.phase.kind === "error" ? (
          <p role="alert" className="mt-2 text-muted">
            <span className="font-semibold text-road">{proof.phase.problem.title}</span> {proof.phase.problem.body}
          </p>
        ) : null}
        {unlocker.problem ? (
          <p role="alert" className="mt-2 text-muted">
            <span className="font-semibold text-road">{unlocker.problem.title}</span> {unlocker.problem.body}
          </p>
        ) : null}
        {accepted ? <p className="mt-2 text-road">{accepted}</p> : null}
      </div>
    </div>
  );
}
