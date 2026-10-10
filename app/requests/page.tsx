import { guardPage } from "@/lib/page-guard";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { RequestInboxRow } from "@/components/RequestInboxRow";
import { RequestSettingsToggle } from "@/components/RequestSettingsToggle";
import { CardChangeRequestRow } from "@/components/CardChangeRequestRow";
import { getSession } from "@/lib/session";
import { getRequestsForUser } from "@/lib/data/requests";
import { getUserById } from "@/lib/data/users";
import { getCardChangeRequestsForUser } from "@/lib/data/ships";
import { getClaimableShipsForDiscordId } from "@/lib/data/claims";
import Link from "next/link";

export default async function RequestsPage() {
  await guardPage("requests");
  const session = getSession();
  if (!session) {
    redirect("/api/auth/discord?redirect=/requests");
  }

  const [{ incoming, outgoing }, me, cardChanges, claimable] = await Promise.all([
    getRequestsForUser(session.discordId),
    getUserById(session.discordId),
    getCardChangeRequestsForUser(session.discordId),
    getClaimableShipsForDiscordId(session.discordId),
  ]);

  return (
    <AppShell currentUser={session}>
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-ink">Requests</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Everything that needs your OK — new ship requests, and bio or background changes to a shared card.
        </p>

        <div className="mt-5 flex flex-col gap-3">
          <RequestSettingsToggle initialValue={me?.acceptsRequests !== false} />
          {claimable.length > 0 && (
            <Link
              href="/claim"
              className="flex items-center justify-between gap-3 rounded-lg border border-lavender-400 bg-lavender-50 px-4 py-3 text-sm text-lavender-600 hover:bg-lavender-100"
            >
              <span>
                You have {claimable.length} ship{claimable.length > 1 ? "s" : ""} waiting to be claimed.
              </span>
              <span className="shrink-0 font-medium">Claim →</span>
            </Link>
          )}
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            Card changes waiting on you{cardChanges.length > 0 ? ` (${cardChanges.length})` : ""}
          </h2>
          {cardChanges.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-ink-faint">
              No bio or background changes waiting on you.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {cardChanges.map((req) => (
                <CardChangeRequestRow key={req.id} request={req} />
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            Ship requests — Incoming{incoming.length > 0 ? ` (${incoming.length})` : ""}
          </h2>
          {incoming.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-ink-faint">
              No pending ship requests right now.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {incoming.map((req) => (
                <RequestInboxRow key={req.id} request={req} direction="incoming" />
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-ink">
            Sent{outgoing.length > 0 ? ` (${outgoing.length})` : ""}
          </h2>
          {outgoing.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-ink-faint">
              You haven&apos;t sent any requests that are still waiting.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {outgoing.map((req) => (
                <RequestInboxRow key={req.id} request={req} direction="outgoing" />
              ))}
            </ul>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-ink-faint">
          Something not right? You can report a ship, card, or person from its ship page.
        </p>
      </div>
    </AppShell>
  );
}
