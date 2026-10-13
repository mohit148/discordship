import { guardPage } from "@/lib/page-guard";
import { AppShell } from "@/components/AppShell";
import { CardsClient } from "./CardsClient";
import { getShips } from "@/lib/data/ships";
import { getSession } from "@/lib/session";

export default async function CardsPage() {
  await guardPage("cards");
  const session = getSession();
  const allShipsRaw = await getShips();

  // Same public set as the Ships page — confirmed/ended only. Pending
  // (awaiting confirmation) and archived ships stay internal to admin.
  const ships = allShipsRaw.filter((s) => s.status === "confirmed" || s.status === "ended");

  const yourShips = session
    ? ships.filter((s) => s.userA.id === session.discordId || s.userB.id === session.discordId)
    : [];
  const myShipIds = new Set(yourShips.map((s) => s.id));

  return (
    <AppShell currentUser={session}>
      <h1 className="text-xl font-semibold text-ink">Cards</h1>
      <p className="mt-1 text-sm text-ink-soft">Custom cards for all ships.</p>

      <div className="mt-5">
        <CardsClient yourShips={yourShips} allShips={ships} myShipIds={myShipIds} viewerId={session?.discordId ?? null} />
      </div>
    </AppShell>
  );
}
