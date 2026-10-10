import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/session";
import { getClaimableShipsForDiscordId } from "@/lib/data/claims";
import { ClaimButton } from "./ClaimButton";

export default async function ClaimPage() {
  const session = getSession();
  if (!session) redirect("/api/auth/discord?redirect=/claim");

  const claimable = await getClaimableShipsForDiscordId(session.discordId);

  return (
    <AppShell currentUser={session}>
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-semibold text-ink">Claim Your Profile</h1>
        <p className="mt-1 text-sm text-ink-soft">
          If an admin made a ship for you before you'd connected Discord, it'll show up here — only you can claim it,
          since it's matched to your Discord account, not just a name.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          {claimable.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-white px-4 py-10 text-center text-sm text-ink-faint">
              Nothing to claim right now.
            </p>
          ) : (
            claimable.map((slot) => (
              <div
                key={`${slot.shipId}:${slot.side}`}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-white p-4 shadow-softer"
              >
                <p className="text-sm text-ink">
                  You as <span className="font-medium">{slot.yourName}</span>, shipped with{" "}
                  <span className="font-medium">{slot.otherPersonName}</span>
                </p>
                <ClaimButton shipId={slot.shipId} />
              </div>
            ))
          )}
        </div>
      </div>
    </AppShell>
  );
}
