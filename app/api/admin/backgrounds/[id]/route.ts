import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/roles";
import { deleteBackground, getBackgrounds } from "@/lib/data/backgrounds";
import { recordAudit } from "@/lib/data/audit";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireRole("admin");
  if (gate.forbidden) return NextResponse.json({ error: gate.forbidden.error }, { status: gate.forbidden.status });
  const session = getSession()!;

  const existing = (await getBackgrounds()).find((b) => b.id === params.id);
  if (!existing) {
    return NextResponse.json({ error: "That background doesn't exist." }, { status: 404 });
  }

  try {
    await deleteBackground(params.id);
    await recordAudit({
      actor: { id: session.discordId, username: session.username, displayName: session.displayName, avatarUrl: session.avatarUrl },
      action: "removed background",
      targetType: "background",
      targetId: params.id,
      detail: existing.name,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to remove background", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
