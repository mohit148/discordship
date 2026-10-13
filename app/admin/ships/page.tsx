import { AdminShell } from "@/components/AdminShell";
import { Button } from "@/components/Button";
import { getSession } from "@/lib/session";
import { getShips } from "@/lib/data/ships";
import { AdminShipsTable } from "./AdminShipsTable";

export default async function AdminShipsPage() {
  const session = getSession()!;
  const [ships] = await Promise.all([getShips()]);

  return (
    <AdminShell currentUser={session}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Ships</h1>
          <p className="mt-1 text-sm text-ink-soft">Edit, archive, or end any ship.</p>
        </div>
        <Button href="/admin/ships/new" className="shrink-0 whitespace-nowrap">+ Create Ship</Button>
      </div>

      <div className="mt-5">
        <AdminShipsTable ships={ships} />
      </div>
    </AdminShell>
  );
}
