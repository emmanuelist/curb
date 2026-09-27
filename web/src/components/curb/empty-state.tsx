import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

/** An honest empty panel: what will appear here, and nothing pretending to be it. */
export function EmptyPanel({
  icon: Icon,
  title,
  children,
  action,
  i = 2,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  action?: { href: string; label: string };
  i?: number;
}) {
  return (
    <section className="panel rise flex flex-col items-center px-6 py-10 text-center" style={{ "--i": i } as CSSProperties}>
      <span className="grid size-14 place-items-center rounded-full border border-rule-strong bg-high text-road">
        <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-[18px] font-semibold text-road">{title}</h2>
      <div className="mt-1.5 max-w-[44ch] text-[13.5px] leading-relaxed text-muted">{children}</div>
      {action ? (
        <Link href={action.href} className="btn btn-quiet mt-6 min-h-12 px-5 text-[15px]">
          {action.label} <ArrowRight size={17} aria-hidden="true" />
        </Link>
      ) : null}
    </section>
  );
}
