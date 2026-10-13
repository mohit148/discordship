import { guardPage } from "@/lib/page-guard";
import { AppShell } from "@/components/AppShell";
import { HomeClient } from "../HomeClient";
import { getShips } from "@/lib/data/ships";
import { getSession } from "@/lib/session";

export default async function ShipsPage() {
  await guardPage("ships");
  const session = getSession();
  const allShips = await getShips();

  // Public list only shows confirmed/ended ships. "pending" (an
  // admin-created ship still awaiting the other person's confirmation, or
  // a request that hasn't been accepted yet) and "archived" stay internal
  // to the admin panel — see app/admin/ships/AdminShipsTable.tsx.
  const ships = allShips.filter((s) => s.status === "confirmed" || s.status === "ended");

  return (
    <AppShell currentUser={session}>
      <HomeClient initialShips={ships} />
    </AppShell>
  );
}
