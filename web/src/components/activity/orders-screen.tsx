"use client";

import { useState } from "react";
import { ClipboardList } from "lucide-react";
import { LanePreview } from "@/components/activity/lane-preview";
import { EmptyPanel } from "@/components/curb/empty-state";
import { FilterTabs } from "@/components/curb/tabs";
import { ScreenHeader } from "@/components/navigation/app-nav";

const TABS = [
  { id: "open", label: "Open" },
  { id: "filled", label: "Filled" },
  { id: "cancelled", label: "Cancelled" },
] as const;

const EMPTY: Record<(typeof TABS)[number]["id"], { title: string; body: string }> = {
  open: { title: "No open orders", body: "Orders your trading key places on Kuru rest here until they fill or you cancel them, each drawn against the lane it was placed in." },
  filled: { title: "No filled orders", body: "When an order fills on Kuru, it moves here with the block it filled in and a link to the transaction on Monad." },
  cancelled: { title: "No cancelled orders", body: "Cancelled orders stay here, so you can see what your trading key pulled and when." },
};

export function OrdersScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("open");
  return (
    <main className="mx-auto w-full max-w-[860px] pb-32 md:px-8">
      <ScreenHeader title="Orders" lede="Everything your trading key has placed on Kuru's book." />
      <div className="mt-5 flex flex-col gap-4 px-4 md:mt-8 md:px-0">
        <FilterTabs label="Order status" items={TABS} value={tab} onChange={setTab} />
        {tab === "open" ? <LanePreview /> : null}
        <div role="tabpanel" aria-label={EMPTY[tab].title}>
          <EmptyPanel key={tab} i={3} icon={ClipboardList} title={EMPTY[tab].title} action={tab === "open" ? { href: "/", label: "Go to the lane" } : undefined}>
            {EMPTY[tab].body}
          </EmptyPanel>
        </div>
      </div>
    </main>
  );
}
