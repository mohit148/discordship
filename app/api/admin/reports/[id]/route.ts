import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/config";
import { devStore } from "@/lib/data/dev-store";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/roles";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireRole("admin");
  if (gate.forbidden) return NextResponse.json({ error: gate.forbidden.error }, { status: gate.forbidden.status });
  const session = getSession()!;

  const { status } = await req.json(); // "resolved" | "dismissed"
  if (!["resolved", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    const supabase = createServiceRoleClient();
    const { error } = await supabase.from("reports").update({ status }).eq("id", params.id);
    if (error) {
      console.error("Failed to update report", error);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
    await supabase.from("audit_logs").insert({
      actor_id: session.discordId,
      action: `${status} report`,
      target_type: "report",
      target_id: params.id,
    });
    return NextResponse.json({ ok: true });
  }

  // Local dev store fallback
  const store = devStore.get();
  const report = store.reports.find((r) => r.id === params.id);
  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const adminUser = { id: session.discordId, username: session.username, displayName: null, avatarUrl: session.avatarUrl };
  devStore.update((s) => {
    const target = s.reports.find((r) => r.id === params.id)!;
    target.status = status as typeof target.status;
    s.auditLog.push({
      id: crypto.randomUUID(),
      actor: adminUser,
      action: `${status} report`,
      targetType: "report",
      targetId: params.id,
      detail: null,
      createdAt: new Date().toISOString(),
    });
  });

  return NextResponse.json({ ok: true });
}
