import Link from "next/link";
import type { ReactNode } from "react";

/** An honest empty screen, drawn as an empty stretch of lane. */
export function EmptyLane({
  title,
  eyebrow,
  children,
  action,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <main className="mx-auto w-full max-w-[720px] px-5 pb-28 pt-2 md:pt-14">
      <p className="text-[12px] font-semibold tracking-[0.14em] text-muted">{eyebrow}</p>
      <h1 className="mt-2 font-display text-[44px] font-extrabold leading-none [font-variation-settings:'wdth'_62] md:text-[64px]">{title}</h1>
      <div className="mt-8 bg-lane" aria-hidden="true">
        <div className="curb-line" />
        <div className="flex h-24 items-center px-5">
          <div className="lane-dashes grow opacity-40" />
        </div>
        <div className="curb-line" />
      </div>
      <div className="mt-6 max-w-[52ch] text-[14px] leading-relaxed text-muted">{children}</div>
      {action ? (
        <Link
          href={action.href}
          className="mt-8 inline-flex h-12 items-center rounded-[2px] border-[1.5px] border-road px-5 font-display text-[15px] font-extrabold tracking-[0.06em] [font-variation-settings:'wdth'_75]"
        >
          {action.label}
        </Link>
      ) : null}
    </main>
  );
}
