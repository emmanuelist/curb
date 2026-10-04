"use client";

import { useState, type CSSProperties } from "react";
import { ExternalLink } from "lucide-react";
import { KeyGlyph } from "@/components/keys/signer";
import { ChainSync } from "@/components/activity/chain-sync";
import { FilterTabs } from "@/components/curb/tabs";
import { ScreenHeader } from "@/components/navigation/app-nav";
import { explorerUrl } from "@/lib/chain/clients";
import type { LedgerEntry } from "@/lib/curb/ledger";
import { perpOrderHeading } from "@/lib/curb/perp";
import { refusedBy } from "@/lib/curb/refusal";
import { formatPrice, formatSize, formatToken, shortAddress } from "@/lib/format";
import { MARKETS, MON_USDC, PERPS_ENABLED } from "@/lib/markets/registry";
import { useCurbAccount } from "@/hooks/use-curb-account";
import { useChainHistory } from "@/hooks/use-chain-history";
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

const TRADES: ReadonlySet<LedgerEntry["kind"]> = new Set(["order", "cancel", "fill", "perp-order", "perp-cancel", "perp-fill", "cap"]);
/** Refused by Curb's own account. A venue's rejection, or a revert with no readable reason, isn't one. */
const curbRefused = (e: LedgerEntry) => e.kind === "refused" && refusedBy(e.error) === "curb";
const tabOf = (e: LedgerEntry): Tab =>
  curbRefused(e) ? "refusals" : e.kind === "refused" ? (e.attempt === "withdraw" ? "money" : "trades") : TRADES.has(e.kind) ? "trades" : "money";

/** History is a road: events sit on a lane line, newest first. Nothing is drawn until it is onchain. */
export function HistoryScreen() {
  const [tab, setTab] = useState<Tab>("all");
  const { state } = useCurbAccount();
  const entries = useLedger(state?.address ?? null);
  const chain = useChainHistory();
  // On a new device the record is empty until the chain has been read: say so, rather than "nothing onchain".
  const reading = chain.status === "reading" && entries.length === 0;
  const shown = [...entries].reverse().filter((e) => tab === "all" || tabOf(e) === tab);

  return (
    <main className="mx-auto w-full max-w-[860px] pb-32 md:px-8">
      <ScreenHeader title="History" lede="What happened onchain, and which key signed it." />
      <div className="mt-5 flex flex-col gap-4 px-4 md:mt-8 md:px-0">
        <FilterTabs label="Event type" items={TABS} value={tab} onChange={setTab} />
        <ChainSync h={chain} />
        <section role="tabpanel" aria-label="Timeline" className="panel rise relative overflow-hidden px-5 py-6" style={{ "--i": 2 } as CSSProperties}>
          {shown.length > 0 ? (
            <ol className="flex flex-col">
              {shown.map((e, i) => (
                <Event key={`${e.kind}:${e.hash}:${e.kind === "fill" || e.kind === "perp-fill" ? e.orderId : ""}`} entry={e} last={i === shown.length - 1} />
              ))}
            </ol>
          ) : (
            <div className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-4">
              <div className="flex flex-col items-center" aria-hidden="true">
                <span className="size-3.5 rounded-full border-2 border-road" />
                <span className="mt-2 w-[3px] grow bg-[repeating-linear-gradient(180deg,var(--mark-faint)_0_14px,transparent_0_26px)]" />
              </div>
              <div className="pb-16">
                <p className="text-[15px] font-semibold text-road">{reading ? "Reading your history from Monad" : "Nothing onchain yet"}</p>
                <p className="mt-1 max-w-[52ch] text-[13.5px] leading-relaxed text-muted">
                  {reading ? "Every transaction your two keys sent is found by nonce and decoded here. On a new device that takes a few seconds." : EMPTY[tab]}
                </p>
              </div>
            </div>
          )}
        </section>
        {entries.length > 0 ? (
          <p className="px-1 text-[12px] leading-relaxed text-muted">
            Every transaction your two keys sent since the account was created, found on Monad by nonce and decoded here.{" "}
            {PERPS_ENABLED ? "Kuru's and Perpl's events aren't" : "Kuru's events aren't"} indexed by account, so nothing else could list them. Each link opens the
            transaction on Monad.
          </p>
        ) : null}
      </div>
    </main>
  );
}

