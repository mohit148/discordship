import Link from "next/link";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { getSession } from "@/lib/session";
import { getRequestsForUser } from "@/lib/data/requests";
import { getCardChangeRequestsForUser } from "@/lib/data/ships";
import { getUserById } from "@/lib/data/users";
import { getVisibleNavItems } from "@/lib/data/nav";
import { Avatar } from "./Avatar";
import { DiscordIcon } from "./Sidebar";
import { ProfileSync } from "./ProfileSync";

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
        avatarUrl: me ? me.avatarUrl : currentUser.avatarUrl,
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
        <ProfileSync />
        <MobileTopBar user={shownUser} loggedIn={!!session} />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 pb-20 md:px-8 md:py-8 md:pb-8 xl:px-10">{children}</main>
        <MobileNav pendingRequestCount={pendingCount} navItems={navItems} />
      </div>
    </div>
  );
}

function MobileTopBar({
  user,
  loggedIn,
}: {
  user: { username: string; displayName?: string | null; avatarUrl: string | null } | null;
  loggedIn: boolean;
}) {
  const name = user?.displayName || user?.username || "You";
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border bg-cream-100 px-4 py-3 md:hidden">
      <Link href="/" className="text-xl font-semibold tracking-tight">
        <span className="text-blossom-500">s</span>hip<span className="text-lavender-500">.</span>
      </Link>
      {loggedIn ? (
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar src={user?.avatarUrl ?? null} alt={name} size={28} />
          <a href="/api/auth/logout" className="shrink-0 text-xs font-medium text-ink-faint hover:text-ink-soft">
            Log out
          </a>
        </div>
      ) : (
        <a
          href="/api/auth/discord"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-lavender-500 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm active:opacity-80"
        >
          <DiscordIcon className="h-3.5 w-3.5" />
          Log in
        </a>
      )}
    </div>
  );
}
