import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { AdminRequestRow } from "@/components/AdminRequestRow";
import { getSession } from "@/lib/session";
import { getPendingRequests } from "@/lib/data/requests";
import { getShips } from "@/lib/data/ships";
import { getUsers } from "@/lib/data/users";

export default async function AdminDashboardPage() {
  const session = getSession()!;
  const [pending, ships, users] = await Promise.all([getPendingRequests(), getShips(), getUsers()]);
  const activeShips = ships.filter((s) => s.status === "confirmed").length;
  const archivedShips = ships.filter((s) => s.status === "archived").length;
  const totalUsers = users.length;

  return (
    <AdminShell currentUser={session} pendingCount={pending.length}>
      <h1 className="text-xl font-semibold text-ink">Admin Dashboard</h1>
      <p className="mt-1 text-sm text-ink-soft">Manage ships, users and keep things cozy.</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Pending Requests" value={pending.length} accent="blossom" />
        <MetricCard label="Current Ships" value={activeShips} accent="lavender" />
        <MetricCard label="Archived Ships" value={archivedShips} accent="sky" />
        <MetricCard label="Total Users" value={totalUsers} accent="sage" />
      </div>

      <div className="mt-6 rounded-lg border border-border bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Pending Requests</h2>
          <Link href="/admin/requests" className="text-xs font-medium text-lavender-600">
            View all →
          </Link>
        </div>
        <ul className="flex flex-col gap-3">
          {pending.length === 0 && <li className="text-sm text-ink-faint">Nothing waiting on you right now.</li>}
          {pending.map((req) => (
            <AdminRequestRow key={req.id} request={req} />
          ))}
        </ul>
      </div>
    </AdminShell>
  );
}

const ACCENTS = {
  blossom: "text-blossom-600 bg-blossom-50",
  lavender: "text-lavender-600 bg-lavender-50",
  sky: "text-sky-500 bg-sky-50",
  sage: "text-sage-500 bg-sage-50",
};

function MetricCard({ label, value, accent }: { label: string; value: number; accent: keyof typeof ACCENTS }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <p className="text-xs text-ink-faint">{label}</p>
      <p className={`mt-1 inline-block rounded px-1.5 text-lg font-semibold ${ACCENTS[accent]}`}>{value}</p>
    </div>
  );
}
