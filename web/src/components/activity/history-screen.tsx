"use client";

import { useState, type CSSProperties } from "react";
import { FilterTabs } from "@/components/curb/tabs";
import { ScreenHeader } from "@/components/navigation/app-nav";

const TABS = [
  { id: "all", label: "All" },
  { id: "trades", label: "Trades" },
  { id: "money", label: "Transfers" },
  { id: "refusals", label: "Refusals" },
] as const;

const EMPTY: Record<(typeof TABS)[number]["id"], string> = {
  all: "Every trade, cancel, deposit, withdrawal and refusal lands here with the key that signed it and a link to the transaction on Monad.",
  trades: "Fills and cancels from your trading key, each with its block and transaction.",
  money: "Money moving in or out. Withdrawals are always signed by your owner key, with Face ID.",
  refusals: "Anything your Curb account refused onchain, like a withdrawal from the trading key or an order past the curb.",
};

/** History is a road: events sit on a lane line, newest first. Nothing is drawn until it is onchain. */
export function HistoryScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("all");
  return (
    <main className="mx-auto w-full max-w-[860px] pb-32 md:px-8">
      <ScreenHeader title="History" lede="What happened onchain, and which key signed it." />
      <div className="mt-5 flex flex-col gap-4 px-4 md:mt-8 md:px-0">
        <FilterTabs label="Event type" items={TABS} value={tab} onChange={setTab} />
        <section role="tabpanel" aria-label="Timeline" className="panel rise relative overflow-hidden px-5 py-6" style={{ "--i": 2 } as CSSProperties}>
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
        </section>
      </div>
    </main>
  );
}
