import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole, setUserRole, getRoleFor, isOwnerId, DB_ROLES, type DbRole } from "@/lib/roles";
import { recordAudit } from "@/lib/data/audit";

/**
 * Changes someone's role. Admins can hand out/revoke "Ship Creator", but
 * only the Owner can grant or revoke "Admin" — matching "Owner is the only
 * role that can promote/demote Admins". Every check here is against the
 * *actor's* live role (never their session cookie) and the *target's* live
 * role, so nobody can grant themselves anything by editing a cookie, and an
 * Admin can't quietly demote another Admin by calling this directly either.
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const gate = await requireRole("admin");
  if (gate.forbidden) return NextResponse.json({ error: gate.forbidden.error }, { status: gate.forbidden.status });
  const session = getSession()!;

  const { role } = await req.json();
  if (!DB_ROLES.includes(role)) {
    return NextResponse.json({ error: "Not a real role." }, { status: 400 });
  }

  if (isOwnerId(params.id)) {
    return NextResponse.json({ error: "The Owner's role can't be changed here — it's set by OWNER_DISCORD_ID." }, { status: 400 });
  }

  const targetRole = await getRoleFor(params.id);
  const isOwnerActing = gate.role === "owner";

  // Only the Owner touches anything involving "admin" — granting it,
  // revoking it, or changing the role of someone who already has it.
  if ((role as DbRole) === "admin" || targetRole === "admin") {
    if (!isOwnerActing) {
      return NextResponse.json({ error: "Only the Owner can promote or demote Admins." }, { status: 403 });
    }
  }

  await setUserRole(params.id, role as DbRole);
  await recordAudit({
    actor: { id: session.discordId, username: session.username, displayName: session.displayName, avatarUrl: session.avatarUrl },
    action: `set role to ${role}`,
    targetType: "user",
    targetId: params.id,
  });

  return NextResponse.json({ ok: true, role });
}
