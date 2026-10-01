import { AppShell } from "@/components/AppShell";
import { AvatarPair } from "@/components/Avatar";
import { getShips } from "@/lib/data/ships";
import { getSession } from "@/lib/session";
import { durationSince, relativeTimeSince } from "@/lib/dates";
import type { Ship } from "@/types";
import Link from "next/link";
import { displayNameOf } from "@/lib/user-display";

export default async function StatsPage() {
  const session = getSession();
  const allShips = await getShips();

  // Public stats only count confirmed/ended ships — same public set the
  // Ships page shows. Admin-pending and archived ships stay internal.
  const ships = allShips.filter((s) => s.status === "confirmed" || s.status === "ended");

  const totalShips = ships.length;
  const peopleIds = new Set(ships.flatMap((s) => [s.userA.id, s.userB.id]));
  const currentShips = ships.filter((s) => s.status === "confirmed").length;
  const endedShips = ships.filter((s) => s.status === "ended").length;
  const newThisMonth = ships.filter((s) => {
    const created = new Date(s.createdAt);
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    return created.getTime() > monthAgo.getTime();
  }).length;

  const newest = [...ships].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5);
  const longest = [...ships].sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt)).slice(0, 5);
  const longestShip = longest[0];

  return (
    <AppShell currentUser={session}>
      <h1 className="text-xl font-semibold text-ink">Community Stats</h1>
      <p className="mt-1 text-sm text-ink-soft">Some numbers from the server ♡</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Total Ships" value={totalShips} accent="blossom" />
        <StatTile label="Total People" value={peopleIds.size} accent="lavender" />
        <StatTile label="Current Ships" value={currentShips} accent="amber" />
        <StatTile label="Ended Ships" value={endedShips} accent="sky" />
        <StatTile label="New Ships This Month" value={newThisMonth} accent="sage" />
        <StatTile
          label="Longest Running Ship"
          value={longestShip ? durationSince(longestShip.createdAt).label : "—"}
          accent="amber"
        />
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <ShipMiniList title="Newest Ships" ships={newest} sublabel={(s) => relativeTimeSince(s.createdAt)} />
        <ShipMiniList title="Longest Ships" ships={longest} sublabel={(s) => durationSince(s.createdAt).label} />
      </div>
    </AppShell>
  );
}

const ACCENTS = {
  blossom: "bg-blossom-50 text-blossom-600",
  lavender: "bg-lavender-50 text-lavender-600",
  amber: "bg-amber-50 text-amber-500",
  sky: "bg-sky-50 text-sky-500",
  sage: "bg-sage-50 text-sage-500",
};

function StatTile({ label, value, accent }: { label: string; value: string | number; accent: keyof typeof ACCENTS }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className={`mb-2 inline-flex h-7 w-7 items-center justify-center rounded-full ${ACCENTS[accent]}`}>
        <span className="text-xs">●</span>
      </div>
      <p className="text-lg font-semibold text-ink">{value}</p>
      <p className="text-xs text-ink-faint">{label}</p>
    </div>
  );
}

function ShipMiniList({
  title,
  ships,
  sublabel,
}: {
  title: string;
  ships: Ship[];
  sublabel: (s: Ship) => string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <Link href="/ships" className="text-xs font-medium text-lavender-600">
          View all →
        </Link>
      </div>
      <ul className="flex flex-col gap-2.5">
        {ships.map((ship) => (
          <li key={ship.id}>
            <Link href={`/ships/${ship.id}`} className="flex items-center justify-between gap-3 hover:opacity-80">
              <div className="flex items-center gap-2">
                <AvatarPair a={ship.userA} b={ship.userB} size={22} />
                <span className="text-sm text-ink">
                  {displayNameOf(ship.userA)} × {displayNameOf(ship.userB)}
                </span>
              </div>
              <span className="shrink-0 text-xs text-ink-faint">{sublabel(ship)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
