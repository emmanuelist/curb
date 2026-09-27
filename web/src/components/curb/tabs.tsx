"use client";

import type { CSSProperties } from "react";

/** The board's filter pills. The selected pill is road white: selection is not money, so never yellow. */
export function FilterTabs<T extends string>({ items, value, onChange, label }: { items: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="rise flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" style={{ "--i": 1 } as CSSProperties}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(item.id)}
            className={`h-10 shrink-0 rounded-full border px-3.5 text-[14px] font-medium transition-colors ${
              selected ? "border-road bg-high text-road" : "border-rule bg-panel text-muted hover:text-road"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
