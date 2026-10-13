import { NextResponse } from "next/server";
import { requireRole } from "@/lib/roles";
import { listDueForSync } from "@/lib/data/oauth-tokens";
import { syncAllProfilesWithBot, syncDiscordProfile } from "@/lib/discord-sync";

export const dynamic = "force-dynamic";

/**
 * Admin-only "refresh names + pictures from Discord now". Uses stored login tokens
 * for everyone who has one and, when DISCORD_BOT_TOKEN is set, the bot lookup for
 * everyone else. Only Discord-owned columns are written — custom pictures stay.
 */
export async function POST() {
  const gate = await requireRole("admin");
  if (gate.forbidden) return NextResponse.json({ error: gate.forbidden.error }, { status: gate.forbidden.status });

  let updated = 0;
  try {
    const rows = await listDueForSync(Date.now() + 1, 100);
    for (let i = 0; i < rows.length; i += 5) {
      const results = await Promise.all(rows.slice(i, i + 5).map((r) => syncDiscordProfile(r.userId)));
      updated += results.filter((r) => r === "changed").length;
    }
    const bot = await syncAllProfilesWithBot(150);
    updated += bot.updated;
    return NextResponse.json({ updated, note: bot.skipped });
  } catch (err) {
    console.error("Manual profile sync failed", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Couldn't refresh from Discord." }, { status: 500 });
  }
}
