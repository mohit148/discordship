"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./Avatar";

const NAV_ITEMS = [
  { href: "/ships", label: "Ships", icon: HeartIcon },
  { href: "/cards", label: "Cards", icon: CardsIcon },
  { href: "/requests", label: "Requests", icon: InboxIcon },
  { href: "/stats", label: "Stats", icon: BarChartIcon },
  { href: "/about", label: "About", icon: InfoIcon },
];

export function Sidebar({
  currentUser,
  pendingRequestCount = 0,
}: {
  currentUser?: { username: string; displayName?: string | null; avatarUrl: string | null } | null;
  pendingRequestCount?: number;
}) {
  const pathname = usePathname();
  const name = currentUser?.displayName || currentUser?.username;

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col justify-between border-r border-border bg-cream-100 px-4 py-6">
      <div>
        <Link href="/ships" className="mb-8 block px-2 text-2xl font-semibold tracking-tight text-ink">
          ship<span className="text-lavender-500">.</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            const showBadge = item.href === "/requests" && pendingRequestCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded px-3 py-2 text-sm transition-colors ${
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

      <div className="rounded-lg border border-border bg-cream-50 p-3">
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

function HeartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" {...props}>
      <path
        d="M12 21.35 10.55 20.03C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.53L12 21.35Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CardsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="2.5" y="7" width="14" height="10" rx="1.8" />
      <path d="M7.5 5.5A1.8 1.8 0 0 1 9.3 3.7h10.9a1.8 1.8 0 0 1 1.8 1.8v9a1.8 1.8 0 0 1-1.8 1.8" strokeLinecap="round" />
    </svg>
  );
}

function InboxIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        d="M4 12h4l1.5 3h5L16 12h4M4 12v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6M4 12l2.5-6.5A1 1 0 0 1 7.4 5h9.2a1 1 0 0 1 .9.5L20 12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BarChartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path d="M5 20V10M12 20V4M19 20v-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function InfoIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 8v.01" strokeLinecap="round" />
    </svg>
  );
}

export function DiscordIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M20 4.5A18 18 0 0 0 15.6 3l-.3.7a13 13 0 0 1 3.9 1.7A16 16 0 0 0 12 4a16 16 0 0 0-7.2 1.4A13 13 0 0 1 8.7 3.7L8.4 3A18 18 0 0 0 4 4.5C1.9 8 1.3 11.4 1.5 14.8A18 18 0 0 0 7 17.5l.9-1.3a11 11 0 0 1-1.9-1c.2-.1.3-.2.5-.3a13 13 0 0 0 11 0l.5.3a11 11 0 0 1-1.9 1l.9 1.3a18 18 0 0 0 5.5-2.7c.3-4.2-.6-7.6-2.5-10.3ZM8.9 13.4c-.8 0-1.5-.8-1.5-1.7 0-1 .6-1.8 1.5-1.8s1.5.8 1.5 1.8c0 .9-.6 1.7-1.5 1.7Zm6.2 0c-.8 0-1.5-.8-1.5-1.7 0-1 .6-1.8 1.5-1.8s1.5.8 1.5 1.8c0 .9-.6 1.7-1.5 1.7Z" />
    </svg>
  );
}
