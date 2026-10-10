import Link from "next/link";
import { AdminShell } from "@/components/AdminShell";
import { getSession } from "@/lib/session";
import { getPendingRequests } from "@/lib/data/requests";
import { getBackgrounds } from "@/lib/data/backgrounds";
import { AdminCreateShipForm } from "./AdminCreateShipForm";

export default async function AdminCreateShipPage() {
  const session = getSession()!;
  const [pending, backgrounds] = await Promise.all([getPendingRequests(), getBackgrounds()]);

  return (
    <AdminShell currentUser={session} pendingCount={pending.length}>
      <Link href="/admin/ships" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        ← Back to Ships
      </Link>
      <h1 className="text-xl font-semibold text-ink">Create Ship</h1>
      <p className="mt-1 text-sm text-ink-soft">Add a ship by hand, using just their display names.</p>

      <div className="mt-5 max-w-3xl">
        <AdminCreateShipForm backgrounds={backgrounds} />
      </div>
    </AdminShell>
  );
}
