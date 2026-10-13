"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_ITEMS } from "./AdminSidebar";

/**
 * The desktop admin sidebar is `hidden md:block` — with nothing else, the
 * Admin Portal had no navigation at all below that breakpoint, so "Create
 * Ship", "Audit Log", etc. were simply unreachable on a phone unless you
 * switched the browser to desktop mode. This is that missing mobile
 * equivalent: all the same tabs, in a horizontally-scrollable strip so
 * every one of them stays reachable regardless of screen width, rather
 * than trying to cram eight items into a fixed-width bottom bar.
 */
export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 flex gap-1.5 overflow-x-auto border-b border-border bg-cream-100 px-3 py-2 md:hidden">
      {ADMIN_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              active ? "bg-lavender-500 text-white" : "border border-border bg-white text-ink-soft"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
