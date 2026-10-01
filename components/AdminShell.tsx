import { AdminSidebar } from "./AdminSidebar";

export function AdminShell({
  children,
  currentUser,
  pendingCount,
}: {
  children: React.ReactNode;
  currentUser: { username: string; displayName?: string | null; avatarUrl: string | null };
  pendingCount?: number;
}) {
  // On desktop the sidebar and the page content are separate scroll areas:
  // the window itself never scrolls, so the sidebar (and the account card at
  // the bottom of it) stays put while the content scrolls on its own.
  return (
    <div className="flex min-h-screen bg-cream md:h-screen md:overflow-hidden">
      <div className="hidden shrink-0 md:block md:h-screen">
        <AdminSidebar currentUser={currentUser} pendingCount={pendingCount} />
      </div>
      <div className="min-w-0 flex-1 md:h-screen md:overflow-y-auto">
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
