import { AdminShell } from "@/components/AdminShell";
import { getSession } from "@/lib/session";
import { getBackgrounds } from "@/lib/data/backgrounds";
import { AdminBackgroundsManager } from "./AdminBackgroundsManager";

export default async function AdminBackgroundsPage() {
  const session = getSession()!;
  const [backgrounds] = await Promise.all([getBackgrounds()]);

  return (
    <AdminShell currentUser={session}>
      <h1 className="text-xl font-semibold text-ink">Backgrounds</h1>
      <p className="mt-1 text-sm text-ink-soft">
        The catalog people pick their card background from. Only admins can add to it.
      </p>

      <div className="mt-5">
        <AdminBackgroundsManager initialBackgrounds={backgrounds} />
      </div>
    </AdminShell>
  );
}
