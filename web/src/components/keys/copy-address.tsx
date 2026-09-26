"use client";

import { useState } from "react";
import { explorerUrl } from "@/lib/chain/clients";

/** A full address, grouped for reading aloud, with copy and explorer links. */
export function CopyAddress({ address, tone }: { address: string; tone: "owner" | "trading" }) {
  const [copied, setCopied] = useState(false);
  const groups = address.slice(2).match(/.{1,4}/g) ?? [];
  return (
    <span className="flex flex-col gap-1.5">
      <span className={`figures break-all text-[12px] leading-relaxed ${tone === "owner" ? "text-kerb" : "text-road"}`}>
        0x{groups.join(" ")}
      </span>
      <span className="flex gap-4 text-[12px]">
        <button
          type="button"
          className="min-h-8 text-road underline decoration-faint underline-offset-4"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(address);
              setCopied(true);
              setTimeout(() => setCopied(false), 1600);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? "Copied" : "Copy address"}
        </button>
        <a className="min-h-8 text-muted underline decoration-faint underline-offset-4" href={explorerUrl("address", address)} target="_blank" rel="noreferrer">
          View on Monadscan ↗
        </a>
      </span>
    </span>
  );
}
