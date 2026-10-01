"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/ships", label: "Ships" },
  { href: "/cards", label: "Cards" },
  { href: "/requests", label: "Requests" },
  { href: "/stats", label: "Stats" },
  { href: "/about", label: "About" },
];

export function MobileNav({ pendingRequestCount = 0 }: { pendingRequestCount?: number }) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-cream-100 md:hidden">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative flex-1 py-3 text-center text-xs font-medium ${
              active ? "text-lavender-600" : "text-ink-faint"
            }`}
          >
            {item.label}
            {item.href === "/requests" && pendingRequestCount > 0 && (
              <span className="absolute right-1/4 top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-blossom-500 px-1 text-[10px] font-semibold text-white">
                {pendingRequestCount}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
