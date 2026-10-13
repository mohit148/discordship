import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/roles";
import { checkUserAuthorization } from "@/lib/oauth-cleanup";
import { recordAudit } from "@/lib/data/audit";

export const dynamic = "force-dynamic";

/**
 * Admin-only: asks Discord whether one person's authorization is still valid.
 * `id` is a Discord ID. Read-only — it never deletes
 * anything and never counts toward the automatic cleanup.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireRole("admin");
  if (gate.forbidden) return NextResponse.json({ error: gate.forbidden.error }, { status: gate.forbidden.status });
  const session = getSession()!;

  try {
    const report = await checkUserAuthorization(params.id);
    await recordAudit({
      actor: { id: session.discordId, username: session.username, displayName: session.displayName, avatarUrl: session.avatarUrl },
      action: "checked Discord authorization",
      targetType: "user",
      targetId: report.userId,
      detail: report.status,
    });
    return NextResponse.json(report);
  } catch (err) {
    console.error("Authorization check failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
