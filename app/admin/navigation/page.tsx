import { AdminShell } from "@/components/AdminShell";
import { getSession } from "@/lib/session";
import { getPendingRequests } from "@/lib/data/requests";
import { getAllNavItems } from "@/lib/data/nav";
import { NavManager } from "./NavManager";

export default async function AdminNavigationPage() {
  const session = getSession()!;
  const [pending, items] = await Promise.all([getPendingRequests(), getAllNavItems()]);

  return (
    <AdminShell currentUser={session} pendingCount={pending.length}>
      <h1 className="text-xl font-semibold text-ink">Navigation</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Choose which public pages show up and in what order. A hidden page disappears from the menu and can&apos;t be
        opened by regular visitors (admins can still preview it). Admin pages aren&apos;t affected.
      </p>
      <div className="mt-5 max-w-xl">
        <NavManager initialItems={items} />
      </div>
    </AdminShell>
  );
}
