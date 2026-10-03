"use client";

import Link from "next/link";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDownToLine, ArrowRight, ChevronRight, ClipboardPaste, ExternalLink, LogOut } from "lucide-react";
import { getAddress, isAddress, type Address, type Hash } from "viem";
import { CopyAddress } from "@/components/keys/copy-address";
import { CurbAccountCard } from "@/components/keys/curb-account-card";
import { ProveWithdraw } from "@/components/keys/prove-withdraw";
import { KeyGlyph, Signer, type KeyRole } from "@/components/keys/signer";
import { ScreenHeader } from "@/components/navigation/app-nav";
import { explorerUrl, publicClient } from "@/lib/chain/clients";
import { GAS, gasFor, RESERVE, sendMon, waitForQuiet } from "@/lib/curb/account";
import { appendLedger } from "@/lib/curb/ledger";
import { formatToken, parseDecimal, shortAddress } from "@/lib/format";
import { explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import type { CurbAccountRecord } from "@/lib/passkey/keys";
import { usePasskeyKeys } from "@/hooks/use-passkey-keys";
import { forgetAccount } from "@/lib/passkey/store";
import { useAccount } from "@/hooks/use-account";
import { useBalances } from "@/hooks/use-balances";
import { useCurbAccount } from "@/hooks/use-curb-account";

const MON = 10n ** 18n;
/**
 * Kept back by Max on a send: a transfer's gas at a generous 200 gwei (Monad charges the limit; viem's max fee sits
 * above the ~102 gwei paid), so "everything" never fails for want of gas.
 */
const SEND_GAS_KEEP = GAS.transfer * 200n * 10n ** 9n;

export function KeysScreen() {
  const account = useAccount();
  if (!account) {
    return (
      <main className="mx-auto w-full max-w-[1100px] pb-32 md:px-8">
        <ScreenHeader title="Keys" lede="One passkey makes two keys. Neither is stored on this device." />
        <div className="mt-6 grid gap-4 px-4 md:mt-10 md:grid-cols-2 md:gap-6 md:px-0">
          <KeyCard role="owner" i={1}>
            <p className="text-[13px] leading-relaxed text-muted">The only key that can move money out. Made with Face ID each time, then gone.</p>
          </KeyCard>
          <KeyCard role="trading" i={2}>
            <p className="text-[13px] leading-relaxed text-muted">Places and cancels orders inside the lane without a prompt. It can&apos;t withdraw.</p>
          </KeyCard>
        </div>
        <div className="rise mt-6 px-4 md:px-0" style={{ "--i": 3 } as CSSProperties}>
          <Link href="/start" className="btn btn-primary w-full md:w-auto md:px-8">
            Create your Curb account <ArrowRight size={18} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </div>
      </main>
    );
  }
  return <Keys account={account} />;
}

function KeyCard({ role, i, children, badge }: { role: KeyRole; i: number; children: ReactNode; badge?: ReactNode }) {
  const owner = role === "owner";
  return (
    <section
      aria-labelledby={`${role}-h`}
      style={{ "--i": i } as CSSProperties}
      className={`panel rise flex flex-col gap-5 p-5 ${owner ? "border-kerb/45 shadow-[0_0_0_1px_rgb(255_214_0/0.06),var(--shadow-panel)]" : ""}`}
    >
      <header className="flex items-center gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-full border ${owner ? "border-kerb/50 bg-kerb/10 text-kerb" : "border-rule-strong bg-high text-road"}`}>
          <KeyGlyph role={role} size={20} />
        </span>
        <span className="min-w-0 grow">
          <h2 id={`${role}-h`} className={`text-[17px] font-semibold ${owner ? "text-kerb" : "text-road"}`}>
            {owner ? "Owner key" : "Trading key"}
          </h2>
          <span className="block text-[13px] text-muted">{owner ? "Requires Face ID" : "No prompt required"}</span>
        </span>
        {badge}
      </header>
      {children}
    </section>
  );
}

function Keys({ account }: { account: CurbAccountRecord }) {
  const owner = useBalances(account.owner);
  const trading = useBalances(account.trading);
  const curb = useCurbAccount();
  const live = curb.state?.deployed ?? false;

  return (
    <main className="mx-auto w-full max-w-[1100px] pb-32 md:px-8">
      <ScreenHeader title="Keys" lede="One passkey, two keys. Only the owner key can move money out." />

      <div className="mt-6 grid gap-4 px-4 md:mt-10 md:grid-cols-2 md:gap-6 md:px-0">
        <CurbAccountCard record={account} state={curb.state} ownerMon={owner.data?.mon ?? null} onChanged={() => void curb.refetch()} />

        <div className="flex flex-col gap-4 md:gap-6">
          <KeyCard role="owner" i={2} badge={<span className="pill border-kerb/40 text-kerb">Moves money</span>}>
            <CopyAddress address={account.owner} />
            <BalanceRows balances={owner.data} loading={owner.isPending} />
          </KeyCard>
          <OwnerSend account={account} ownerMon={owner.data?.mon ?? null} ledger={curb.state?.address ?? null} />
        </div>

        <div className="flex flex-col gap-4 md:gap-6">
          <KeyCard role="trading" i={3} badge={<span className="pill text-road">Held to the lane</span>}>
            <CopyAddress address={account.trading} />
            <BalanceRows balances={trading.data} loading={trading.isPending} gasOnly />
            {live && curb.state ? (
              <ProveWithdraw record={account} state={curb.state} />
            ) : (
              <p className="rounded-[12px] border border-dashed border-rule-strong px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">
                Its limits are enforced by your Curb account contract. Until you create it, this key can&apos;t trade.
              </p>
            )}
          </KeyCard>

          <section aria-labelledby="deposit-h" className="panel rise flex gap-4 p-5" style={{ "--i": 5 } as CSSProperties}>
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-kerb/50 bg-kerb/10 text-kerb">
              <ArrowDownToLine size={19} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="deposit-h" className="text-[17px] font-semibold text-road">Adding money</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Send MON to your <span className="text-kerb">owner key</span> on <span className="text-road">Monad mainnet</span>, then deposit it into your Curb account. Other networks will not arrive.
              </p>
            </div>
          </section>

          <button
            type="button"
            onClick={() => {
              if (window.confirm("Forget this account on this device? Your passkey and funds are not affected; you can sign in again with the passkey.")) forgetAccount();
            }}
            className="panel rise flex min-h-14 items-center gap-3 px-5 text-left text-[14px] text-muted transition-colors hover:text-road"
            style={{ "--i": 6 } as CSSProperties}
          >
            <LogOut size={18} strokeWidth={1.8} aria-hidden="true" />
            <span className="grow">Forget this account on this device</span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
    </main>
  );
}

function BalanceRows({ balances, loading, gasOnly = false }: { balances?: { mon: bigint; usdc: bigint }; loading: boolean; gasOnly?: boolean }) {
  const value = (v: bigint | undefined, dec: number, dp: number) => (v !== undefined ? formatToken(v, dec, dp) : loading ? "…" : "—");
  return (
    <dl className={`grid gap-2.5 ${gasOnly ? "grid-cols-1" : "grid-cols-2"}`}>
      <div className="rounded-[12px] border border-rule bg-asphalt px-4 py-3">
        <dt className="text-[12px] text-muted">MON{gasOnly ? " · for gas" : ""}</dt>
        <dd className="mt-1 font-display text-[24px] font-semibold text-road tnum [font-variation-settings:'wdth'_75]">{value(balances?.mon, 18, 4)}</dd>
      </div>
      {!gasOnly ? (
        <div className="rounded-[12px] border border-rule bg-asphalt px-4 py-3">
          <dt className="text-[12px] text-muted">USDC</dt>
          <dd className="mt-1 font-display text-[24px] font-semibold text-road tnum [font-variation-settings:'wdth'_75]">{value(balances?.usdc, 6, 2)}</dd>
        </div>
      ) : null}
    </dl>
  );
}

type Send = { kind: "idle" } | { kind: "waiting" } | { kind: "signing" } | { kind: "sent"; hash: Hash } | { kind: "confirmed"; hash: Hash } | { kind: "error"; problem: PasskeyProblem };

/**
 * The owner key sends MON from itself: gas for the trading key, or anywhere on Monad (back to an exchange, say).
 * One Face ID, one real transaction.
 */
function OwnerSend({ account, ownerMon, ledger }: { account: CurbAccountRecord; ownerMon: bigint | null; ledger: Address | null }) {
  const id = useId();
  const [dest, setDest] = useState<"trading" | "other">("trading");
  const [amountText, setAmountText] = useState("");
  const [otherText, setOtherText] = useState("");
  const [state, setState] = useState<Send>({ kind: "idle" });
  const amount = parseDecimal(amountText, MON);
  const typed = otherText.trim();
  const to: Address | null = dest === "trading" ? account.trading : isAddress(typed, { strict: false }) ? getAddress(typed) : null;
  const badAddress = dest === "other" && typed !== "" && to === null;
  const max = ownerMon !== null && ownerMon > SEND_GAS_KEEP ? ownerMon - SEND_GAS_KEEP : 0n;
  const insufficient = ownerMon !== null && amount !== null && amount > max;
  const busy = state.kind === "waiting" || state.kind === "signing" || state.kind === "sent";
  // Loaded when Keys opens; the Face ID button waits for it, so a tap goes straight to the prompt.
  const keys = usePasskeyKeys();

  const send = async () => {
    if (!keys || amount === null || amount === 0n || !to || ownerMon === null) return;
    try {
      // Leaving the owner key under Monad's 10 MON reserve only works if it sent nothing in the last 3 blocks.
      if (ownerMon - amount < RESERVE) {
        setState({ kind: "waiting" });
        await waitForQuiet(publicClient, account.owner);
      }
      setState({ kind: "signing" });
      const gas = await gasFor(publicClient, { from: account.owner, to, value: amount }, GAS.transfer, to);
      const hash = await keys.withOwnerKey(window.location.hostname, account, (signer) => sendMon(signer, to, amount, gas));
      setState({ kind: "sent", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setState({ kind: "error", problem: { title: "The transfer reverted.", body: "No MON moved; the gas was spent. If it left the owner key under 10 MON, wait a few seconds and try again." } });
        return;
      }
      if (ledger) appendLedger(ledger, { kind: "send", hash, at: Date.now(), amount: amount.toString(), to });
      setState({ kind: "confirmed", hash });
    } catch (error) {
      setState({ kind: "error", problem: explainPasskeyError(error) });
    }
  };

  const paste = async () => {
    try {
      setOtherText((await navigator.clipboard.readText()).trim());
    } catch {
      // Clipboard blocked: the field still takes a typed or long-pressed paste.
    }
  };

  const chip = (selected: boolean) =>
    `min-h-11 rounded-[10px] border px-3 text-left text-[13px] transition-colors ${selected ? "border-road bg-high text-road" : "border-rule text-muted hover:text-road"}`;

  return (
    <section aria-labelledby={`${id}-h`} className="panel rise flex flex-col gap-4 p-5" style={{ "--i": 4 } as CSSProperties}>
      <div className="kerb-painted -mx-5 -mt-5 rounded-t-[15px]" aria-hidden="true" />
      <header>
        <h2 id={`${id}-h`} className="text-[17px] font-semibold text-road">
          Send MON from your owner key
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {dest === "trading"
            ? "The trading key pays its own gas. This moves MON from your owner key to it, on Monad mainnet."
            : "Anywhere on Monad, like back to your exchange. Check the address: a send can't be undone."}
        </p>
      </header>
      <div role="radiogroup" aria-label="Send to" className="grid grid-cols-2 gap-2">
        <button type="button" role="radio" aria-checked={dest === "trading"} onClick={() => setDest("trading")} className={chip(dest === "trading")}>
          <span className="block font-semibold">Trading key</span>
          <span className="block text-[12px]">for gas</span>
        </button>
        <button type="button" role="radio" aria-checked={dest === "other"} onClick={() => setDest("other")} className={chip(dest === "other")}>
          <span className="block font-semibold">Another address</span>
          <span className="block text-[12px]">on Monad</span>
        </button>
      </div>
      {dest === "other" ? (
        <div className="flex flex-col gap-1.5">
          <div className={`flex items-center gap-2 rounded-[12px] border bg-asphalt px-3 py-2 focus-within:border-kerb ${badAddress ? "border-road" : "border-rule"}`}>
            <input
              aria-label="Address on Monad"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="0x…"
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              aria-invalid={badAddress}
              className="figures min-w-0 grow bg-transparent text-[13px] text-road outline-none placeholder:text-faint"
            />
            <button type="button" onClick={paste} className="-my-1 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] text-road hover:bg-high">
              <ClipboardPaste size={13} aria-hidden="true" /> Paste
            </button>
          </div>
          <p className="text-[12px] leading-relaxed text-muted">
            {badAddress ? "That isn't an address. It starts with 0x and has 40 more characters." : "Only an address that takes MON on Monad. An exchange needs the Monad network selected."}
          </p>
          {to ? (
            <p className="figures break-all rounded-[10px] bg-asphalt px-3 py-2 text-[12px] leading-[1.7] text-road">
              <span className="text-muted">0x</span>
              {(to.slice(2).match(/.{1,4}/g) ?? []).join(" ")}
            </p>
          ) : null}
        </div>
      ) : null}
      <label htmlFor={`${id}-amt`} className="block rounded-[12px] border border-rule bg-asphalt px-4 pb-2.5 pt-3 transition-colors focus-within:border-kerb">
        <span className="flex items-center justify-between text-[12px] text-muted">
          Amount
          <span className="font-medium text-road">MON</span>
        </span>
        <input
          id={`${id}-amt`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          className="mt-1 w-full bg-transparent font-display text-[26px] font-semibold text-road outline-none tnum placeholder:text-faint [font-variation-settings:'wdth'_75]"
        />
        <span className="flex items-center justify-between gap-2 text-[12px] text-muted tnum">
          <span>{ownerMon !== null ? `Owner key holds ${formatToken(ownerMon, 18, 4)} MON` : "Reading balance…"}</span>
          {dest === "other" && max > 0n ? (
            <button type="button" onClick={() => setAmountText(formatToken(max, 18, 6))} className="-my-3 min-h-11 rounded-full px-3 font-medium text-road hover:bg-high">
              Max
            </button>
          ) : null}
        </span>
      </label>
      <Signer role="owner" detail={to ? `sends to ${dest === "trading" ? "the trading key" : shortAddress(to)}` : "signs this transfer"} />
      <button
        type="button"
        onClick={send}
        disabled={busy || !keys || amount === null || amount === 0n || insufficient || !to || ownerMon === null || ownerMon === 0n}
        className="btn btn-owner w-full"
      >
        <KeyGlyph role="owner" size={20} />
        {state.kind === "waiting" ? "Waiting for Monad…" : state.kind === "signing" ? "Waiting for Face ID…" : state.kind === "sent" ? "Confirming on Monad…" : "Send with Face ID"}
      </button>
      <div aria-live="polite" className="min-h-5 text-[13px] empty:hidden">
        {ownerMon === 0n ? <p className="text-muted">Your owner key has no MON yet. Deposit first.</p> : null}
        {insufficient && ownerMon !== 0n ? <p className="text-muted">That&apos;s more than your owner key holds, after gas.</p> : null}
        {state.kind === "sent" || state.kind === "confirmed" ? (
          <a className="pill min-h-11 px-3 text-road" href={explorerUrl("tx", state.hash)} target="_blank" rel="noreferrer">
            <span className={`size-1.5 rounded-full ${state.kind === "confirmed" ? "bg-live" : "bg-muted"}`} aria-hidden="true" />
            <span className={state.kind === "confirmed" ? "text-live" : ""}>{state.kind === "confirmed" ? "Confirmed" : "Sent"}</span> · <span className="figures text-[11px]">{state.hash.slice(0, 10)}…{state.hash.slice(-6)}</span>
            <ExternalLink size={13} aria-hidden="true" />
          </a>
        ) : null}
        {state.kind === "error" ? (
          <div role="alert" className="rounded-[12px] border border-rule-strong bg-high px-3.5 py-3">
            <p className="font-semibold text-road">{state.problem.title}</p>
            <p className="mt-0.5 break-words text-muted">{state.problem.body}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
