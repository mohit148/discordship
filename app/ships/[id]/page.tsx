import { notFound } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import { ShipCard } from "@/components/ShipCard";
import { ReportButton } from "@/components/ReportButton";
import { getShipById } from "@/lib/data/ships";
import { getBackgrounds } from "@/lib/data/backgrounds";
import { getSession } from "@/lib/session";
import { formatDate, durationSince, nextMonthlyAnniversary, nextYearlyAnniversary } from "@/lib/dates";
import { displayNameOf } from "@/lib/user-display";
import { getRoleFor, canManageManualShip } from "@/lib/roles";
import { ShipCustomText } from "./ShipCustomText";
import { ShipBackgroundPicker } from "./ShipBackgroundPicker";
import { ShipActions } from "./ShipActions";

export default async function ShipDetailsPage({ params }: { params: { id: string } }) {
  const ship = await getShipById(params.id);
  if (!ship) notFound();

  const session = getSession();
  const backgrounds = await getBackgrounds();
  const duration = durationSince(ship.createdAt, ship.status === "ended" ? ship.endedAt : null);
  const monthly = nextMonthlyAnniversary(ship.createdAt);
  const yearly = nextYearlyAnniversary(ship.createdAt);

  const viewerIsParticipant =
    !!session && (session.discordId === ship.userA.id || session.discordId === ship.userB.id);

  // Two-auth ships: the two people edit the card, each change approved by
  // the other. Admin/Ship-Creator-made ships have nobody with an account to
  // approve anything, so whoever's allowed to manage this one edits it
  // directly — live role check, not the session cookie's cached isAdmin.
  const mode = ship.isTwoAuth ? "propose" : "direct";
  const viewerRole = session ? await getRoleFor(session.discordId) : "visitor";
  const canEditCard = ship.isTwoAuth
    ? viewerIsParticipant
    : !!session && canManageManualShip(viewerRole, ship.createdBy?.id, session.discordId);

  function pendingNotice(
    pending: unknown,
    proposedBy: { id: string; displayName: string | null; username: string } | null,
    what: string
  ): string | null {
    if (pending === null || pending === undefined || !proposedBy || !session) return null;
    return proposedBy.id === session.discordId
      ? `You proposed a new ${what} — waiting for the other person to approve it.`
      : `${displayNameOf(proposedBy as any)} proposed a new ${what} — respond to it in Requests.`;
  }

  const bioNotice = pendingNotice(ship.customTextPending, ship.customTextProposedBy, "bio");
  const backgroundNotice = pendingNotice(ship.backgroundPending, ship.backgroundProposedBy, "background");

  const reportable = [ship.userA, ship.userB].filter((u) => !u.isPlaceholder);

  return (
    <AppShell currentUser={session}>
      <Link href="/ships" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-ink">
        ← Back to list
      </Link>

      <div className="mx-auto max-w-lg">
        <ShipCard ship={ship} size="full" href={false} viewerId={session?.discordId} />

        <div className="mt-4 rounded-lg border border-border bg-white p-6 shadow-soft">
          <div className="text-center">
            <p className="text-xs text-ink-faint">Together since</p>
            <p className="text-sm font-medium text-ink">{formatDate(ship.createdAt)}</p>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <StatCard label={duration.label} sublabel={duration.days > 0 ? `${duration.days} days` : "so far"} />
            <StatCard
              label="Next anniversary"
              sublabel={`${formatDate(monthly.date.toISOString())} (in ${monthly.daysAway} days)`}
              accent="blossom"
            />
          </div>

          <div className="mt-3 rounded-lg border border-border bg-cream-50 px-4 py-3 text-xs text-ink-faint">
            Yearly anniversary: {formatDate(yearly.date.toISOString())} (in {yearly.daysAway} days)
          </div>

          {canEditCard && (
            <>
              <ShipCustomText
                shipId={ship.id}
                initialText={ship.customText}
                canEdit
                mode={mode}
                notice={bioNotice}
              />
              <ShipBackgroundPicker ship={ship} backgrounds={backgrounds} canEdit mode={mode} notice={backgroundNotice} />
            </>
          )}

          {viewerIsParticipant && ship.isTwoAuth && <ShipActions shipId={ship.id} currentStatus={ship.status} />}
          {canEditCard && !ship.isTwoAuth && (
            <ShipActions shipId={ship.id} currentStatus={ship.status} />
          )}

          {session && (
            <div className="mt-4 flex justify-center">
              <ReportButton shipId={ship.id} participants={reportable} />
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  sublabel,
  accent = "lavender",
}: {
  label: string;
  sublabel: string;
  accent?: "lavender" | "blossom";
}) {
  const bg = accent === "blossom" ? "bg-blossom-50" : "bg-lavender-50";
  return (
    <div className={`rounded-lg border border-border ${bg} px-3 py-2.5`}>
      <p className="text-sm font-medium text-ink">{label}</p>
      <p className="text-xs text-ink-faint">{sublabel}</p>
    </div>
  );
}
