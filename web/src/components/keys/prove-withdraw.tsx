import { useState } from "react";
import { RefusedMoment, type RefusedView } from "@/components/curb/refused";
import { KeyGlyph } from "@/components/keys/signer";
import { GAS, proofCalldata, sendProofWithdraw, type CurbAccountState } from "@/lib/curb/account";
import { formatToken } from "@/lib/format";
import { MON_USDC } from "@/lib/markets/registry";
import type { CurbAccountRecord } from "@/lib/passkey/keys";
import { proofLabel, useProof } from "@/hooks/use-proof";
import { useTradingSession, useUnlockTrading } from "@/hooks/use-trading-session";

const MON = 10n ** 18n;
/** Monad's price as paid on mainnet (102 gwei, E-013): for showing a cost only. */
const GAS_PRICE_SEEN = 102n * 10n ** 9n;

/**
 * The trading key asks the account to send its MON to the trading key itself. The account refuses (NotOwner), onchain:
 * the claim "a trading key that can't withdraw", shown rather than told.
 */
export function ProveWithdraw({ record, state }: { record: CurbAccountRecord; state: CurbAccountState }) {
  const session = useTradingSession();
  const unlocker = useUnlockTrading(record);
  const proof = useProof();
  const [refused, setRefused] = useState<RefusedView | null>(null);
  // Ask for everything the account holds on Kuru, or 1 MON when it is empty: the owner check comes before any amount.
  const amount = state.margin.mon > 0n ? state.margin.mon : MON;

  const send = () => {
    if (!session) return;
    setRefused(null);
    void proof.run({
      account: state.address,
      attempt: "withdraw",
      market: MON_USDC,
      data: proofCalldata.withdraw(amount, session.address),
      send: (trader) => sendProofWithdraw(trader, state.address, amount),
      onRefused: (view) => setRefused({ ...view, after: `It asked for ${formatToken(amount, 18, 2)} MON, to itself.` }),
      notRefused: "The account would have accepted this, so Curb didn't send it. That should be impossible; please report it.",
    });
  };

  return (
    <>
      <div className="flex flex-col gap-3 rounded-[12px] border border-dashed border-rule-strong px-3.5 py-3">
        <p className="text-[12.5px] leading-relaxed text-muted">
          <span className="font-semibold text-road">Prove it can&apos;t withdraw.</span> This key asks your Curb account for {formatToken(amount, 18, 2)} MON, sent to
          itself. The account refuses it onchain. About {formatToken(GAS.proofWithdraw * GAS_PRICE_SEEN, 18, 4)} MON of gas.
        </p>
        {session ? (
          <button type="button" onClick={send} disabled={proof.busy} className="btn btn-quiet min-h-11 w-full text-[14px]">
            <KeyGlyph role="trading" size={16} />
            {proofLabel(proof.phase, "Try a withdrawal with this key")}
          </button>
        ) : (
          <button type="button" onClick={unlocker.unlock} disabled={!unlocker.ready || unlocker.unlocking} className="btn btn-quiet min-h-11 w-full text-[14px]">
            <KeyGlyph role="trading" size={16} />
            {unlocker.unlocking ? "Waiting for Face ID…" : "Unlock this key to try"}
          </button>
        )}
        <div aria-live="polite" className="text-[12.5px] empty:hidden">
          {proof.phase.kind === "not-refused" ? <p className="text-muted">{proof.phase.message}</p> : null}
          {proof.phase.kind === "error" ? (
            <p role="alert" className="text-muted">
              <span className="font-semibold text-road">{proof.phase.problem.title}</span> {proof.phase.problem.body}
            </p>
          ) : null}
          {unlocker.problem ? (
            <p role="alert" className="text-muted">
              <span className="font-semibold text-road">{unlocker.problem.title}</span> {unlocker.problem.body}
            </p>
          ) : null}
        </div>
      </div>
      {refused ? <RefusedMoment key={refused.hash} view={refused} onDismiss={() => setRefused(null)} /> : null}
    </>
  );
}
