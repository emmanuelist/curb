"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { createWalletClient, http, type Hash } from "viem";
import { CopyAddress } from "@/components/keys/copy-address";
import { KeyGlyph } from "@/components/keys/signer";
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
      <main className="mx-auto w-full max-w-[720px] px-5 pb-28 pt-4 md:pt-14">
        <p className="text-[12px] font-semibold tracking-[0.14em] text-muted">KEYS</p>
        <h1 className="mt-2 font-display text-[44px] font-extrabold leading-none [font-variation-settings:'wdth'_62] md:text-[64px]">No keys on this device.</h1>
        <p className="mt-4 max-w-[48ch] text-[14px] leading-relaxed text-muted">
          Create a Curb account with a passkey. It makes two keys: an owner key that moves money, and a trading key that can only trade inside the lane.
        </p>
        <Link href="/start" className="mt-8 inline-flex h-14 items-center rounded-[2px] bg-kerb px-6 font-display text-[18px] font-extrabold tracking-[0.05em] text-asphalt [font-variation-settings:'wdth'_75]">
          CREATE WITH A PASSKEY
        </Link>
      </main>
    );
  }
  return <Keys account={account} />;
}

function Keys({ account }: { account: CurbAccountRecord }) {
  const owner = useBalances(account.owner);
  const trading = useBalances(account.trading);

  return (
    <main className="mx-auto w-full max-w-[1100px] px-5 pb-28 pt-4 md:px-8 md:pt-12">
      <p className="text-[12px] font-semibold tracking-[0.14em] text-muted">KEYS</p>
      <h1 className="mt-2 font-display text-[44px] font-extrabold leading-none [font-variation-settings:'wdth'_62] md:text-[64px]">One passkey, two keys.</h1>

      <div className="mt-8 grid gap-8 md:grid-cols-2 md:gap-10">
        <section aria-labelledby="owner-h" className="flex flex-col">
          <div className="kerb-painted" aria-hidden="true" />
          <div className="bg-lane px-5 pb-6 pt-5">
            <h2 id="owner-h" className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.12em] text-kerb">
              <KeyGlyph role="owner" /> OWNER KEY
            </h2>
            <p className="mt-1 text-[13px] text-muted">Face ID required · the only key that moves money out</p>
            <div className="mt-4">
              <CopyAddress address={account.owner} tone="owner" />
            </div>
            <BalanceRows balances={owner.data} loading={owner.isPending} />
          </div>
        </section>

        <section aria-labelledby="trading-h" className="flex flex-col">
          <div className="curb-line" aria-hidden="true" />
          <div className="bg-lane px-5 pb-6 pt-5">
            <h2 id="trading-h" className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.12em] text-road">
              <KeyGlyph role="trading" /> TRADING KEY
            </h2>
            <p className="mt-1 text-[13px] text-muted">No prompt · places and cancels orders inside the lane</p>
            <div className="mt-4">
              <CopyAddress address={account.trading} tone="trading" />
            </div>
            <BalanceRows balances={trading.data} loading={trading.isPending} gasOnly />
            <p className="mt-4 text-[12px] leading-relaxed text-muted">
              Today this is a plain key. The withdraw and off-lane refusals are enforced by your Curb account contract, which arrives next.
            </p>
          </div>
        </section>
      </div>

      <GasTopUp account={account} ownerMon={owner.data?.mon ?? null} />

      <section aria-labelledby="deposit-h" className="mt-10 max-w-[60ch]">
        <h2 id="deposit-h" className="text-[13px] font-semibold tracking-[0.12em] text-kerb">DEPOSIT</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Send MON (for gas) and USDC (to trade) on <span className="text-road">Monad mainnet</span> to your owner key&apos;s address above. Other networks will not arrive.
        </p>
      </section>

      <button
        type="button"
        onClick={() => {
          if (window.confirm("Forget this account on this device? Your passkey and funds are not affected; you can sign in again with the passkey.")) forgetAccount();
        }}
        className="mt-12 min-h-11 text-[13px] text-muted underline decoration-faint underline-offset-4"
      >
        Forget this account on this device
      </button>
    </main>
  );
}

function BalanceRows({ balances, loading, gasOnly = false }: { balances?: { mon: bigint; usdc: bigint }; loading: boolean; gasOnly?: boolean }) {
  return (
    <dl className="figures mt-5 grid grid-cols-2 gap-3 border-t border-rule pt-4 text-[12px]">
      <div>
        <dt className="text-muted">MON{gasOnly ? " · GAS" : ""}</dt>
        <dd className="mt-0.5 text-[15px]">{balances ? formatToken(balances.mon, 18, 4) : loading ? "…" : "—"}</dd>
      </div>
      {!gasOnly ? (
        <div>
          <dt className="text-muted">USDC</dt>
          <dd className="mt-0.5 text-[15px]">{balances ? formatToken(balances.usdc, 6) : loading ? "…" : "—"}</dd>
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
    <section aria-labelledby={`${id}-h`} className="mt-10 max-w-[560px]">
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="font-stencil text-[13px] font-extrabold tracking-[0.18em] text-kerb [font-variation-settings:'opsz'_72]">LOADING ZONE</span>
        <span className="h-[2px] grow bg-kerb opacity-60" />
        <span className="font-stencil text-[13px] font-extrabold tracking-[0.18em] text-kerb [font-variation-settings:'opsz'_72]">OWNER KEY ONLY</span>
      </div>
      <h2 id={`${id}-h`} className="mt-4 text-[18px] font-semibold">Send gas to your trading key</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">The trading key pays its own gas. This moves MON from your owner key to it, on Monad mainnet.</p>
      <label htmlFor={`${id}-amt`} className="mt-4 flex flex-col gap-1">
        <span className="text-[11px] font-semibold tracking-[0.12em] text-muted">AMOUNT · MON</span>
        <input
          id={`${id}-amt`}
          inputMode="decimal"
          autoComplete="off"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value)}
          className="figures h-10 w-40 border-0 border-b-2 border-kerb bg-transparent px-1 text-[19px] text-road"
        />
      </label>
      <button
        type="button"
        onClick={send}
        disabled={busy || amount === null || amount === 0n || insufficient || ownerMon === null || ownerMon === 0n}
        className="mt-5 flex h-14 w-full items-center justify-center gap-2.5 rounded-[2px] bg-kerb font-display text-[18px] font-extrabold tracking-[0.05em] text-asphalt [font-variation-settings:'wdth'_75] disabled:opacity-45"
      >
        <KeyGlyph role="owner" size={22} />
        {state.kind === "signing" ? "WAITING FOR FACE ID" : state.kind === "sent" ? "CONFIRMING ON MONAD" : "SEND WITH FACE ID"}
      </button>
      <div aria-live="polite" className="mt-3 min-h-6 text-[13px]">
        {ownerMon === 0n ? <p className="text-muted">Your owner key has no MON yet. Deposit first.</p> : null}
        {insufficient ? <p className="text-muted">More than your owner key holds.</p> : null}
        {state.kind === "sent" || state.kind === "confirmed" ? (
          <p className="figures text-[12px]">
            {state.kind === "confirmed" ? "CONFIRMED · " : "SENT · "}
            <a className="underline decoration-faint underline-offset-4" href={explorerUrl("tx", state.hash)} target="_blank" rel="noreferrer">
              {state.hash.slice(0, 10)}…{state.hash.slice(-6)} ↗
            </a>
          </p>
        ) : null}
        {state.kind === "error" ? (
          <div role="alert">
            <p className="font-semibold">{state.problem.title}</p>
            <p className="mt-0.5 text-muted">{state.problem.body}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
