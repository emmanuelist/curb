"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ArrowUpFromLine, ChevronRight, Code2, ExternalLink, Globe, ListOrdered, Ruler, type LucideIcon } from "lucide-react";
import { KeyGlyph } from "@/components/keys/signer";
import { ScreenHeader } from "@/components/navigation/app-nav";
import { explorerUrl } from "@/lib/chain/clients";
import { shortAddress } from "@/lib/format";
import { LANE_BAND_BPS, MON_USDC } from "@/lib/markets/registry";
import { useAccount } from "@/hooks/use-account";

const band = `±${(Number(LANE_BAND_BPS) / 100).toFixed(2)}%`;

export function MoreScreen() {
  const account = useAccount();
  return (
    <main className="mx-auto w-full max-w-[860px] pb-32 md:px-8">
      <ScreenHeader title="More" menu={false} />
      <div className="mt-5 flex flex-col gap-4 px-4 md:mt-8 md:px-0">
        <Group i={1}>
          {account ? (
            <Row href="/keys" glyph={<KeyGlyph role="trading" size={18} />} label="Curb account" value={<span className="tnum">{shortAddress(account.trading)}</span>} />
          ) : (
            <Row href="/start" glyph={<KeyGlyph role="trading" size={18} />} label="Create your account" />
          )}
          <Row icon={ArrowUpFromLine} label="Withdrawals" value={<span className="text-kerb">Owner key · Face ID</span>} />
        </Group>

        <Group i={2}>
          <Row icon={Globe} label="Network" value="Monad mainnet" />
          <Row
            href={explorerUrl("address", MON_USDC.orderBook)}
            external
            icon={ListOrdered}
            label="Market"
            value={`Kuru ${MON_USDC.base.symbol} / ${MON_USDC.quote.symbol}`}
          />
          <Row icon={Ruler} label="Lane width" value={`${band} of best price`} />
          <Row href="https://github.com/emmanuelist/curb" external icon={Code2} label="Source code" value="GitHub" />
        </Group>

        <section aria-labelledby="about-h" className="panel rise p-5" style={{ "--i": 3 } as CSSProperties}>
          <h2 id="about-h" className="text-[15px] font-semibold text-road">
            About Curb
          </h2>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            Curb trades on Kuru, the fully onchain order book on Monad. One passkey gives you two keys: an <span className="text-kerb">owner key</span>, the
            only key that can move money out, and a <span className="text-road">trading key</span> that places and cancels orders inside the lane without a
            prompt.
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            The lane is Kuru&apos;s live best bid and ask, {band}. Your Curb account checks the same line onchain, so an order outside it is refused by the
            contract, not just by this app.
          </p>
        </section>
      </div>
    </main>
  );
}

function Group({ i, children }: { i: number; children: ReactNode }) {
  return (
    <ul className="panel rise divide-y divide-rule overflow-hidden" style={{ "--i": i } as CSSProperties}>
      {children}
    </ul>
  );
}

function Row({ icon: Icon, glyph, label, value, href, external = false }: { icon?: LucideIcon; glyph?: ReactNode; label: string; value?: ReactNode; href?: string; external?: boolean }) {
  const body = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-full border border-rule-strong bg-high text-road">
        {Icon ? <Icon size={17} strokeWidth={1.8} aria-hidden="true" /> : glyph}
      </span>
      <span className="min-w-0 grow truncate text-[15px] text-road">{label}</span>
      {value ? <span className="shrink-0 text-right text-[13.5px] text-muted">{value}</span> : null}
      {href ? external ? <ExternalLink size={15} className="shrink-0 text-muted" aria-hidden="true" /> : <ChevronRight size={17} className="shrink-0 text-muted" aria-hidden="true" /> : null}
    </>
  );
  const cls = "flex min-h-[60px] items-center gap-3.5 px-4";
  return (
    <li>
      {href ? (
        external ? (
          <a href={href} target="_blank" rel="noreferrer" className={`${cls} transition-colors hover:bg-high`}>
            {body}
          </a>
        ) : (
          <Link href={href} className={`${cls} transition-colors hover:bg-high`}>
            {body}
          </Link>
        )
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  );
}
