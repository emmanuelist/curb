import { ExternalLink, X } from "lucide-react";
import type { Address, Hash } from "viem";
import { KeyGlyph } from "@/components/keys/signer";
import { explorerUrl } from "@/lib/chain/clients";
import type { Refusal } from "@/lib/curb/refusal";
import { formatToken, shortAddress } from "@/lib/format";

export type RefusedView = {
  refusal: Refusal;
  hash: Hash;
  signer: "owner" | "trading";
  signerAddress: Address;
  /** MON the signer paid for the refused transaction (from its receipt). */
  fee: bigint | null;
  /** What happened next, e.g. the ticket snapping back to the curb. */
  after?: string;
  /** Where the reason came from: the node's trace of this transaction, or a dry run of the same call just before. */
  source: "trace" | "dry-run";
};

/**
 * The refusal moment (BRIEF §11): a red stop line comes down, the stencil sign is painted on the refused zone's
 * hatching, then the reason read from the chain, which key tried, and the rejected transaction. Short and physical: a
 * barrier, not an alarm. Red is paint here (the line, the sign, the border), never small text (DESIGN.md).
 */
export function RefusedMoment({ view, onDismiss }: { view: RefusedView; onDismiss?: () => void }) {
  const { refusal, hash, signer, signerAddress, fee, after, source } = view;
  const paid = fee === null || fee === 0n ? null : fee < 10n ** 14n ? "under 0.0001" : formatToken(fee, 18, 4);
  return (
    <section role="alert" aria-label={`Refused onchain: ${refusal.signage.join(" ")}`} className="overflow-hidden rounded-[14px] border border-stop/55 bg-asphalt">
      <div className="stop-painted refused-barrier" aria-hidden="true" />
      <div className="hatch relative px-4 py-3">
        <p className="refused-sign font-stencil text-[46px] font-extrabold uppercase leading-[0.88] tracking-[0.02em] text-stop" aria-hidden="true">
          {refusal.signage.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="absolute right-1.5 top-1.5 grid size-11 place-items-center rounded-full bg-asphalt/80 text-muted hover:bg-high hover:text-road"
          >
            <X size={16} aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <div className="px-4 pb-4 pt-3">
        <p className="text-[14px] font-semibold text-road">
          {refusal.title}
          {refusal.error ? <span className="figures text-[12px] font-normal text-muted"> {refusal.error}()</span> : null}
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{refusal.body}</p>
        {after ? <p className="mt-1 text-[13px] leading-relaxed text-road">{after}</p> : null}
        {source === "dry-run" ? (
          <p className="mt-1 text-[12px] text-muted">The node didn&apos;t return this transaction&apos;s trace; the reason is from a dry run of the same call a moment before.</p>
        ) : null}
        <p className="mt-3 text-[12px] leading-relaxed text-muted">
          <span className={`mr-1.5 inline-block align-[-3px] ${signer === "owner" ? "text-kerb" : "text-road"}`}>
            <KeyGlyph role={signer} size={15} />
          </span>
          <span className={`font-semibold ${signer === "owner" ? "text-kerb" : "text-road"}`}>{signer === "owner" ? "Owner key" : "Trading key"}</span>{" "}
          <span className="figures text-[11px]">{shortAddress(signerAddress)}</span> tried it
          {paid ? ` · paid ${paid} MON gas` : ""} · nothing else moved
        </p>
        <a className="pill mt-3 min-h-11 border-stop/55 px-3 text-road" href={explorerUrl("tx", hash)} target="_blank" rel="noreferrer">
          <span className="font-semibold uppercase tracking-[0.08em]">Rejected</span> ·{" "}
          <span className="figures text-[11px]">
            {hash.slice(0, 10)}…{hash.slice(-6)}
          </span>
          <ExternalLink size={13} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
