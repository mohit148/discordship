import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/config";
import { devStore, nextShipNumber } from "@/lib/data/dev-store";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/roles";
import type { Ship, AuditLogEntry } from "@/types";

// Distinct from /api/requests/[id]: that route lets the *recipient* respond
// normally. This one lets an admin step in — for stuck requests, disputes,
// or when someone asks an admin to finalize things on their behalf.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireRole("admin");
  if (gate.forbidden) return NextResponse.json({ error: gate.forbidden.error }, { status: gate.forbidden.status });
  const session = getSession()!;

  const { action } = await req.json(); // "approve" | "reject"

  if (isSupabaseConfigured()) {
    const supabase = createServiceRoleClient();

    const { data: request, error: fetchError } = await supabase
      .from("ship_requests")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }
    if (request.status !== "pending") {
      return NextResponse.json({ error: "Already resolved." }, { status: 409 });
    }

    const newStatus = action === "approve" ? "accepted" : "declined";
    await supabase
      .from("ship_requests")
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq("id", params.id);

    let ship = null;
    if (newStatus === "accepted") {
      const { data, error } = await supabase
        .from("ships")
        .insert({
          user_a_id: request.from_user_id,
          user_b_id: request.to_user_id,
          status: "confirmed",
          is_two_auth: true,
          custom_text: null,
          custom_text_pending: null,
          custom_text_proposed_by: null,
          updated_by: session.discordId,
          ended_at: null,
        })
        .select()
        .single();
      if (error) {
        console.error("Failed to create ship from admin-approved request", error);
        return NextResponse.json({ error: "Couldn't create the ship." }, { status: 500 });
      }
      ship = data;
    }

    await supabase.from("audit_logs").insert({
      actor_id: session.discordId,
      action: action === "approve" ? "approved request" : "rejected request",
      target_type: "request",
      target_id: params.id,
    });

    return NextResponse.json({ status: newStatus, ship });
  }

  // Local dev store fallback
  const store = devStore.get();
  const request = store.requests.find((r) => r.id === params.id);
  if (!request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "Already resolved." }, { status: 409 });
  }

  const newStatus = action === "approve" ? "accepted" : "declined";
  let createdShip: Ship | null = null;
  const adminUser = { id: session.discordId, username: session.username, displayName: null, avatarUrl: session.avatarUrl };

  devStore.update((s) => {
    const r = s.requests.find((x) => x.id === params.id)!;
    r.status = newStatus;
    r.respondedAt = new Date().toISOString();

    if (newStatus === "accepted") {
      const now = new Date().toISOString();
      const ship: Ship = {
        id: crypto.randomUUID(),
        number: nextShipNumber(s),
        userA: r.fromUser,
        userB: r.toUser,
        status: "confirmed",
        isTwoAuth: true,
        customText: null,
        customTextPending: null,
        customTextProposedBy: null,
        background: null,
        backgroundPending: null,
        backgroundProposedBy: null,
        createdAt: now,
        updatedAt: now,
        updatedBy: adminUser,
        createdBy: null,
        endedAt: null,
      };
      s.ships.push(ship);
      createdShip = ship;
    }

    const auditEntry: AuditLogEntry = {
      id: crypto.randomUUID(),
      actor: adminUser,
      action: action === "approve" ? "approved request" : "rejected request",
      targetType: "request",
      targetId: params.id,
      detail: null,
      createdAt: new Date().toISOString(),
    };
    s.auditLog.push(auditEntry);
  });

  return NextResponse.json({ status: newStatus, ship: createdShip });
}
