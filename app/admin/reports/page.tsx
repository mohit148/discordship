import { AdminShell } from "@/components/AdminShell";
import { getSession } from "@/lib/session";
import { getReports } from "@/lib/data/reports";
import { getPendingRequests } from "@/lib/data/requests";
import { getShips } from "@/lib/data/ships";
import { Avatar } from "@/components/Avatar";
import { relativeTimeSince } from "@/lib/dates";
import Link from "next/link";
import { ReportRowActions } from "./ReportRowActions";
import { displayNameOf } from "@/lib/user-display";

export default async function AdminReportsPage() {
  const session = getSession()!;
  const [reports, pending, ships] = await Promise.all([getReports(), getPendingRequests(), getShips()]);
  const openReports = reports.filter((r) => r.status === "open");

  return (
    <AdminShell currentUser={session} pendingCount={pending.length}>
      <h1 className="text-xl font-semibold text-ink">Reports</h1>
      <p className="mt-1 text-sm text-ink-soft">Things members have flagged for a look.</p>

      <div className="mt-5 rounded-lg border border-border bg-white p-4">
        {openReports.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-faint">No open reports. Nicely quiet in here.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {openReports.map((report) => {
              const ship = ships.find((s) => s.id === report.shipId);
              return (
                <li key={report.id} className="flex items-start justify-between gap-3 border-b border-border pb-4 last:border-0 last:pb-0">
                  <div className="flex items-start gap-2.5">
                    <Avatar src={report.reportedBy.avatarUrl} alt={displayNameOf(report.reportedBy)} size={26} />
                    <div>
                      <p className="text-sm text-ink">
                        {displayNameOf(report.reportedBy)} reported{" "}
                        {ship ? (
                          <Link href={`/ships/${ship.id}`} className="font-medium text-lavender-600 hover:underline">
                            #{ship.number} {displayNameOf(ship.userA)} × {displayNameOf(ship.userB)}
                          </Link>
                        ) : report.reportedUser ? (
                          <span className="font-medium text-ink">{displayNameOf(report.reportedUser)}</span>
                        ) : (
                          "a ship that no longer exists"
                        )}
                      </p>
                      <p className="mt-0.5 text-sm text-ink-soft">&quot;{report.reason}&quot;</p>
                      <p className="mt-0.5 text-xs text-ink-faint">{relativeTimeSince(report.createdAt)}</p>
                    </div>
                  </div>
                  <ReportRowActions reportId={report.id} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AdminShell>
  );
}
