"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";

// Admin-only pages. The normal site pages (Ships, Cards, Stats, About)
// deliberately aren't listed here — the logo takes you back to the site.
// Shared with AdminMobileNav, so the desktop sidebar and the mobile tab
// strip never drift out of sync with each other.
export const ADMIN_ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/ships", label: "Ships" },
  { href: "/admin/ships/new", label: "Create Ship" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/backgrounds", label: "Backgrounds" },
  { href: "/admin/rules", label: "Rules" },
  { href: "/admin/navigation", label: "Navigation" },
  { href: "/admin/audit-log", label: "Audit Log" },
];

export function AdminSidebar({
  currentUser,
  pendingCount,
}: {
  currentUser: { username: string; displayName?: string | null; avatarUrl: string | null };
  pendingCount?: number;
}) {
  const pathname = usePathname();
  const name = currentUser.displayName || currentUser.username;

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col justify-between border-r border-border bg-cream-100 px-4 py-6">
      <div>
        <Link href="/" className="mb-8 block px-2 text-2xl font-semibold tracking-tight text-ink">
          <span className="text-blossom-500">s</span>hip<span className="text-lavender-500">.</span>
        </Link>

        <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wide text-ink-faint">
          Admin
        </p>
        <nav className="flex flex-col gap-1">
          {ADMIN_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between rounded px-3 py-2 text-sm transition-colors ${
                  active ? "bg-lavender-100 font-medium text-lavender-600" : "text-ink-soft hover:bg-cream-200"
                }`}
              >
                {item.label}
                {item.href === "/admin/requests" && !!pendingCount && (
                  <span className="rounded-full bg-blossom-500 px-1.5 text-xs text-white">{pendingCount}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="rounded-lg border border-border bg-cream-50 p-3">
        <div className="flex items-center gap-2.5">
          <Avatar src={currentUser.avatarUrl} alt={name} size={32} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-ink">{name}</p>
            <a href="/api/auth/logout" className="text-xs text-ink-faint hover:text-ink-soft">
              Log out
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}
