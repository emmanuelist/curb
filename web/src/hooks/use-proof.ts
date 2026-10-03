"use client";

import { useCallback, useState } from "react";
import type { Address, Hash, Hex, LocalAccount, TransactionReceipt } from "viem";
import type { RefusedView } from "@/components/curb/refused";
import { publicClient } from "@/lib/chain/clients";
import { dryRun } from "@/lib/curb/account";
import { appendLedger } from "@/lib/curb/ledger";
import { explainRefusal, feePaid, revertDataOf, type Attempt } from "@/lib/curb/refusal";
import { activeTradingKey } from "@/lib/curb/trading-session";
import type { Market } from "@/lib/markets/registry";
import { explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";

export type ProofPhase =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "sending" }
  | { kind: "confirming"; hash: Hash }
  | { kind: "not-refused"; message: string }
  | { kind: "error"; problem: PasskeyProblem };

type Proof = {
  account: Address;
  attempt: Attempt;
  market: Market;
  /** Calldata of the transaction, dry-run against the latest block first. */
  data: Hex;
  send: (trader: LocalAccount) => Promise<Hash>;
  onRefused: (view: RefusedView) => void;
  /** Shown, and nothing sent, when the dry run says the account would accept it. */
  notRefused: string;
  /** If the chain accepted it after all (the lane moved between the dry run and the block). */
  onAccepted?: (receipt: TransactionReceipt) => void;
};

/**
 * Send something the account must refuse, with the trading key, and show the refusal. It is only sent once a dry run
 * shows Curb's account refusing it, so a proof can't turn into a real order or a real withdrawal.
 */
export function useProof() {
  const [phase, setPhase] = useState<ProofPhase>({ kind: "idle" });
  const run = useCallback(async (proof: Proof) => {
    const key = activeTradingKey();
    if (!key) return;
    setPhase({ kind: "checking" });
    try {
      const dry = await dryRun(publicClient, key.address, proof.account, proof.data);
      if (!dry.reverted) {
        setPhase({ kind: "not-refused", message: proof.notRefused });
        return;
      }
      const expected = explainRefusal(dry.data, proof.attempt, proof.market);
      if (expected.by !== "curb") {
        // It would fail, but not on one of the account's rules, so it proves nothing about them: don't send it.
        setPhase({ kind: "not-refused", message: `Not sent: it would fail for another reason. ${expected.body}` });
        return;
      }
      setPhase({ kind: "sending" });
      const hash = await proof.send(key.account);
      setPhase({ kind: "confirming", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        proof.onAccepted?.(receipt);
        setPhase({ kind: "idle" });
        return;
      }
      const traced = await revertDataOf(publicClient, hash);
      const refusal = traced ? explainRefusal(traced, proof.attempt, proof.market) : expected;
      appendLedger(proof.account, {
        kind: "refused",
        hash,
        at: Date.now(),
        attempt: proof.attempt,
        signer: "trading",
        error: refusal.error,
        detail: refusal.body,
      });
      proof.onRefused({ refusal, hash, signer: "trading", signerAddress: key.address, fee: feePaid(receipt), source: traced ? "trace" : "dry-run" });
      setPhase({ kind: "idle" });
    } catch (error) {
      setPhase({ kind: "error", problem: explainPasskeyError(error) });
    }
  }, []);
  const reset = useCallback(() => setPhase({ kind: "idle" }), []);
  return { phase, run, reset, busy: phase.kind === "checking" || phase.kind === "sending" || phase.kind === "confirming" };
}

/** Button text for a proof's phases. */
export function proofLabel(phase: ProofPhase, idle: string): string {
  return phase.kind === "checking" ? "Checking…" : phase.kind === "sending" ? "Signing…" : phase.kind === "confirming" ? "Waiting for Monad…" : idle;
}
