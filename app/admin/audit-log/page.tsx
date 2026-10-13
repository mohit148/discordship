import { AdminShell } from "@/components/AdminShell";
import { getSession } from "@/lib/session";
import { getAuditLog } from "@/lib/data/audit";
import { Avatar } from "@/components/Avatar";
import { formatDate } from "@/lib/dates";
import { displayNameOf } from "@/lib/user-display";

export const dynamic = "force-dynamic";

export default async function AdminAuditLogPage() {
  const session = getSession()!;
  const entries = await getAuditLog();

  return (
    <AdminShell currentUser={session}>
      <h1 className="text-xl font-semibold text-ink">Audit Log</h1>
      <p className="mt-1 text-sm text-ink-soft">Every admin action, newest first (last 100).</p>

      <div className="mt-5 overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-ink-faint">
              <th className="px-4 py-3 font-medium">Who</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Detail</th>
              <th className="px-4 py-3 font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-ink-faint">
                  Nothing has been logged yet.
                </td>
              </tr>
            )}
            {entries.map((entry) => (
              <tr key={entry.id} className="table-row-hover border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {entry.actor ? (
                      <>
                        <Avatar src={entry.actor.avatarUrl} alt={displayNameOf(entry.actor)} size={24} />
                        <span className={entry.actor.isPlaceholder ? "text-ink-faint" : "text-ink"}>{displayNameOf(entry.actor)}</span>
                      </>
                    ) : (
                      <span className="text-ink-faint">System</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-ink-soft">{entry.action}</td>
                <td className="px-4 py-3 text-ink-faint">
                  {entry.targetUser ? (
                    <div className="flex items-center gap-2">
                      <span>→</span>
                      <Avatar src={entry.targetUser.avatarUrl} alt={displayNameOf(entry.targetUser)} size={20} />
                      <span className="text-ink-soft">{displayNameOf(entry.targetUser)}</span>
                      {entry.detail && <span>· {entry.detail}</span>}
                    </div>
                  ) : (
                    entry.detail
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-ink-faint">{formatDate(entry.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
