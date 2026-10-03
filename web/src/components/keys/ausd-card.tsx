import { useId, useState, type CSSProperties } from "react";
import { ClipboardPaste, ExternalLink } from "lucide-react";
import { getAddress, isAddress, type Address, type Hash } from "viem";
import { KeyGlyph, Signer } from "@/components/keys/signer";
import { explorerUrl, publicClient } from "@/lib/chain/clients";
import type { CurbAccountState } from "@/lib/curb/account";
import { appendLedger } from "@/lib/curb/ledger";
import { sendAusdToAccount, sendPerplDeposit, sendPerplWithdraw, sendSetPerp } from "@/lib/curb/perp";
import { formatToken, parseDecimal, shortAddress } from "@/lib/format";
import { MON_PERP } from "@/lib/markets/registry";
import { explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import type { CurbAccountRecord } from "@/lib/passkey/keys";
import { usePasskeyKeys } from "@/hooks/use-passkey-keys";
import { usePerpAccount } from "@/hooks/use-perp-account";

const AUSD_UNIT = 10n ** 6n;
/** Perpl's minimum to open an account: getMinAccountOpenCNS() = 10 AUSD (verified 2026-10-03). */
const MIN_OPEN = 10n * AUSD_UNIT;
const CAPS = [100, 200, 300, 500, 1000] as const;

type Tx = { kind: "idle" } | { kind: "signing" } | { kind: "sent"; hash: Hash; step?: string } | { kind: "confirmed"; hash: Hash; text: string } | { kind: "error"; problem: PasskeyProblem };

/**
 * AUSD for futures (Agora's stablecoin, Perpl's collateral): what the owner key holds, what the account has on Perpl,
 * and the owner-only moves: add AUSD, withdraw it anywhere, and set the trading key's leverage cap.
 */
export function AusdCard({ record, state, ownerAusd, onChanged }: { record: CurbAccountRecord; state: CurbAccountState; ownerAusd: bigint | null; onChanged: () => void }) {
  const { perp, refetch } = usePerpAccount(MON_PERP);
  const [mode, setMode] = useState<"add" | "withdraw" | "cap">("add");
  if (!state.deployed || !state.perps.supported) return null;
  const changed = () => {
    onChanged();
    void refetch();
  };

  return (
    <section id="ausd" aria-labelledby="ausd-h" className="panel rise flex scroll-mt-4 flex-col gap-4 p-5 md:col-span-2" style={{ "--i": 2 } as CSSProperties}>
      <div className="kerb-painted -mx-5 -mt-5 rounded-t-[15px]" aria-hidden="true" />
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="ausd-h" className="font-display text-[22px] font-bold uppercase leading-none text-road [font-variation-settings:'wdth'_75]">
            AUSD · futures margin
          </h2>
          <p className="mt-2 max-w-[60ch] text-[13px] leading-relaxed text-muted">
            Agora&apos;s dollar, held by your Curb account on Perpl as margin for the MON perpetual. Only the owner key moves it.
          </p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        <Cell label="Owner key holds" value={ownerAusd === null ? "…" : formatToken(ownerAusd, 6)} />
        <Cell label="Free on Perpl" value={perp ? formatToken(perp.balance - perp.locked, 6) : state.perps.opened ? "…" : "0.00"} />
        <Cell label="In orders and margin" value={perp ? formatToken(perp.locked + (perp.position?.deposit ?? 0n), 6) : "0.00"} />
        <Cell label="Leverage cap" value={state.perps.capHdths !== null ? `${state.perps.capHdths / 100}×` : "—"} />
      </dl>

      <div role="radiogroup" aria-label="AUSD action" className="grid grid-cols-3 gap-1.5 rounded-[12px] border border-rule bg-asphalt p-1">
        {(["add", "withdraw", "cap"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={`h-11 rounded-[9px] text-[14px] font-semibold transition-colors ${mode === m ? "border border-road bg-high text-road" : "border border-transparent text-muted hover:text-road"}`}
          >
            {m === "add" ? "Add" : m === "withdraw" ? "Withdraw" : "Cap"}
          </button>
        ))}
      </div>

      {mode === "add" ? <Add record={record} state={state} ownerAusd={ownerAusd} onChanged={changed} /> : null}
      {mode === "withdraw" ? <Withdraw record={record} state={state} free={perp ? perp.balance - perp.locked : 0n} onChanged={changed} /> : null}
      {mode === "cap" ? <Cap record={record} state={state} onChanged={changed} /> : null}
    </section>
  );
}

function Add({ record, state, ownerAusd, onChanged }: { record: CurbAccountRecord; state: CurbAccountState; ownerAusd: bigint | null; onChanged: () => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [tx, setTx] = useState<Tx>({ kind: "idle" });
  const keys = usePasskeyKeys();
  const amount = parseDecimal(text, AUSD_UNIT);
  // AUSD already sitting in the account (a first step that landed without its second) goes in with this deposit.
  const total = (amount ?? 0n) + state.perps.collateralHeld;
  const tooMuch = amount !== null && ownerAusd !== null && amount > ownerAusd;
  const underMin = !state.perps.opened && amount !== null && amount > 0n && total < MIN_OPEN;
  const busy = tx.kind === "signing" || tx.kind === "sent";

  const add = async () => {
    if (!keys || amount === null || amount === 0n) return;
    setTx({ kind: "signing" });
    try {
      const hash = await keys.withOwnerKey(window.location.hostname, record, async (owner) => {
        // One Face ID, two transactions: AUSD to the account, then the account moves it into Perpl.
        const sent = await sendAusdToAccount(owner, state.address, amount);
        setTx({ kind: "sent", hash: sent, step: "Sending AUSD to the account…" });
        const r1 = await publicClient.waitForTransactionReceipt({ hash: sent });
        if (r1.status !== "success") throw new Error("The AUSD transfer reverted; nothing moved.");
        const deposited = await sendPerplDeposit(owner, state.address, total);
        setTx({ kind: "sent", hash: deposited, step: state.perps.opened ? "Adding to Perpl…" : "Opening the account on Perpl…" });
        return deposited;
      });
      const r2 = await publicClient.waitForTransactionReceipt({ hash });
      if (r2.status !== "success") throw new Error("The deposit into Perpl reverted. The AUSD is in your Curb account; try again.");
      appendLedger(state.address, { kind: "ausd-in", hash, at: Date.now(), amount: total.toString() });
      setTx({ kind: "confirmed", hash, text: `${formatToken(total, 6)} AUSD on Perpl` });
      setText("");
      onChanged();
    } catch (error) {
      setTx({ kind: "error", problem: explainPasskeyError(error) });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${id}-amt`} className="block rounded-[12px] border border-rule bg-asphalt px-4 pb-2.5 pt-3 focus-within:border-kerb">
        <span className="flex items-center justify-between text-[12px] text-muted">
          Amount
          <span className="font-medium text-road">AUSD</span>
        </span>
        <input
          id={`${id}-amt`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-1 w-full bg-transparent font-display text-[26px] font-semibold text-road outline-none tnum placeholder:text-faint [font-variation-settings:'wdth'_75]"
        />
        <span className="flex items-center justify-between gap-2 text-[12px] text-muted tnum">
          <span>{ownerAusd !== null ? `Owner key holds ${formatToken(ownerAusd, 6)} AUSD` : "Reading balance…"}</span>
          {ownerAusd !== null && ownerAusd > 0n ? (
            <button type="button" onClick={() => setText(formatToken(ownerAusd, 6, 6).replace(/0+$/, "").replace(/\.$/, ""))} className="-my-3 min-h-11 rounded-full px-3 font-medium text-road hover:bg-high">
              Max
            </button>
          ) : null}
        </span>
      </label>
      <Signer role="owner" detail="sends AUSD to the account, which moves it onto Perpl" />
      <button type="button" onClick={add} disabled={busy || !keys || amount === null || amount === 0n || tooMuch || underMin} className="btn btn-owner w-full">
        <KeyGlyph role="owner" size={20} />
        {tx.kind === "signing" ? "Waiting for Face ID…" : tx.kind === "sent" ? (tx.step ?? "Confirming on Monad…") : "Add with Face ID"}
      </button>
      <Messages tx={tx}>
        {ownerAusd === 0n ? <p className="text-muted">Your owner key has no AUSD yet. Swap MON for AUSD on Monad (a DEX like Uniswap) and send it to your owner key.</p> : null}
        {tooMuch ? <p className="text-muted">That&apos;s more AUSD than your owner key holds.</p> : null}
        {underMin ? <p className="text-muted">Perpl opens an account with at least 10 AUSD.</p> : null}
      </Messages>
    </div>
  );
}

function Withdraw({ record, state, free, onChanged }: { record: CurbAccountRecord; state: CurbAccountState; free: bigint; onChanged: () => void }) {
  const id = useId();
  const [text, setText] = useState("");
  const [dest, setDest] = useState<"owner" | "other">("owner");
  const [other, setOther] = useState("");
  const [tx, setTx] = useState<Tx>({ kind: "idle" });
  const keys = usePasskeyKeys();
  const amount = parseDecimal(text, AUSD_UNIT);
  const typed = other.trim();
  const to: Address | null = dest === "owner" ? record.owner : isAddress(typed, { strict: false }) ? getAddress(typed) : null;
  const bad = dest === "other" && typed !== "" && to === null;
  const tooMuch = amount !== null && amount > free;
  const busy = tx.kind === "signing" || tx.kind === "sent";

  const withdraw = async () => {
    if (!keys || amount === null || amount === 0n || !to) return;
    setTx({ kind: "signing" });
    try {
      const hash = await keys.withOwnerKey(window.location.hostname, record, (owner) => sendPerplWithdraw(owner, state.address, amount, to));
      setTx({ kind: "sent", hash });
      const r = await publicClient.waitForTransactionReceipt({ hash });
      if (r.status !== "success") throw new Error("The withdrawal reverted; nothing moved.");
      appendLedger(state.address, { kind: "ausd-out", hash, at: Date.now(), amount: amount.toString(), to });
      setTx({ kind: "confirmed", hash, text: `${formatToken(amount, 6)} AUSD to ${shortAddress(to)}` });
      setText("");
      onChanged();
    } catch (error) {
      setTx({ kind: "error", problem: explainPasskeyError(error) });
    }
  };

  const paste = async () => {
    try {
      setOther((await navigator.clipboard.readText()).trim());
    } catch {
      // Clipboard blocked: the field still takes a typed or long-pressed paste.
    }
  };
  const chip = (on: boolean) => `min-h-11 rounded-[10px] border px-3 text-left text-[13px] transition-colors ${on ? "border-road bg-high text-road" : "border-rule text-muted hover:text-road"}`;

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor={`${id}-amt`} className="block rounded-[12px] border border-rule bg-asphalt px-4 pb-2.5 pt-3 focus-within:border-kerb">
        <span className="flex items-center justify-between text-[12px] text-muted">
          Amount
          <span className="font-medium text-road">AUSD</span>
        </span>
        <input
          id={`${id}-amt`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="mt-1 w-full bg-transparent font-display text-[26px] font-semibold text-road outline-none tnum placeholder:text-faint [font-variation-settings:'wdth'_75]"
        />
        <span className="flex items-center justify-between gap-2 text-[12px] text-muted tnum">
          <span>{formatToken(free, 6)} AUSD free on Perpl</span>
          {free > 0n ? (
            <button type="button" onClick={() => setText(formatToken(free, 6, 6).replace(/0+$/, "").replace(/\.$/, ""))} className="-my-3 min-h-11 rounded-full px-3 font-medium text-road hover:bg-high">
              Max
            </button>
          ) : null}
        </span>
      </label>
      <div role="radiogroup" aria-label="Send to" className="grid grid-cols-2 gap-2">
        <button type="button" role="radio" aria-checked={dest === "owner"} onClick={() => setDest("owner")} className={chip(dest === "owner")}>
          <span className="block font-semibold">Owner key</span>
          <span className="figures block text-[11px]">{shortAddress(record.owner)}</span>
        </button>
        <button type="button" role="radio" aria-checked={dest === "other"} onClick={() => setDest("other")} className={chip(dest === "other")}>
          <span className="block font-semibold">Another address</span>
          <span className="block text-[12px]">on Monad</span>
        </button>
      </div>
      {dest === "other" ? (
        <div className={`flex items-center gap-2 rounded-[12px] border bg-asphalt px-3 py-2 focus-within:border-kerb ${bad ? "border-road" : "border-rule"}`}>
          <input
            aria-label="Address on Monad"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="0x…"
            value={other}
            onChange={(e) => setOther(e.target.value)}
            aria-invalid={bad}
            className="figures min-w-0 grow bg-transparent text-[13px] text-road outline-none placeholder:text-faint"
          />
          <button type="button" onClick={paste} className="-my-1 inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 text-[12px] text-road hover:bg-high">
            <ClipboardPaste size={13} aria-hidden="true" /> Paste
          </button>
        </div>
      ) : null}
      <Signer role="owner" detail={to ? `withdraws to ${shortAddress(to)}` : "withdraws"} />
      <button type="button" onClick={withdraw} disabled={busy || !keys || amount === null || amount === 0n || tooMuch || !to} className="btn btn-owner w-full">
        <KeyGlyph role="owner" size={20} />
        {tx.kind === "signing" ? "Waiting for Face ID…" : tx.kind === "sent" ? "Confirming on Monad…" : "Withdraw with Face ID"}
      </button>
      <Messages tx={tx}>
        {bad ? <p className="text-muted">That isn&apos;t an address. It starts with 0x and has 40 more characters.</p> : null}
        {tooMuch ? <p className="text-muted">Only free AUSD can leave: close the position or cancel orders to free the rest.</p> : null}
      </Messages>
    </div>
  );
}

function Cap({ record, state, onChanged }: { record: CurbAccountRecord; state: CurbAccountState; onChanged: () => void }) {
  const [cap, setCap] = useState<number>(state.perps.capHdths ?? 500);
  const [tx, setTx] = useState<Tx>({ kind: "idle" });
  const keys = usePasskeyKeys();
  const busy = tx.kind === "signing" || tx.kind === "sent";
  const same = cap === state.perps.capHdths;

  const save = async () => {
    if (!keys) return;
    setTx({ kind: "signing" });
    try {
      const hash = await keys.withOwnerKey(window.location.hostname, record, (owner) => sendSetPerp(owner, state.address, MON_PERP, cap));
      setTx({ kind: "sent", hash });
      const r = await publicClient.waitForTransactionReceipt({ hash });
      if (r.status !== "success") throw new Error("Setting the cap reverted; it is unchanged.");
      appendLedger(state.address, { kind: "cap", hash, at: Date.now(), market: MON_PERP.id, capHdths: cap });
      setTx({ kind: "confirmed", hash, text: `Cap now ${cap / 100}×` });
      onChanged();
    } catch (error) {
      setTx({ kind: "error", problem: explainPasskeyError(error) });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13px] leading-relaxed text-muted">The most leverage the trading key may use on MON Perp. The account refuses anything above it, onchain.</p>
      <div role="radiogroup" aria-label="Leverage cap" className="grid grid-cols-5 gap-1.5">
        {CAPS.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={cap === c}
            onClick={() => setCap(c)}
            className={`h-11 rounded-[10px] border text-[14px] font-semibold tnum transition-colors ${cap === c ? "border-road bg-high text-road" : "border-rule text-muted hover:text-road"}`}
          >
            {c / 100}×
          </button>
        ))}
      </div>
      <Signer role="owner" detail="sets the trading key's cap" />
      <button type="button" onClick={save} disabled={busy || !keys || same} className="btn btn-owner w-full">
        <KeyGlyph role="owner" size={20} />
        {tx.kind === "signing" ? "Waiting for Face ID…" : tx.kind === "sent" ? "Confirming on Monad…" : same ? `Cap is ${cap / 100}×` : `Set ${cap / 100}× with Face ID`}
      </button>
      <Messages tx={tx} />
    </div>
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

function Messages({ tx, children }: { tx: Tx; children?: React.ReactNode }) {
  return (
    <div aria-live="polite" className="flex flex-col gap-1.5 text-[13px] empty:hidden">
      {children}
      {tx.kind === "confirmed" ? (
        <a className="pill min-h-11 self-start px-3 text-road" href={explorerUrl("tx", tx.hash)} target="_blank" rel="noreferrer">
          <span className="size-1.5 rounded-full bg-live" aria-hidden="true" />
          <span className="text-live">Confirmed</span> · {tx.text}
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      ) : null}
      {tx.kind === "error" ? (
        <div role="alert" className="rounded-[12px] border border-rule-strong bg-high px-3.5 py-3">
          <p className="font-semibold text-road">{tx.problem.title}</p>
          <p className="mt-0.5 break-words text-muted">{tx.problem.body}</p>
        </div>
      ) : null}
    </div>
  );
}
