import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/roles";
import { saveRulesDocument, validateRulesDocument } from "@/lib/data/rules";
import { recordAudit } from "@/lib/data/audit";

export async function PUT(req: NextRequest) {
  const gate = await requireRole("admin");
  if (gate.forbidden) return NextResponse.json({ error: gate.forbidden.error }, { status: gate.forbidden.status });
  const session = getSession()!;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const result = validateRulesDocument(body?.sections);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    await saveRulesDocument(result.doc);
    await recordAudit({
      actor: { id: session.discordId, username: session.username, displayName: session.displayName, avatarUrl: session.avatarUrl },
      action: "updated rules",
      targetType: "settings",
      targetId: "rules",
      detail: `${result.doc.length} section(s)`,
    });
    return NextResponse.json({ sections: result.doc });
  } catch (err) {
    console.error("Failed to save rules", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
