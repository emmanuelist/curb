import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { ClipboardPaste, ExternalLink } from "lucide-react";
import { encodeFunctionData, getAddress, isAddress, type Address, type Hash } from "viem";
import { RefusedMoment, type RefusedView } from "@/components/curb/refused";
import { CopyAddress } from "@/components/keys/copy-address";
import { KeyGlyph, Signer } from "@/components/keys/signer";
import { explorerUrl, publicClient } from "@/lib/chain/clients";
import { curbAccountAbi } from "@/lib/curb/abi";
import { GAS, gasFor, NATIVE, RESERVE, sendCreateAccount, sendDepositMon, sendWithdraw, waitForQuiet, type CurbAccountState } from "@/lib/curb/account";
import { explainRefusal, feePaid, revertDataOf } from "@/lib/curb/refusal";
import { appendLedger } from "@/lib/curb/ledger";
import { formatToken, parseDecimal, shortAddress } from "@/lib/format";
import { explainPasskeyError, type PasskeyProblem } from "@/lib/passkey/environment";
import type { CurbAccountRecord } from "@/lib/passkey/keys";
import { MON_PERP, MON_USDC, PERPS_ENABLED } from "@/lib/markets/registry";
import { marketLabel } from "@/lib/markets/selected";
import { usePasskeyKeys } from "@/hooks/use-passkey-keys";

const MON = 10n ** 18n;
/** Monad's gas price as paid on mainnet (102 gwei, E-013 and E-016): for showing a cost, never for sending. */
const GAS_PRICE_SEEN = 102n * 10n ** 9n;
/**
 * What an owner-key transaction must leave beyond its value: the node checks value + gas limit x max fee up front,
 * and viem's max fee sits ~20% above the price paid. 0.05 MON covers that gap for the create and deposit limits here.
 */
const GAS_HEADROOM = MON / 20n;
/** Left on the owner key by Max: enough for the owner-key transactions that come later (withdraw, rotate). */
const KEEP_FOR_GAS = MON / 2n;

type Tx =
  | { kind: "idle" }
  | { kind: "waiting" }
  | { kind: "signing" }
  | { kind: "sent"; hash: Hash }
  | { kind: "confirmed"; hash: Hash }
  | { kind: "error"; problem: PasskeyProblem; hash?: Hash };

type Props = {
  record: CurbAccountRecord;
  state: CurbAccountState | null;
  ownerMon: bigint | null;
  onChanged: () => void;
};

/**
 * The Curb account: the contract that holds the trading money on Kuru and enforces the split between the two keys.
 * Its address is fixed by the passkey's two keys (CREATE2), so it can be shown, and funded, before it exists.
 */
