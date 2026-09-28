"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { explorerUrl } from "@/lib/chain/clients";

/** A full address, grouped for reading aloud, with copy and explorer actions. */
export function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const groups = address.slice(2).match(/.{1,4}/g) ?? [];
  return (
    <div className="flex flex-col gap-2.5">
      {/* The address is public (where funds are sent); the private key is never shown or stored anywhere. */}
      <p className="text-[12px] text-muted">Public address · safe to share</p>
      <p className="figures -mt-1.5 text-[12.5px] leading-[1.7] text-road">
        <span className="text-muted">0x</span>
        {groups.join(" ")}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="pill min-h-9 border-rule-strong bg-high px-3 text-road transition-colors hover:border-muted"
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
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
          {copied ? "Copied" : "Copy"}
        </button>
        <a className="pill min-h-9 px-3 text-muted transition-colors hover:text-road" href={explorerUrl("address", address)} target="_blank" rel="noreferrer">
          Monadscan <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
