import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/Button";
import { getSession } from "@/lib/session";
import { getShips } from "@/lib/data/ships";
import { getPendingRequests } from "@/lib/data/requests";
import { AdminShipsTable } from "./AdminShipsTable";

export default async function AdminShipsPage() {
  const session = getSession()!;
  const [ships, pending] = await Promise.all([getShips(), getPendingRequests()]);

  return (
    <AdminShell currentUser={session} pendingCount={pending.length}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Ships</h1>
          <p className="mt-1 text-sm text-ink-soft">Edit, archive, or end any ship on the server.</p>
        </div>
        <Button href="/admin/ships/new">+ Create Ship</Button>
      </div>

      <div className="mt-5">
        <AdminShipsTable ships={ships} />
      </div>
    </AdminShell>
  );
}
