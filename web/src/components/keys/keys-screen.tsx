"use client";

import Link from "next/link";
import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDownToLine, ArrowRight, ChevronRight, ExternalLink, LogOut } from "lucide-react";
import { createWalletClient, http, type Hash } from "viem";
import { CopyAddress } from "@/components/keys/copy-address";
import { KeyGlyph, Signer, type KeyRole } from "@/components/keys/signer";
import { ScreenHeader } from "@/components/navigation/app-nav";
import { chain, explorerUrl, publicClient, rpcHttpUrl } from "@/lib/chain/clients";
import { formatToken, parseDecimal } from "@/lib/format";
import { explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import { withOwnerKey, type CurbAccountRecord } from "@/lib/passkey/keys";
import { forgetAccount } from "@/lib/passkey/store";
import { useAccount } from "@/hooks/use-account";
import { useBalances } from "@/hooks/use-balances";

const MON = 10n ** 18n;
/** A plain transfer. Monad charges the gas limit, not gas used, so it is set exactly (docs/CONTEXT.md → Traps). */
const TRANSFER_GAS = 21_000n;

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

  return (
    <main className="mx-auto w-full max-w-[1100px] pb-32 md:px-8">
      <ScreenHeader title="Keys" lede="One passkey, two keys. Only the owner key can move money out." />

      <div className="mt-6 grid gap-4 px-4 md:mt-10 md:grid-cols-2 md:gap-6 md:px-0">
        <div className="flex flex-col gap-4 md:gap-6">
          <KeyCard role="owner" i={1} badge={<span className="pill border-kerb/40 text-kerb">Moves money</span>}>
            <CopyAddress address={account.owner} />
            <BalanceRows balances={owner.data} loading={owner.isPending} />
          </KeyCard>
          <GasTopUp account={account} ownerMon={owner.data?.mon ?? null} />
        </div>

        <div className="flex flex-col gap-4 md:gap-6">
          <KeyCard role="trading" i={2} badge={<span className="pill text-road">Held to the lane</span>}>
            <CopyAddress address={account.trading} />
            <BalanceRows balances={trading.data} loading={trading.isPending} gasOnly />
            <p className="rounded-[12px] border border-dashed border-rule-strong px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">
              Today this is a plain key. The withdraw and off-lane refusals are enforced by your Curb account contract, which arrives next.
            </p>
          </KeyCard>

          <section aria-labelledby="deposit-h" className="panel rise flex gap-4 p-5" style={{ "--i": 4 } as CSSProperties}>
            <span className="grid size-11 shrink-0 place-items-center rounded-full border border-kerb/50 bg-kerb/10 text-kerb">
              <ArrowDownToLine size={19} strokeWidth={1.9} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 id="deposit-h" className="text-[17px] font-semibold text-road">Deposit</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Send MON for gas and USDC to trade to your <span className="text-kerb">owner key</span> on <span className="text-road">Monad mainnet</span>. Other networks will not arrive.
              </p>
            </div>
          </section>

          <button
            type="button"
            onClick={() => {
              if (window.confirm("Forget this account on this device? Your passkey and funds are not affected; you can sign in again with the passkey.")) forgetAccount();
            }}
            className="panel rise flex min-h-14 items-center gap-3 px-5 text-left text-[14px] text-muted transition-colors hover:text-road"
            style={{ "--i": 5 } as CSSProperties}
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

type TopUp = { kind: "idle" } | { kind: "signing" } | { kind: "sent"; hash: Hash } | { kind: "confirmed"; hash: Hash } | { kind: "error"; problem: PasskeyProblem };

/** The owner key sends MON to the trading key for gas: one Face ID, one real transaction. */
function GasTopUp({ account, ownerMon }: { account: CurbAccountRecord; ownerMon: bigint | null }) {
  const id = useId();
  const [amountText, setAmountText] = useState("1");
  const [state, setState] = useState<TopUp>({ kind: "idle" });
  const amount = parseDecimal(amountText, MON);
  const insufficient = ownerMon !== null && amount !== null && amount > ownerMon;
  const busy = state.kind === "signing" || state.kind === "sent";

  const send = async () => {
    if (amount === null || amount === 0n) return;
    setState({ kind: "signing" });
    try {
      const hash = await withOwnerKey(window.location.hostname, account, async (signer) => {
        const wallet = createWalletClient({ account: signer, chain, transport: http(rpcHttpUrl) });
        return wallet.sendTransaction({ to: account.trading, value: amount, gas: TRANSFER_GAS });
      });
      setState({ kind: "sent", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      setState(receipt.status === "success" ? { kind: "confirmed", hash } : { kind: "error", problem: { title: "The transaction reverted.", body: hash } });
    } catch (error) {
      setState({ kind: "error", problem: explainPasskeyError(error) });
    }
  };

  return (
    <section aria-labelledby={`${id}-h`} className="panel rise flex flex-col gap-4 p-5" style={{ "--i": 3 } as CSSProperties}>
      <div className="kerb-painted -mx-5 -mt-5 rounded-t-[15px]" aria-hidden="true" />
      <header>
        <h2 id={`${id}-h`} className="text-[17px] font-semibold text-road">
          Send gas to your trading key
        </h2>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">The trading key pays its own gas. This moves MON from your owner key to it, on Monad mainnet.</p>
      </header>
      <label htmlFor={`${id}-amt`} className="block rounded-[12px] border border-rule bg-asphalt px-4 pb-2.5 pt-3 transition-colors focus-within:border-kerb">
        <span className="flex items-center justify-between text-[12px] text-muted">
          Amount
          <span className="font-medium text-road">MON</span>
        </span>
        <input
          id={`${id}-amt`}
          inputMode="decimal"
          autoComplete="off"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          className="mt-1 w-full bg-transparent font-display text-[26px] font-semibold text-road outline-none tnum [font-variation-settings:'wdth'_75]"
        />
        <span className="block text-[12px] text-muted tnum">{ownerMon !== null ? `Owner key holds ${formatToken(ownerMon, 18, 4)} MON` : "Reading balance…"}</span>
      </label>
      <Signer role="owner" detail="signs this transfer" />
      <button
        type="button"
        onClick={send}
        disabled={busy || amount === null || amount === 0n || insufficient || ownerMon === null || ownerMon === 0n}
        className="btn btn-owner w-full"
      >
        <KeyGlyph role="owner" size={20} />
        {state.kind === "signing" ? "Waiting for Face ID…" : state.kind === "sent" ? "Confirming on Monad…" : "Send with Face ID"}
      </button>
      <div aria-live="polite" className="min-h-5 text-[13px] empty:hidden">
        {ownerMon === 0n ? <p className="text-muted">Your owner key has no MON yet. Deposit first.</p> : null}
        {insufficient && ownerMon !== 0n ? <p className="text-muted">That&apos;s more than your owner key holds.</p> : null}
        {state.kind === "sent" || state.kind === "confirmed" ? (
          <a className="pill min-h-9 px-3 text-road" href={explorerUrl("tx", state.hash)} target="_blank" rel="noreferrer">
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
