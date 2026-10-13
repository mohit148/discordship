import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { maybeSyncDiscordProfile, syncStaleProfiles } from "@/lib/discord-sync";

export const dynamic = "force-dynamic";

/**
 * Keeps Discord names + pictures current. The page calls this in the background
 * (components/ProfileSync.tsx), so it never slows a page down — and because it
 * runs AFTER the page's data was loaded, it reports `changed` so the page can
 * re-fetch itself once and show the new picture in the same visit.
 *
 * It is self-throttling (each person is synced at most once per SYNC_INTERVAL_MS,
 * tracked in the database), so calling it often — or anonymously — is harmless.
 * Only the Discord-owned columns are written; a custom picture is never touched.
 */
export async function POST() {
  const session = getSession();
  const [mine, others] = await Promise.all([session ? maybeSyncDiscordProfile(session.discordId) : false, syncStaleProfiles(3)]);
  return NextResponse.json({ changed: mine || others });
}