function Event({ entry, last }: { entry: LedgerEntry; last: boolean }) {
  const { title, detail, signer, code } = describe(entry);
  const refused = curbRefused(entry);
  return (
    <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-4">
      <div className="flex flex-col items-center" aria-hidden="true">
        <span className={`mt-1 grid size-5 place-items-center ${refused ? "text-stop" : signer === "owner" ? "text-kerb" : signer === "trading" ? "text-road" : "text-live"}`}>
          {signer === "kuru" || signer === "perpl" ? <span className="size-2.5 rounded-full bg-live" /> : <KeyGlyph role={signer} size={16} />}
        </span>
        {!last ? <span className="mt-1.5 w-[3px] grow bg-[repeating-linear-gradient(180deg,var(--mark-faint)_0_14px,transparent_0_26px)]" /> : null}
      </div>
      <div className={`min-w-0 ${last ? "" : "pb-6"}`}>
        {/* The time keeps its own column; a long error name wraps under the title instead of pushing the time down. */}
        <p className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3">
          <span className="text-[15px] font-semibold text-road">
            {title}
            {code ? <span className="figures text-[12px] font-normal text-muted"> {code}()</span> : null}
          </span>
          <time className="text-[12px] text-muted tnum" dateTime={new Date(entry.at).toISOString()}>
            {stamp(entry.at)}
          </time>
        </p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-muted">
          <span className={signer === "owner" ? "text-kerb" : signer === "trading" ? "text-road" : ""}>
            {signer === "owner" ? "Owner key · Face ID" : signer === "trading" ? "Trading key · no prompt" : `Filled by another trader on ${signer === "kuru" ? "Kuru" : "Perpl"}`}
          </span>
          {detail ? ` · ${detail}` : ""}
        </p>
        <a className="inline-flex min-h-11 items-center gap-1 text-[12.5px] text-road underline decoration-faint underline-offset-4" href={explorerUrl("tx", entry.hash)} target="_blank" rel="noreferrer">
          <span className="figures text-[11.5px]">
            {entry.hash.slice(0, 10)}…{entry.hash.slice(-6)}
          </span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

function describe(e: LedgerEntry): { title: string; detail: string; signer: "owner" | "trading" | "kuru" | "perpl"; code?: string } {
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
    case "withdraw": {
      const usdc = e.token.toLowerCase() === market.quote.address.toLowerCase();
      const amount = formatToken(BigInt(e.amount), usdc ? market.quote.decimals : market.base.decimals, usdc ? 2 : 4);
      return { title: `Withdrew ${amount} ${usdc ? market.quote.symbol : market.base.symbol}`, detail: `from the account to ${shortAddress(e.to)}`, signer: "owner" };
    }
    case "send":
      return { title: `Sent ${formatToken(BigInt(e.amount), 18, 4)} MON`, detail: `from the owner key to ${shortAddress(e.to)}`, signer: "owner" };
    case "refused": {
      const by = refusedBy(e.error);
      const title = by === "curb" ? "Refused onchain" : by === "kuru" ? "Rejected by Kuru" : by === "perpl" ? "Rejected by Perpl" : "Reverted onchain";
      return { title, detail: e.detail, signer: e.signer, code: e.error ?? undefined };
    }
    case "perp-order": {
      const m = MARKETS.find((x) => x.id === e.market) ?? market;
      const size = (n: bigint) => formatSize(n, m.sizePrecision);
      const traded = BigInt(e.filled) > 0n ? `${size(BigInt(e.filled))} traded on arrival` : "";
      const rest = e.orderId ? `resting on Perpl as #${e.orderId}` : "";
      return {
        title: `${perpOrderHeading(e.action, BigInt(e.lots), BigInt(e.filled), size)} ${m.base.symbol} at ${formatPrice(BigInt(e.price), m.pricePrecision)}${e.action.startsWith("open") ? ` · ${e.leverageHdths / 100}×` : ""}`,
        detail: [traded, rest].filter(Boolean).join(", ") || "on Perpl",
        signer: "trading",
      };
    }
    case "perp-cancel":
      return { title: `Cancelled Perpl #${e.orderId}`, detail: "", signer: "trading" };
    case "perp-fill": {
      const m = MARKETS.find((x) => x.id === e.market) ?? market;
      return { title: `Perpl #${e.orderId} filled ${formatSize(BigInt(e.lots), m.sizePrecision)} ${m.base.symbol}`, detail: `block ${Number(e.block).toLocaleString("en-US")}`, signer: "perpl" };
    }
    case "ausd-in":
      return { title: `Added ${formatToken(BigInt(e.amount), 6, 2)} AUSD`, detail: "to the account's margin on Perpl", signer: "owner" };
    case "swap":
      return { title: `Swapped ${formatToken(BigInt(e.monIn), 18, 2)} MON for ${formatToken(BigInt(e.ausdOut), 6, 2)} AUSD`, detail: "through Kuru Flow, onto the owner key", signer: "owner" };
    case "ausd-out":
      return { title: `Withdrew ${formatToken(BigInt(e.amount), 6, 2)} AUSD`, detail: `from Perpl to ${shortAddress(e.to)}`, signer: "owner" };
    case "cap":
      return { title: `Leverage cap set to ${e.capHdths / 100}×`, detail: "the most the trading key may use", signer: "owner" };
  }
}

function stamp(at: number): string {
  const d = new Date(at);
  const today = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return today ? time : `${d.toLocaleDateString([], { month: "short", day: "numeric" })}, ${time}`;
}
