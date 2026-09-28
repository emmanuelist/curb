"use client";

import { useState, type CSSProperties } from "react";
import { ExternalLink } from "lucide-react";
import { KeyGlyph } from "@/components/keys/signer";
import { FilterTabs } from "@/components/curb/tabs";
import { ScreenHeader } from "@/components/navigation/app-nav";
import { explorerUrl } from "@/lib/chain/clients";
import type { LedgerEntry } from "@/lib/curb/ledger";
import { formatPrice, formatSize, formatToken } from "@/lib/format";
import { MON_USDC } from "@/lib/markets/registry";
import { useCurbAccount } from "@/hooks/use-curb-account";
import { useLedger } from "@/hooks/use-ledger";

const market = MON_USDC;

const TABS = [
  { id: "all", label: "All" },
  { id: "trades", label: "Trades" },
  { id: "money", label: "Transfers" },
  { id: "refusals", label: "Refusals" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const EMPTY: Record<Tab, string> = {
  all: "Every trade, cancel, deposit, withdrawal and refusal lands here with the key that signed it and a link to the transaction on Monad.",
  trades: "Orders, fills and cancels from your trading key, each with its transaction.",
  money: "Money moving in or out. Deposits and withdrawals are always signed by your owner key, with Face ID.",
  refusals: "Anything your Curb account refused onchain, like a withdrawal from the trading key or an order past the curb.",
};

const tabOf = (e: LedgerEntry): Tab => (e.kind === "order" || e.kind === "cancel" || e.kind === "fill" ? "trades" : "money");

/** History is a road: events sit on a lane line, newest first. Nothing is drawn until it is onchain. */
export function HistoryScreen() {
  const [tab, setTab] = useState<Tab>("all");
  const { state } = useCurbAccount();
  const entries = useLedger(state?.address ?? null);
  const shown = [...entries].reverse().filter((e) => tab === "all" || tabOf(e) === tab);

  return (
    <main className="mx-auto w-full max-w-[860px] pb-32 md:px-8">
      <ScreenHeader title="History" lede="What happened onchain, and which key signed it." />
      <div className="mt-5 flex flex-col gap-4 px-4 md:mt-8 md:px-0">
        <FilterTabs label="Event type" items={TABS} value={tab} onChange={setTab} />
        <section role="tabpanel" aria-label="Timeline" className="panel rise relative overflow-hidden px-5 py-6" style={{ "--i": 2 } as CSSProperties}>
          {shown.length > 0 ? (
            <ol className="flex flex-col">
              {shown.map((e, i) => (
                <Event key={`${e.kind}:${e.hash}:${e.kind === "fill" ? e.orderId : ""}`} entry={e} last={i === shown.length - 1} />
              ))}
            </ol>
          ) : (
            <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-4">
              <div className="flex flex-col items-center" aria-hidden="true">
                <span className="size-3.5 rounded-full border-2 border-road" />
                <span className="mt-2 w-[3px] grow bg-[repeating-linear-gradient(180deg,var(--mark-faint)_0_14px,transparent_0_26px)]" />
              </div>
              <div className="pb-16">
                <p className="text-[15px] font-semibold text-road">Nothing onchain yet</p>
                <p className="mt-1 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">{EMPTY[tab]}</p>
              </div>
            </div>
          )}
        </section>
        {entries.length > 0 ? (
          <p className="px-1 text-[12px] leading-relaxed text-muted">
            Transactions sent from this device. Kuru&apos;s events aren&apos;t indexed by account, so Curb keeps the hashes it sent and every link opens the
            transaction on Monad.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function Event({ entry, last }: { entry: LedgerEntry; last: boolean }) {
  const { title, detail, signer } = describe(entry);
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-4">
      <div className="flex flex-col items-center" aria-hidden="true">
        <span className={`mt-1 grid size-5 place-items-center ${signer === "owner" ? "text-kerb" : signer === "trading" ? "text-road" : "text-live"}`}>
          {signer === "kuru" ? <span className="size-2.5 rounded-full bg-live" /> : <KeyGlyph role={signer} size={16} />}
        </span>
        {!last ? <span className="mt-1.5 w-[3px] grow bg-[repeating-linear-gradient(180deg,var(--mark-faint)_0_14px,transparent_0_26px)]" /> : null}
      </div>
      <div className={`min-w-0 ${last ? "" : "pb-6"}`}>
        <p className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="text-[15px] font-semibold text-road">{title}</span>
          <time className="text-[12px] text-muted tnum" dateTime={new Date(entry.at).toISOString()}>
            {stamp(entry.at)}
          </time>
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
          <span className={signer === "owner" ? "text-kerb" : signer === "trading" ? "text-road" : ""}>
            {signer === "owner" ? "Owner key · Face ID" : signer === "trading" ? "Trading key · no prompt" : "Filled by another trader on Kuru"}
          </span>
          {detail ? ` · ${detail}` : ""}
        </p>
        <a className="mt-1 inline-flex min-h-8 items-center gap-1 text-[12.5px] text-road underline decoration-faint underline-offset-4" href={explorerUrl("tx", entry.hash)} target="_blank" rel="noreferrer">
          <span className="figures text-[11.5px]">
            {entry.hash.slice(0, 10)}…{entry.hash.slice(-6)}
          </span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

function describe(e: LedgerEntry): { title: string; detail: string; signer: "owner" | "trading" | "kuru" } {
  const s = (x: string) => formatSize(BigInt(x), market.sizePrecision);
  switch (e.kind) {
    case "created":
      return { title: "Curb account created", detail: "through Curb's factory", signer: "owner" };
    case "deposit":
      return { title: `Deposited ${formatToken(BigInt(e.amount), 18, 4)} MON`, detail: "into the account on Kuru", signer: "owner" };
    case "order": {
      const word = e.side === "buy" ? "Buy" : "Sell";
      const at = formatPrice(BigInt(e.price), market.pricePrecision);
      const filled = BigInt(e.takerFill) > 0n ? `${s(e.takerFill)} filled on arrival` : "";
      const rest = e.orderId ? `resting as #${e.orderId}` : "";
      return { title: `${word} ${s(e.size)} ${market.base.symbol} at ${at}`, detail: [filled, rest].filter(Boolean).join(", "), signer: "trading" };
    }
    case "cancel":
      return { title: `Cancelled ${e.orderIds.map((id) => `#${id}`).join(", ")}`, detail: "", signer: "trading" };
    case "fill":
      return { title: `#${e.orderId} filled ${s(e.size)} ${market.base.symbol}`, detail: `block ${Number(e.block).toLocaleString("en-US")}`, signer: "kuru" };
  }
}

function stamp(at: number): string {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return today ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}
