import { AdminShell } from "@/components/AdminShell";
import { getSession } from "@/lib/session";
import { getUsers } from "@/lib/data/users";
import { getPendingRequests } from "@/lib/data/requests";
import { getCurrentRole } from "@/lib/roles";
import { AdminUsersTable } from "./AdminUsersTable";

export default async function AdminUsersPage() {
  const session = getSession()!;
  const [users, pending, role] = await Promise.all([getUsers(), getPendingRequests(), getCurrentRole()]);

  return (
    <AdminShell currentUser={session} pendingCount={pending.length}>
      <h1 className="text-xl font-semibold text-ink">Users</h1>
      <p className="mt-1 text-sm text-ink-soft">Everyone who has logged in or been added to a ship.</p>

      <div className="mt-5">
        <AdminUsersTable users={users} viewerRole={role === "owner" ? "owner" : "admin"} ownerId={process.env.OWNER_DISCORD_ID ?? null} />
      </div>
    </AdminShell>
  );
}
