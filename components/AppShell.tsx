import Link from "next/link";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { getSession } from "@/lib/session";
import { getRequestsForUser } from "@/lib/data/requests";
import { getCardChangeRequestsForUser } from "@/lib/data/ships";
import { getUserById } from "@/lib/data/users";
import { getVisibleNavItems } from "@/lib/data/nav";
import { maybeSyncDiscordProfile, syncStaleProfiles } from "@/lib/discord-sync";

export async function AppShell({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser?: { username: string; displayName?: string | null; avatarUrl: string | null } | null;
}) {
  // Re-reads the session directly rather than trusting `currentUser` to carry
  // a discordId (some pages pass a narrower shape). Cheap: it's just a
  // signed-cookie check, no I/O.
  const session = getSession();

  // Keep Discord names/pictures fresh (at most hourly per person; never
  // touches a custom avatar), then read everything below.
  await Promise.all([session ? maybeSyncDiscordProfile(session.discordId) : null, syncStaleProfiles(2)]);

  const navItems = (await getVisibleNavItems()).map(({ key, label, href }) => ({ key, label, href }));
  const [shipRequests, cardChanges, me] = session
    ? await Promise.all([
        getRequestsForUser(session.discordId),
        getCardChangeRequestsForUser(session.discordId),
        getUserById(session.discordId),
      ])
    : [{ incoming: [] }, [], null];
  const pendingCount = shipRequests.incoming.length + cardChanges.length;

  // The signed cookie is only a snapshot from login time, so prefer the live
  // record for the name and picture shown in the sidebar (a new PFP shows
  // up right away rather than after the next login).
  const shownUser = currentUser
    ? {
        username: currentUser.username,
        displayName: me?.displayName ?? currentUser.displayName ?? null,
        avatarUrl: me?.avatarUrl ?? currentUser.avatarUrl,
      }
    : null;

  // On desktop the sidebar and the page content are separate scroll areas:
  // the window itself never scrolls, so the sidebar (and the login card at
  // the bottom of it) stays put while the content scrolls on its own. On
  // mobile there's no sidebar, so the page just scrolls normally.
  return (
    <div className="flex min-h-screen bg-cream md:h-screen md:overflow-hidden">
      <div className="hidden shrink-0 md:block md:h-screen">
        <Sidebar currentUser={shownUser} pendingRequestCount={pendingCount} navItems={navItems} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col md:h-screen md:overflow-y-auto">
        <MobileTopBar />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-20 md:px-8 md:py-8 md:pb-8">{children}</main>
        <MobileNav pendingRequestCount={pendingCount} navItems={navItems} />
      </div>
    </div>
  );
}

function MobileTopBar() {
  const session = getSession();
  return (
    <div className="flex items-center justify-between border-b border-border bg-cream-100 px-4 py-3 md:hidden">
      <Link href="/" className="text-xl font-semibold tracking-tight">
        <span className="text-blossom-500">s</span>hip<span className="text-lavender-500">.</span>
      </Link>
      {!session && (
        <a href="/api/auth/discord" className="text-xs font-medium text-lavender-600">
          Login
        </a>
      )}
    </div>
  );
}
