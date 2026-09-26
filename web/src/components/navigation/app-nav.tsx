"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/curb/wordmark";
import { BlockIndicator } from "@/components/curb/block-indicator";

const ITEMS = [
  { href: "/", label: "Trade", icon: "M4 17 10 7l4 6 2-3 4 7M3 20h18" },
  { href: "/orders", label: "Orders", icon: "M6 4h12v16H6zM9 9h6M9 13h6M9 17h3" },
  { href: "/history", label: "History", icon: "M12 4v16M8 7h8M8 12h8M8 17h8" },
  { href: "/keys", label: "Keys", icon: "M7.5 20a4.5 4.5 0 1 1 3.2-7.7L20 3M16 7l3 3M13.5 9.5l2 2" },
  { href: "/more", label: "More", icon: "M5 12h.01M12 12h.01M19 12h.01" },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Desktop and tablet: a restrained top bar (BRIEF §14). */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b border-rule bg-asphalt/95 px-8 md:flex">
      <div className="flex items-center gap-10">
        <Wordmark />
        <nav aria-label="Primary">
          <ul className="flex gap-7">
            {ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative inline-flex h-16 items-center text-[13px] font-medium tracking-[0.06em] ${
                      active ? "text-road" : "text-muted hover:text-road"
                    }`}
                  >
                    {item.label.toUpperCase()}
                    {active ? <span className="absolute inset-x-0 bottom-0 h-[3px] bg-road" aria-hidden="true" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
      <BlockIndicator />
    </header>
  );
}

/** Mobile: bottom navigation, thumb-reachable (BRIEF §14). */
export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-asphalt pb-[env(safe-area-inset-bottom)] md:hidden">
      <ul className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium tracking-[0.04em] ${
                  active ? "text-road" : "text-muted"
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.2 : 1.7} strokeLinecap="square" aria-hidden="true">
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Mobile top bar: wordmark and the live block. */
export function MobileTopBar() {
  return (
    <header className="flex h-13 items-center justify-between px-5 md:hidden">
      <Wordmark />
      <BlockIndicator />
    </header>
  );
}