export function CurbAccountCard({ record, state, ownerMon, onChanged }: Props) {
  const id = useId();
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");
  const live = state?.deployed ?? false;
  // A v2 account also trades Perpl's MON perpetual; a v1 account only ever trades Kuru. One not created yet will be
  // whatever the app's factory makes.
  const perps = state?.deployed ? state.perps.supported : PERPS_ENABLED;
  return (
    <section aria-labelledby={`${id}-h`} className="panel rise overflow-hidden md:col-span-2" style={{ "--i": 1 } as CSSProperties}>
      <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10 md:p-7">
        <div className="flex flex-col gap-5">
          <header className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id={`${id}-h`} className="font-display text-[26px] font-bold uppercase leading-none tracking-[0.01em] text-road [font-variation-settings:'wdth'_75]">
                Curb account
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted">
                A contract on Monad that holds your trading money on {perps ? "Kuru and Perpl" : "Kuru"} and holds each key to its job.
              </p>
            </div>
            {state === null ? (
              <span className="pill text-muted">Reading…</span>
            ) : live ? (
              <a className="pill text-road" href={explorerUrl("address", state.address)} target="_blank" rel="noreferrer">
                <span className="size-1.5 rounded-full bg-live" aria-hidden="true" />
                <span className="text-live">Live on Monad</span>
              </a>
            ) : (
              <span className="pill border-dashed text-muted">Not created yet</span>
            )}
          </header>

          <ul className="flex flex-col divide-y divide-rule rounded-[12px] border border-rule bg-asphalt">
            <Rule glyph={<span className="text-kerb"><KeyGlyph role="owner" size={18} /></span>}>
              <span className="font-semibold text-kerb">Owner key</span> deposits, withdraws{perps ? ", sets the leverage cap" : ""} and can replace the trading key.
            </Rule>
            <Rule glyph={<span className="text-road"><KeyGlyph role="trading" size={18} /></span>}>
              <span className="font-semibold text-road">Trading key</span> places and cancels on Kuru {MON_USDC.base.symbol}-{MON_USDC.quote.symbol}
              {perps ? ` and Perpl ${marketLabel(MON_PERP)}, only inside the lane and under your leverage cap` : ", only inside the lane"}. It can&apos;t withdraw.
            </Rule>
          </ul>

          {state ? (
            <div>
              {!live ? (
                <p className="mb-2 text-[12px] leading-relaxed text-muted">
                  Its address is fixed by your two keys, before it exists. <span className="text-road">Don&apos;t send funds here yet:</span> MON for gas goes to your owner key.
                </p>
              ) : null}
              <CopyAddress address={state.address} />
            </div>
          ) : null}
          {live && state?.trader && state.trader.toLowerCase() !== record.trading.toLowerCase() ? (
            <p role="alert" className="rounded-[12px] border border-rule-strong bg-high px-3.5 py-3 text-[13px] text-muted">
              <span className="font-semibold text-road">This account accepts a different trading key.</span> Orders from this device will be refused onchain.
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 md:border-l md:border-rule md:pl-10">
          {state === null ? (
            <p className="text-[13px] text-muted">Reading the account from Monad…</p>
          ) : live ? (
            <>
              <Margin state={state} />
              <div className="kerb-painted -mx-5 md:mx-0 md:rounded-full" aria-hidden="true" />
              <div role="radiogroup" aria-label="Move money" className="grid grid-cols-2 gap-1.5 rounded-[12px] border border-rule bg-asphalt p-1">
                {(["deposit", "withdraw"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => setMode(m)}
                    className={`h-11 rounded-[9px] text-[15px] font-semibold transition-colors ${
                      mode === m ? "border border-road bg-high text-road" : "border border-transparent text-muted hover:text-road"
                    }`}
                  >
                    {m === "deposit" ? "Deposit" : "Withdraw"}
                  </button>
                ))}
              </div>
              {mode === "deposit" ? (
                <Deposit record={record} account={state.address} ownerMon={ownerMon} onChanged={onChanged} />
              ) : (
                <Withdraw record={record} state={state} ownerMon={ownerMon} onChanged={onChanged} />
              )}
            </>
          ) : (
            <Create record={record} account={state.address} ownerMon={ownerMon} onChanged={onChanged} />
          )}
        </div>
      </div>
    </section>
  );
}

function Rule({ glyph, children }: { glyph: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-4 py-3 text-[13px] leading-relaxed text-muted">
      <span className="mt-0.5 shrink-0">{glyph}</span>
      <span>{children}</span>
    </li>
  );
}

function Margin({ state }: { state: CurbAccountState }) {
  const cell = "rounded-[12px] border border-rule bg-asphalt px-4 py-3";
  const figure = "mt-1 font-display text-[24px] font-semibold text-road tnum [font-variation-settings:'wdth'_75]";
  return (
    <div>
      <p className="mb-2 text-[12px] text-muted">On Kuru, ready to trade</p>
      <dl className="grid grid-cols-2 gap-2.5">
        <div className={cell}>
          <dt className="text-[12px] text-muted">{MON_USDC.base.symbol}</dt>
          <dd className={figure}>{formatToken(state.margin.mon, MON_USDC.base.decimals, 4)}</dd>
        </div>
        <div className={cell}>
          <dt className="text-[12px] text-muted">{MON_USDC.quote.symbol}</dt>
          <dd className={figure}>{formatToken(state.margin.usdc, MON_USDC.quote.decimals, 2)}</dd>
        </div>
      </dl>
    </div>
  );
}

function Create({ record, account, ownerMon, onChanged }: { record: CurbAccountRecord; account: `0x${string}`; ownerMon: bigint | null; onChanged: () => void }) {
  const [tx, setTx] = useState<Tx>({ kind: "idle" });
  const keys = usePasskeyKeys();
  const fee = GAS.create * GAS_PRICE_SEEN;
  const short = ownerMon !== null && ownerMon < fee + GAS_HEADROOM;
  const busy = tx.kind === "signing" || tx.kind === "sent";
  // Funding is the slow step (#41): remember that the key was short, so the moment MON lands can be said out loud.
  const [wasShort, setWasShort] = useState(false);
  if (short && !wasShort) setWasShort(true);
  const arrived = wasShort && !short && ownerMon !== null;

  const create = async () => {
    if (!keys) return;
    setTx({ kind: "signing" });
    try {
      // Created already (another tab, or a retry)? A second create would collide and burn its whole gas limit.
      const code = await publicClient.getCode({ address: account });
      if (code && code !== "0x") {
        setTx({ kind: "idle" });
        onChanged();
        return;
      }
      const hash = await keys.withOwnerKey(window.location.hostname, record, (owner) => sendCreateAccount(owner, record.trading));
      setTx({ kind: "sent", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setTx({ kind: "error", hash, problem: { title: "The create transaction reverted.", body: "Nothing was created. The gas was spent." } });
        return;
      }
      appendLedger(account, { kind: "created", hash, at: Date.now() });
      setTx({ kind: "confirmed", hash });
      onChanged();
    } catch (error) {
      setTx({ kind: "error", problem: explainPasskeyError(error) });
    }
  };

  return (
    <>
      <div>
        <h3 className="text-[17px] font-semibold text-road">Create it onchain</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          One transaction through Curb&apos;s factory, signed by your owner key. Gas is about {formatToken(fee, 18, 2)} MON, paid from the owner key.
        </p>
      </div>
      <Signer role="owner" detail="creates the account" />
      <button type="button" onClick={create} disabled={busy || !keys || ownerMon === null || short} className="btn btn-owner w-full">
        <KeyGlyph role="owner" size={20} />
        {tx.kind === "signing" ? "Waiting for Face ID…" : tx.kind === "sent" ? "Confirming on Monad…" : "Create with Face ID"}
      </button>
      {short ? (
        <div className="flex flex-col gap-3 rounded-[12px] border border-dashed border-rule-strong px-3.5 py-3">
          <p className="text-[13px] leading-relaxed text-muted">
            Your owner key holds {formatToken(ownerMon ?? 0n, 18, 4)} MON; creating needs about {formatToken(fee + GAS_HEADROOM, 18, 2)} MON. Send MON on the{" "}
            <span className="text-road">Monad</span> network to your owner key:
          </p>
          <CopyAddress address={record.owner} />
          <p className="flex items-center gap-2 text-[12.5px] text-muted">
            <span className="size-1.5 shrink-0 rounded-full bg-faint motion-safe:animate-pulse" aria-hidden="true" />
            Watching your owner key on Monad. This moves on by itself when the MON lands.
          </p>
        </div>
      ) : null}
      <div aria-live="polite" className="text-[13px] empty:hidden">
        {arrived && tx.kind === "idle" ? (
          <p className="text-road">
            <span className="text-live">MON arrived</span> · {formatToken(ownerMon, 18, 4)} MON on your owner key. Create the account when you&apos;re ready.
          </p>
        ) : null}
        <TxLine tx={tx} />
      </div>
    </>
  );
}

function Deposit({ record, account, ownerMon, onChanged }: { record: CurbAccountRecord; account: `0x${string}`; ownerMon: bigint | null; onChanged: () => void }) {
  const id = useId();
  const [amountText, setAmountText] = useState("");
  const [tx, setTx] = useState<Tx>({ kind: "idle" });
  const keys = usePasskeyKeys();
  const amount = parseDecimal(amountText, MON);
  const max = ownerMon !== null && ownerMon > KEEP_FOR_GAS ? ownerMon - KEEP_FOR_GAS : 0n;
  const tooMuch = ownerMon !== null && amount !== null && amount + GAS_HEADROOM > ownerMon;
  const busy = tx.kind === "waiting" || tx.kind === "signing" || tx.kind === "sent";

  const deposit = async () => {
    if (!keys || amount === null || amount === 0n || ownerMon === null) return;
    try {
      // Leaving the owner key under Monad's 10 MON reserve only works if it sent nothing in the last 3 blocks.
      if (ownerMon - amount < RESERVE) {
        setTx({ kind: "waiting" });
        await waitForQuiet(publicClient, record.owner);
      }
      setTx({ kind: "signing" });
      const hash = await keys.withOwnerKey(window.location.hostname, record, (owner) => sendDepositMon(owner, account, amount));
      setTx({ kind: "sent", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        setTx({ kind: "error", hash, problem: { title: "The deposit reverted.", body: "No MON moved; the gas was spent." } });
        return;
      }
      appendLedger(account, { kind: "deposit", hash, at: Date.now(), token: NATIVE, amount: amount.toString() });
      setTx({ kind: "confirmed", hash });
      setAmountText("");
      onChanged();
    } catch (error) {
      setTx({ kind: "error", problem: explainPasskeyError(error) });
    }
  };

  return (
    <>
      <div>
        <h3 className="text-[17px] font-semibold text-road">Deposit MON</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          Moves MON from your owner key into the account on Kuru. Selling needs at least {(MON_USDC.minSize / MON_USDC.sizePrecision).toString()} MON there; buying needs USDC, which a sell leaves behind.
        </p>
      </div>
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
          {max > 0n ? (
            <button type="button" onClick={() => setAmountText(formatToken(max, 18, 4))} className="-my-3 min-h-11 rounded-full px-3 font-medium text-road hover:bg-high">
              Max
            </button>
          ) : null}
        </span>
      </label>
      <Signer role="owner" detail="signs this deposit" />
      <button type="button" onClick={deposit} disabled={busy || !keys || amount === null || amount === 0n || tooMuch || ownerMon === null} className="btn btn-owner w-full">
        <KeyGlyph role="owner" size={20} />
        {tx.kind === "waiting" ? "Waiting for Monad…" : tx.kind === "signing" ? "Waiting for Face ID…" : tx.kind === "sent" ? "Confirming on Monad…" : "Deposit with Face ID"}
      </button>
      <div aria-live="polite" className="text-[13px] empty:hidden">
        {tooMuch ? <p className="text-muted">That leaves too little on the owner key for gas.</p> : null}
        <TxLine tx={tx} />
      </div>
    </>
  );
}

/**
 * Owner key (Face ID): take money out of the account's Kuru margin, to the owner key or any address on Monad. Only
 * free margin can leave; what open orders hold comes back when they are cancelled.
 */
function Withdraw({ record, state, ownerMon, onChanged }: { record: CurbAccountRecord; state: CurbAccountState; ownerMon: bigint | null; onChanged: () => void }) {
  const id = useId();
  const [token, setToken] = useState<"MON" | "USDC">("MON");
  const [amountText, setAmountText] = useState("");
  const [dest, setDest] = useState<"owner" | "other">("owner");
  const [otherText, setOtherText] = useState("");
  const [tx, setTx] = useState<Tx>({ kind: "idle" });
  const [refused, setRefused] = useState<RefusedView | null>(null);
  const keys = usePasskeyKeys();

  const decimals = token === "MON" ? MON_USDC.base.decimals : MON_USDC.quote.decimals;
  const tokenAddress: Address = token === "MON" ? NATIVE : MON_USDC.quote.address;
  const available = token === "MON" ? state.margin.mon : state.margin.usdc;
  const amount = parseDecimal(amountText, 10n ** BigInt(decimals));
  const typed = otherText.trim();
  const to: Address | null = dest === "owner" ? record.owner : isAddress(typed, { strict: false }) ? getAddress(typed) : null;
  const badAddress = dest === "other" && typed !== "" && to === null;
  const tooMuch = amount !== null && amount > available;
  const gasNeeded = (token === "MON" ? GAS.withdrawMon : GAS.withdrawToken) * GAS_PRICE_SEEN + GAS_HEADROOM / 2n;
  const gasShort = ownerMon !== null && ownerMon < gasNeeded;
  const busy = tx.kind === "signing" || tx.kind === "sent";

  const withdraw = async () => {
    if (!keys || amount === null || amount === 0n || !to) return;
    setRefused(null);
    setTx({ kind: "signing" });
    try {
      const data = encodeFunctionData({ abi: curbAccountAbi, functionName: "withdraw", args: [tokenAddress, amount, to] });
      const gas = await gasFor(publicClient, { from: record.owner, to: state.address, data }, token === "MON" ? GAS.withdrawMon : GAS.withdrawToken, to);
      const hash = await keys.withOwnerKey(window.location.hostname, record, (owner) => sendWithdraw(owner, state.address, { token: tokenAddress, amount, to, gas }));
      setTx({ kind: "sent", hash });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        const refusal = explainRefusal(await revertDataOf(publicClient, hash), "withdraw", MON_USDC);
        appendLedger(state.address, { kind: "refused", hash, at: Date.now(), attempt: "withdraw", signer: "owner", error: refusal.error, detail: refusal.body });
        setRefused({ refusal, hash, signer: "owner", signerAddress: record.owner, fee: feePaid(receipt), source: "trace" });
        setTx({ kind: "idle" });
        return;
      }
      appendLedger(state.address, { kind: "withdraw", hash, at: Date.now(), token: tokenAddress, amount: amount.toString(), to });
      setTx({ kind: "confirmed", hash });
      setAmountText("");
      onChanged();
    } catch (error) {
      setTx({ kind: "error", problem: explainPasskeyError(error) });
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
    <>
      <div>
        <h3 className="text-[17px] font-semibold text-road">Withdraw</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">Out of the account on Kuru, to your owner key or any address on Monad. Cancel open orders first to free what they hold.</p>
      </div>

      <div role="radiogroup" aria-label="Token" className="grid grid-cols-2 gap-2">
        {(["MON", "USDC"] as const).map((t) => (
          <button key={t} type="button" role="radio" aria-checked={token === t} onClick={() => setToken(t)} className={chip(token === t)}>
            <span className="block font-semibold">{t}</span>
            <span className="block text-[12px] tnum">
              {formatToken(t === "MON" ? state.margin.mon : state.margin.usdc, t === "MON" ? MON_USDC.base.decimals : MON_USDC.quote.decimals, t === "MON" ? 4 : 2)} free
            </span>
          </button>
        ))}
      </div>

      <label htmlFor={`${id}-amt`} className="block rounded-[12px] border border-rule bg-asphalt px-4 pb-2.5 pt-3 transition-colors focus-within:border-kerb">
        <span className="flex items-center justify-between text-[12px] text-muted">
          Amount
          <span className="font-medium text-road">{token}</span>
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
          <span>
            {formatToken(available, decimals, token === "MON" ? 4 : 2)} {token} free on Kuru
          </span>
          {available > 0n ? (
            <button type="button" onClick={() => setAmountText(exact(available, decimals))} className="-my-3 min-h-11 rounded-full px-3 font-medium text-road hover:bg-high">
              Max
            </button>
          ) : null}
        </span>
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[12px] text-muted">To</legend>
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
          </div>
        ) : null}
      </fieldset>

      {to ? (
        <p className="figures break-all rounded-[10px] bg-asphalt px-3 py-2 text-[12px] leading-[1.7] text-road">
          <span className="text-muted">0x</span>
          {(to.slice(2).match(/.{1,4}/g) ?? []).join(" ")}
        </p>
      ) : null}
      <Signer role="owner" detail={to ? `withdraws to ${shortAddress(to)}` : "withdraws"} />
      <button type="button" onClick={withdraw} disabled={busy || !keys || amount === null || amount === 0n || tooMuch || !to || gasShort} className="btn btn-owner w-full">
        <KeyGlyph role="owner" size={20} />
        {tx.kind === "signing" ? "Waiting for Face ID…" : tx.kind === "sent" ? "Confirming on Monad…" : "Withdraw with Face ID"}
      </button>
      <div aria-live="polite" className="text-[13px] empty:hidden">
        {tooMuch ? <p className="text-muted">That&apos;s more than the account has free on Kuru.</p> : null}
        {gasShort ? <p className="text-muted">Your owner key needs about {formatToken(gasNeeded, 18, 3)} MON for gas. Send some to it first.</p> : null}
        <TxLine tx={tx} />
      </div>
      {refused ? <RefusedMoment key={refused.hash} view={refused} onDismiss={() => setRefused(null)} /> : null}
    </>
  );
}

/** The whole amount, every digit kept, trailing zeros dropped: "250", "6.319". */
function exact(amount: bigint, decimals: number): string {
  const s = formatToken(amount, decimals, decimals);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

function TxLine({ tx }: { tx: Tx }) {
  if (tx.kind === "sent" || tx.kind === "confirmed") {
    return (
      <a className="pill min-h-11 px-3 text-road" href={explorerUrl("tx", tx.hash)} target="_blank" rel="noreferrer">
        <span className={`size-1.5 rounded-full ${tx.kind === "confirmed" ? "bg-live" : "bg-muted"}`} aria-hidden="true" />
        <span className={tx.kind === "confirmed" ? "text-live" : ""}>{tx.kind === "confirmed" ? "Confirmed" : "Sent"}</span> ·{" "}
        <span className="figures text-[11px]">
          {tx.hash.slice(0, 10)}…{tx.hash.slice(-6)}
        </span>
        <ExternalLink size={13} aria-hidden="true" />
      </a>
    );
  }
  if (tx.kind === "error") {
    return (
      <div role="alert" className="rounded-[12px] border border-rule-strong bg-high px-3.5 py-3">
        <p className="font-semibold text-road">{tx.problem.title}</p>
        <p className="mt-0.5 break-words text-muted">{tx.problem.body}</p>
        {tx.hash ? (
          <a className="mt-1 inline-flex items-center gap-1 text-road underline decoration-faint underline-offset-4" href={explorerUrl("tx", tx.hash)} target="_blank" rel="noreferrer">
            See the transaction <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
      </div>
    );
  }
  return null;
}
