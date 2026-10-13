import Link from "next/link";
import { AdminSidebar } from "./AdminSidebar";
import { AdminMobileNav } from "./AdminMobileNav";
import { Avatar } from "./Avatar";
import { getSession } from "@/lib/session";
import { getUserById } from "@/lib/data/users";
import { ProfileSync } from "./ProfileSync";

export async function AdminShell({
  children,
  currentUser,
}: {
  children: React.ReactNode;
  currentUser: { username: string; displayName?: string | null; avatarUrl: string | null };
}) {
  // The signed cookie only holds a snapshot from login time, so show the live
  // record (same source as every other page); <ProfileSync /> keeps Discord pictures fresh.
  const session = getSession();
  const me = session ? await getUserById(session.discordId) : null;
  const shownUser = {
    username: me?.username ?? currentUser.username,
    displayName: me ? me.displayName : currentUser.displayName ?? null,
    avatarUrl: me ? me.avatarUrl : currentUser.avatarUrl,
  };

  // On desktop the sidebar and the page content are separate scroll areas:
  // the window itself never scrolls, so the sidebar (and the account card at
  // the bottom of it) stays put while the content scrolls on its own. Below
  // md there's no sidebar at all — AdminMobileNav (a scrollable tab strip)
  // takes its place instead, and the page just scrolls normally.
  return (
    <div className="flex min-h-screen flex-col bg-cream md:h-screen md:flex-row md:overflow-hidden">
      <div className="hidden shrink-0 md:block md:h-screen">
        <AdminSidebar currentUser={shownUser} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col md:h-screen md:overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border bg-cream-100 px-4 py-3 md:hidden">
          <Link href="/" className="text-xl font-semibold tracking-tight">
            <span className="text-blossom-400">s</span>hip<span className="text-lavender-500">.</span>
          </Link>
          <div className="flex items-center gap-3">
            <Avatar src={shownUser.avatarUrl} alt={shownUser.displayName || shownUser.username} size={28} />
            <a href="/api/auth/logout" className="text-xs font-medium text-ink-faint hover:text-ink-soft">
              Log out
            </a>
          </div>
        </div>
        <ProfileSync />
        <AdminMobileNav />
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-8 md:py-8 xl:px-10">{children}</main>
      </div>
    </div>
  );
}
