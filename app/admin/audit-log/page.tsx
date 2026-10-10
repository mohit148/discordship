import { AdminShell } from "@/components/AdminShell";
import { getSession } from "@/lib/session";
import { getAuditLog } from "@/lib/data/audit";
import { getPendingRequests } from "@/lib/data/requests";
import { Avatar } from "@/components/Avatar";
import { formatDate } from "@/lib/dates";
import { displayNameOf } from "@/lib/user-display";

export default async function AdminAuditLogPage() {
  const session = getSession()!;
  const [entries, pending] = await Promise.all([getAuditLog(), getPendingRequests()]);

  return (
    <AdminShell currentUser={session} pendingCount={pending.length}>
      <h1 className="text-xl font-semibold text-ink">Audit Log</h1>
      <p className="mt-1 text-sm text-ink-soft">Every admin action, in order.</p>

      <div className="mt-5 overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-faint">
              <th className="px-4 py-3 font-medium">Admin</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Detail</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="table-row-hover border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {entry.actor && <Avatar src={entry.actor.avatarUrl} alt={displayNameOf(entry.actor)} size={22} />}
                    {entry.actor ? displayNameOf(entry.actor) : "System"}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">{entry.action}</td>
                <td className="px-4 py-3 text-ink-faint">{entry.detail}</td>
                <td className="px-4 py-3 text-ink-faint">{formatDate(entry.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
