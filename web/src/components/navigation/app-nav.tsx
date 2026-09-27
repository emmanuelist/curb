"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRightLeft, ClipboardList, Clock3, Ellipsis, KeyRound, Menu, type LucideIcon } from "lucide-react";
import { Wordmark } from "@/components/curb/wordmark";
import { BlockIndicator } from "@/components/curb/block-indicator";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Trade", icon: ArrowRightLeft },
  { href: "/orders", label: "Orders", icon: ClipboardList },
  { href: "/history", label: "History", icon: Clock3 },
  { href: "/keys", label: "Keys", icon: KeyRound },
  { href: "/more", label: "More", icon: Ellipsis },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Desktop and tablet: a restrained top bar (BRIEF §14). */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 hidden h-[72px] items-center justify-between border-b border-rule bg-asphalt/85 px-8 backdrop-blur-md md:flex">
      <div className="flex items-center gap-6 lg:gap-12">
        <Wordmark />
        <nav aria-label="Primary">
          <ul className="flex gap-1">
            {ITEMS.map(({ href, label, icon: Icon }) => {
              const active = isActive(pathname, href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-10 items-center gap-2 rounded-full px-3 text-[14px] font-medium transition-colors lg:px-4 ${
                      active ? "bg-high text-road ring-1 ring-rule-strong" : "text-muted hover:text-road"
                    }`}
                  >
                    <Icon size={17} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <div className="hidden lg:block">
        <BlockIndicator />
      </div>
    </header>
  );
}

/** Mobile: the board's tab bar, thumb-reachable (BRIEF §14). */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-asphalt/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden">
      <ul className="grid h-[72px] grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1.5 text-[12px] font-medium ${active ? "text-road" : "text-muted"}`}
              >
                <Icon size={22} strokeWidth={active ? 2.2 : 1.7} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** The header for every screen except Trade (whose header lives in its hero). One h1 at every size. */
export function ScreenHeader({ title, lede, aside, menu = true }: { title: string; lede?: string; aside?: React.ReactNode; menu?: boolean }) {
  return (
    <header className="rise flex items-start justify-between gap-4 px-[22px] pt-6 md:px-0 md:pt-12">
      <div className="min-w-0">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.015em] text-road md:text-[44px]">{title}</h1>
        {lede ? <p className="mt-1 max-w-[52ch] text-[14px] leading-relaxed text-muted md:mt-2 md:text-[15px]">{lede}</p> : null}
        {/* A stretch of lane marking under every title: the road runs through every screen, not just Trade. */}
        <div className="lane-dashes mt-4 w-[122px] opacity-60 md:mt-5" aria-hidden="true" />
      </div>
      {aside ? <div className="hidden shrink-0 md:block">{aside}</div> : null}
      {menu ? (
        <Link href="/more" aria-label="Menu" className="-mr-2.5 grid size-[44px] shrink-0 place-items-center rounded-[12px] text-road transition-colors hover:bg-high/70 md:hidden">
          <Menu size={24} strokeWidth={2.4} />
        </Link>
      ) : null}
    </header>
  );
}
