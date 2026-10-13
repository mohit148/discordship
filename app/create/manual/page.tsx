import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/session";
import { getCurrentRole, isAtLeast } from "@/lib/roles";
import { getBackgrounds } from "@/lib/data/backgrounds";
import { AdminCreateShipForm } from "@/app/admin/ships/new/AdminCreateShipForm";

// Ship Creators get this same form the Admin Portal uses, just outside it —
// they don't get Admin Portal access (users, backgrounds, reports, etc.),
// only the ability to make and manage ships they create by hand.
export default async function CreateShipManuallyPage() {
  const session = getSession();
  if (!session) redirect("/api/auth/discord?redirect=/create/manual");

  const role = await getCurrentRole();
  if (!isAtLeast(role, "ship_creator")) redirect("/create");

  const backgrounds = await getBackgrounds();

  return (
    <AppShell currentUser={session}>
      <h1 className="text-xl font-semibold text-ink">Create a Ship</h1>
      <p className="mt-1 text-sm text-ink-soft">Only create a ship after both people have agreed to it.</p>

      <div className="mt-5">
        <AdminCreateShipForm backgrounds={backgrounds} />
      </div>
    </AppShell>
  );
}
