"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";

const ICONS: Record<string, (props: React.SVGProps<SVGSVGElement>) => JSX.Element> = {
  ships: HeartIcon,
  cards: CardsIcon,
  requests: InboxIcon,
  stats: BarChartIcon,
  about: InfoIcon,
  rules: RulesIcon,
};

export function Sidebar({
  currentUser,
  pendingRequestCount = 0,
  navItems,
}: {
  navItems: { key: string; label: string; href: string }[];
  currentUser?: { username: string; displayName?: string | null; avatarUrl: string | null } | null;
  pendingRequestCount?: number;
}) {
  const pathname = usePathname();
  const name = currentUser?.displayName || currentUser?.username;

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col justify-between border-r border-border bg-cream-100 px-4 py-6">
      <div>
        <Link href="/" className="mb-8 block px-2 text-2xl font-semibold tracking-tight text-ink">
          <span className="text-blossom-500">s</span>hip<span className="text-lavender-500">.</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = ICONS[item.key] ?? InfoIcon;
            const showBadge = item.href === "/requests" && pendingRequestCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-lavender-100 font-medium text-lavender-600"
                    : "text-ink-soft hover:bg-cream-200"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {showBadge && (
                  <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-blossom-500 px-1 text-[11px] font-semibold text-white">
                    {pendingRequestCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="rounded-2xl border border-border bg-cream-50 p-3">
        {currentUser ? (
          <div className="flex items-center gap-2.5">
            <Avatar src={currentUser.avatarUrl} alt={name ?? currentUser.username} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{name}</p>
              <a href="/api/auth/logout" className="text-xs text-ink-faint hover:text-ink-soft">
                Log out
              </a>
            </div>
          </div>
        ) : (
          <a
            href="/api/auth/discord"
            className="flex items-start gap-2.5 text-ink-soft hover:text-ink"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-lavender-500 text-cream-50">
              <DiscordIcon className="h-3.5 w-3.5" />
            </span>
            <span className="text-xs leading-snug">
              <span className="block font-medium text-ink">Login with Discord</span>
              to create a ship or send requests.
            </span>
          </a>
        )}
      </div>
    </aside>
  );
}

// Lucide-style outline icons (24x24 grid, round caps/joins), all drawn through the
// same wrapper so stroke width, size and alignment are identical across the sidebar.
function LucideSvg({ children, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

// lucide: heart
function HeartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <LucideSvg {...props}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </LucideSvg>
  );
}

// the existing two-overlapping-cards icon, redrawn on the same grid and stroke
function CardsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <LucideSvg {...props}>
      <rect x="2.5" y="7" width="14" height="10" rx="2" />
      <path d="M7.5 5.5A2 2 0 0 1 9.5 3.5h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2" />
    </LucideSvg>
  );
}

// inbox tray with a down arrow (the original Requests icon, redrawn on the shared grid)
function InboxIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <LucideSvg {...props}>
      <path d="M12 2.5v8" />
      <path d="m8.5 7.5 3.5 3.5 3.5-3.5" />
      <path d="M3 14.5 5 10.5" />
      <path d="M21 14.5 19 10.5" />
      <path d="M3 14.5h5.2l1.3 2.5h5l1.3-2.5H21v4.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
    </LucideSvg>
  );
}

// lucide: chart-no-axes-column
function BarChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <LucideSvg {...props}>
      <path d="M5 21v-6" />
      <path d="M12 21V3" />
      <path d="M19 21V9" />
    </LucideSvg>
  );
}

// lucide: file-text, with the two text lines (as in the reference)
function RulesIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <LucideSvg {...props}>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </LucideSvg>
  );
}

// lucide: info
function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <LucideSvg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </LucideSvg>
  );
}

export function DiscordIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20 4.5A18 18 0 0 0 15.6 3l-.3.7a13 13 0 0 1 3.9 1.7A16 16 0 0 0 12 4a16 16 0 0 0-7.2 1.4A13 13 0 0 1 8.7 3.7L8.4 3A18 18 0 0 0 4 4.5C1.9 8 1.3 11.4 1.5 14.8A18 18 0 0 0 7 17.5l.9-1.3a11 11 0 0 1-1.9-1c.2-.1.3-.2.5-.3a13 13 0 0 0 11 0l.5.3a11 11 0 0 1-1.9 1l.9 1.3a18 18 0 0 0 5.5-2.7c.3-4.2-.6-7.6-2.5-10.3ZM8.9 13.4c-.8 0-1.5-.8-1.5-1.7 0-1 .6-1.8 1.5-1.8s1.5.8 1.5 1.8c0 .9-.6 1.7-1.5 1.7Zm6.2 0c-.8 0-1.5-.8-1.5-1.7 0-1 .6-1.8 1.5-1.8s1.5.8 1.5 1.8c0 .9-.6 1.7-1.5 1.7Z" />
    </svg>
  );
}