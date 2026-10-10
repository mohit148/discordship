"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function MobileNav({
  pendingRequestCount = 0,
  navItems,
}: {
  pendingRequestCount?: number;
  navItems: { key: string; label: string; href: string }[];
}) {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-cream-100 md:hidden">
      {navItems.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative min-w-0 flex-1 truncate px-1 py-3 text-center text-xs font-medium ${
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
