import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/config";
import { devStore } from "@/lib/data/dev-store";
import { backgroundImageUrl } from "@/lib/data/backgrounds";
import { getSession } from "@/lib/session";
import { getRoleFor, isAtLeast, canManageManualShip, type Role } from "@/lib/roles";
import { BIO_MAX_LENGTH } from "@/types";

const SHIP_SELECT = "*, user_a:users!ships_user_a_id_fkey(*), user_b:users!ships_user_b_id_fkey(*)";

type Session = NonNullable<ReturnType<typeof getSession>>;

type PatchBody = {
  status?: string;
  customText?: string;
  backgroundId?: string;
  // Renaming a not-yet-claimed participant on a manual ship — see the
  // dedicated branch below, in each of patchViaSupabase/patchViaDevStore.
  personAName?: string;
  personBName?: string;
  // Admin-only — the private "claim code" for a not-yet-claimed side (see
  // lib/data/claims.ts). "" or null clears it.
  personADiscordId?: string | null;
  personBDiscordId?: string | null;
  // Explicit accept/decline of a proposal that's already pending — used by
  // the Requests page. Proposing a change is just PATCHing customText /
  // backgroundId (see ShipCustomText.tsx / ShipBackgroundPicker.tsx).
  field?: "bio" | "background";
  action?: "accept" | "decline";
};

const FIELD_COLUMNS = {
  bio: { value: "custom_text", pending: "custom_text_pending", proposedBy: "custom_text_proposed_by" },
  background: { value: "background_id", pending: "background_pending", proposedBy: "background_proposed_by" },
} as const;

const FIELD_LABEL = { bio: "bio", background: "background" } as const;

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const { data: ship, error } = await supabase.from("ships").select(SHIP_SELECT).eq("id", params.id).single();
    if (!error && ship) {
      return NextResponse.json({ ship });
    }
  }

  const store = devStore.get();
  const ship = store.ships.find((s) => s.id === params.id);
  if (!ship) return NextResponse.json({ error: "Ship not found." }, { status: 404 });
  return NextResponse.json({ ship });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in with Discord first." }, { status: 401 });
  }

  const body: PatchBody = await req.json();

  // Validate what's being proposed before touching anything.
  if (typeof body.customText === "string" && body.customText.length > BIO_MAX_LENGTH) {
    return NextResponse.json({ error: `Bios can be up to ${BIO_MAX_LENGTH} characters.` }, { status: 400 });
  }

  // Live role — never trust the session cookie's cached isAdmin for an
  // authorization decision (see lib/roles.ts).
  const role = await getRoleFor(session.discordId);

  if (isSupabaseConfigured()) {
    return patchViaSupabase(params.id, body, session, role);
  }
  return patchViaDevStore(params.id, body, session, role);
}

/**
 * Permanently removes an ended (or already-archived) ship and everything
 * tied to it — the ship row itself and any reports filed against it, so
 * nothing orphaned is left visible anywhere. Same authorization as ending
 * or archiving it: a participant on a two-auth ship, or an admin/the Ship
 * Creator who made a manual one.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in with Discord first." }, { status: 401 });
  }
  const role = await getRoleFor(session.discordId);

  if (isSupabaseConfigured()) {
    const supabase = createServiceRoleClient();
    const { data: ship, error: fetchError } = await supabase.from("ships").select("*").eq("id", params.id).single();
    if (fetchError || !ship) {
      return NextResponse.json({ error: "Ship not found." }, { status: 404 });
    }

    const isParticipant = session.discordId === ship.user_a_id || session.discordId === ship.user_b_id;
    const canManage = canManageManualShip(role, ship.created_by, session.discordId);
    if (!isParticipant && !canManage) {
      return NextResponse.json({ error: "You're not authorized to manage this ship." }, { status: 403 });
    }
    if (ship.status !== "ended" && ship.status !== "archived") {
      return NextResponse.json({ error: "Only an ended ship can be deleted." }, { status: 400 });
    }

    // Reports reference ships with ON DELETE SET NULL, but we actively
    // remove them too rather than leave a dangling, ship-less report
    // behind — "do not leave orphaned ... requests, or visible references".
    await supabase.from("reports").delete().eq("ship_id", params.id);
    const { error } = await supabase.from("ships").delete().eq("id", params.id);
    if (error) {
      console.error("Failed to delete ship", error);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const store = devStore.get();
  const ship = store.ships.find((s) => s.id === params.id);
  if (!ship) {
    return NextResponse.json({ error: "Ship not found." }, { status: 404 });
  }
  const isParticipant = session.discordId === ship.userA.id || session.discordId === ship.userB.id;
  const canManage = canManageManualShip(role, ship.createdBy?.id ?? null, session.discordId);
  if (!isParticipant && !canManage) {
    return NextResponse.json({ error: "You're not authorized to manage this ship." }, { status: 403 });
  }
  if (ship.status !== "ended" && ship.status !== "archived") {
    return NextResponse.json({ error: "Only an ended ship can be deleted." }, { status: 400 });
  }

  devStore.update((s) => {
    s.ships = s.ships.filter((x) => x.id !== params.id);
    s.reports = s.reports.filter((r) => r.shipId !== params.id);
  });
  return NextResponse.json({ ok: true });
}

/** Can this person manage this admin-created (no-account) ship directly? Admins can manage any; a Ship Creator only the ones they made. */


async function patchViaSupabase(shipId: string, body: PatchBody, session: Session, role: Role) {
  const supabase = createServiceRoleClient();

  const { data: ship, error: fetchError } = await supabase.from("ships").select("*").eq("id", shipId).single();
  if (fetchError || !ship) {
    return NextResponse.json({ error: "Ship not found." }, { status: 404 });
  }

  const isParticipant = session.discordId === ship.user_a_id || session.discordId === ship.user_b_id;
  const canManage = canManageManualShip(role, ship.created_by, session.discordId);
  if (!isParticipant && !canManage) {
    return NextResponse.json({ error: "You're not part of this ship." }, { status: 403 });
  }

  // --- Accept / decline a pending proposal (Requests page) ---
  if (body.field && body.action) {
    if (!ship.is_two_auth || !isParticipant) {
      return NextResponse.json({ error: "Only the two people in this ship can respond to that." }, { status: 403 });
    }
    const cols = FIELD_COLUMNS[body.field];
    if (!cols) return NextResponse.json({ error: "Unknown change." }, { status: 400 });
    const pendingValue = ship[cols.pending];
    if (pendingValue === null || pendingValue === undefined) {
      return NextResponse.json({ error: "There's nothing pending to respond to." }, { status: 400 });
    }
    if (ship[cols.proposedBy] === session.discordId) {
      return NextResponse.json({ error: "You proposed this — wait for the other person to respond." }, { status: 403 });
    }

    if (body.action === "accept") {
      await supabase
        .from("ships")
        .update({ [cols.value]: pendingValue, [cols.pending]: null, [cols.proposedBy]: null, updated_by: session.discordId })
        .eq("id", shipId);
    } else {
      await supabase.from("ships").update({ [cols.pending]: null, [cols.proposedBy]: null }).eq("id", shipId);
    }
    return NextResponse.json({ ok: true, status: body.action === "accept" ? "confirmed" : "declined" });
  }

  // --- Ending a ship ---
  if (body.status === "ended") {
    if (!ship.is_two_auth && !canManage) {
      return NextResponse.json({ error: "Only an admin (or the Ship Creator who made this) can end it." }, { status: 403 });
    }
    await supabase
      .from("ships")
      .update({ status: "ended", ended_at: new Date().toISOString(), updated_by: session.discordId })
      .eq("id", shipId);
    return NextResponse.json({ ok: true });
  }

  // --- Archiving an ended ship: the same people who could end it can also
  // archive it afterward, not just admins. ---
  if (body.status === "archived") {
    if (ship.status !== "ended") {
      return NextResponse.json({ error: "Only an ended ship can be archived." }, { status: 400 });
    }
    if (!isParticipant && !canManage) {
      return NextResponse.json({ error: "You're not authorized to manage this ship." }, { status: 403 });
    }
    await supabase.from("ships").update({ status: "archived", updated_by: session.discordId }).eq("id", shipId);
    return NextResponse.json({ ok: true });
  }

  // --- Renaming a not-yet-claimed participant, and/or editing their claim
  // code (the Discord ID that lets them later claim this slot), on a
  // manual ship. Direct edit only — there's no real account on that side
  // to propose this to. A side that's already been claimed by a real
  // Discord account can't be touched here: their name and identity come
  // from Discord from that point on. Renaming is open to whoever can
  // manage this ship (admin, or the Ship Creator who made it); the Discord
  // ID is admin-only, since it's what decides who's allowed to claim a
  // slot, and is never shown anywhere public. ---
  if (
    typeof body.personAName === "string" ||
    typeof body.personBName === "string" ||
    "personADiscordId" in body ||
    "personBDiscordId" in body
  ) {
    if (ship.is_two_auth) {
      return NextResponse.json({ error: "Both people's names come from Discord on this ship." }, { status: 400 });
    }
    if (!canManage) {
      return NextResponse.json({ error: "Only an admin (or the Ship Creator who made this) can rename this card." }, { status: 403 });
    }
    const wantsDiscordIdChange = "personADiscordId" in body || "personBDiscordId" in body;
    if (wantsDiscordIdChange && !isAtLeast(role, "admin")) {
      return NextResponse.json({ error: "Only an admin can edit Discord IDs." }, { status: 403 });
    }

    const update: Record<string, string | null> = {};
    const DISCORD_ID_RE = /^\d{15,25}$/;

    if (typeof body.personAName === "string") {
      if (ship.user_a_id) {
        return NextResponse.json({ error: "That side has already connected a Discord account." }, { status: 400 });
      }
      const name = body.personAName.trim();
      if (!name || name.length > 40) {
        return NextResponse.json({ error: "Names need to be 1–40 characters." }, { status: 400 });
      }
      update.person_a_name = name;
    }
    if (typeof body.personBName === "string") {
      if (ship.user_b_id) {
        return NextResponse.json({ error: "That side has already connected a Discord account." }, { status: 400 });
      }
      const name = body.personBName.trim();
      if (!name || name.length > 40) {
        return NextResponse.json({ error: "Names need to be 1–40 characters." }, { status: 400 });
      }
      update.person_b_name = name;
    }
    if ("personADiscordId" in body) {
      if (ship.user_a_id) {
        return NextResponse.json({ error: "That side has already connected a Discord account." }, { status: 400 });
      }
      const raw = typeof body.personADiscordId === "string" ? body.personADiscordId.trim() : "";
      if (raw && !DISCORD_ID_RE.test(raw)) {
        return NextResponse.json({ error: "That doesn't look like a real Discord ID." }, { status: 400 });
      }
      if (raw && raw === (body.personBDiscordId ?? ship.person_b_discord_id)) {
        return NextResponse.json({ error: "Those can't be the same Discord ID." }, { status: 400 });
      }
      update.person_a_discord_id = raw || null;
    }
    if ("personBDiscordId" in body) {
      if (ship.user_b_id) {
        return NextResponse.json({ error: "That side has already connected a Discord account." }, { status: 400 });
      }
      const raw = typeof body.personBDiscordId === "string" ? body.personBDiscordId.trim() : "";
      if (raw && !DISCORD_ID_RE.test(raw)) {
        return NextResponse.json({ error: "That doesn't look like a real Discord ID." }, { status: 400 });
      }
      if (raw && raw === (update.person_a_discord_id ?? ship.person_a_discord_id)) {
        return NextResponse.json({ error: "Those can't be the same Discord ID." }, { status: 400 });
      }
      update.person_b_discord_id = raw || null;
    }

    await supabase.from("ships").update({ ...update, updated_by: session.discordId }).eq("id", shipId);
    await supabase.from("audit_logs").insert({
      actor_id: session.discordId,
      action: wantsDiscordIdChange ? "edited ship participant claim code" : "renamed ship participant",
      target_type: "ship",
      target_id: shipId,
    });
    return NextResponse.json({ ok: true, status: "updated" });
  }

  // --- Proposing (or, for admin-created ships, directly setting) a bio / background ---
  if (typeof body.customText === "string" || typeof body.backgroundId === "string") {
    const field: "bio" | "background" = typeof body.customText === "string" ? "bio" : "background";
    const cols = FIELD_COLUMNS[field];
    const value = field === "bio" ? body.customText! : body.backgroundId!;
    const label = FIELD_LABEL[field];

    if (field === "background") {
      const { data: exists } = await supabase.from("backgrounds").select("id").eq("id", value).maybeSingle();
      if (!exists) {
        return NextResponse.json({ error: "Pick a background from the catalog." }, { status: 400 });
      }
    }

    // Admin-created / Ship-Creator-created ships: the people on them have
    // no accounts to approve anything, so whoever's allowed to manage the
    // card edits it directly.
    if (!ship.is_two_auth) {
      if (!canManage) {
        return NextResponse.json({ error: "Only an admin (or the Ship Creator who made this) can change this card." }, { status: 403 });
      }
      await supabase
        .from("ships")
        .update({ [cols.value]: value, [cols.pending]: null, [cols.proposedBy]: null, updated_by: session.discordId })
        .eq("id", shipId);
      await supabase.from("audit_logs").insert({
        actor_id: session.discordId,
        action: `updated ship ${label}`,
        target_type: "ship",
        target_id: shipId,
      });
      return NextResponse.json({ ok: true, status: "updated" });
    }

    if (!isParticipant) {
      return NextResponse.json({ error: "Only the two people in this ship can change its card." }, { status: 403 });
    }
    const pending = ship[cols.pending];
    if (pending !== null && pending !== undefined && ship[cols.proposedBy] !== session.discordId) {
      return NextResponse.json(
        { error: `The other person already proposed a ${label} change — respond to it in Requests first.` },
        { status: 409 }
      );
    }

    await supabase
      .from("ships")
      .update({ [cols.pending]: value, [cols.proposedBy]: session.discordId })
      .eq("id", shipId);
    return NextResponse.json({ ok: true, status: "awaiting_confirmation" });
  }

  // --- Admin status change (confirmed / pending / ended / archived) ---
  if (body.status) {
    if (!isAtLeast(role, "admin")) {
      return NextResponse.json({ error: "Admins only." }, { status: 403 });
    }
    await supabase.from("ships").update({ status: body.status, updated_by: session.discordId }).eq("id", shipId);
    await supabase.from("audit_logs").insert({
      actor_id: session.discordId,
      action: `set ship status to ${body.status}`,
      target_type: "ship",
      target_id: shipId,
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}

function patchViaDevStore(shipId: string, body: PatchBody, session: Session, role: Role) {
  const store = devStore.get();
  const ship = store.ships.find((s) => s.id === shipId);
  if (!ship) {
    return NextResponse.json({ error: "Ship not found." }, { status: 404 });
  }

  const isParticipant = session.discordId === ship.userA.id || session.discordId === ship.userB.id;
  const canManage = canManageManualShip(role, ship.createdBy?.id ?? null, session.discordId);
  if (!isParticipant && !canManage) {
    return NextResponse.json({ error: "You're not part of this ship." }, { status: 403 });
  }

  const actor = {
    id: session.discordId,
    username: session.username,
    displayName: session.displayName ?? null,
    avatarUrl: session.avatarUrl,
  };

  const KEYS = {
    bio: { value: "customText", pending: "customTextPending", proposedBy: "customTextProposedBy" },
    background: { value: "background", pending: "backgroundPending", proposedBy: "backgroundProposedBy" },
  } as const;

  // --- Accept / decline a pending proposal ---
  if (body.field && body.action) {
    if (!ship.isTwoAuth || !isParticipant) {
      return NextResponse.json({ error: "Only the two people in this ship can respond to that." }, { status: 403 });
    }
    const keys = KEYS[body.field];
    if (!keys) return NextResponse.json({ error: "Unknown change." }, { status: 400 });
    const pendingValue = (ship as any)[keys.pending];
    if (pendingValue === null || pendingValue === undefined) {
      return NextResponse.json({ error: "There's nothing pending to respond to." }, { status: 400 });
    }
    if ((ship as any)[keys.proposedBy]?.id === session.discordId) {
      return NextResponse.json({ error: "You proposed this — wait for the other person to respond." }, { status: 403 });
    }

    const now = new Date().toISOString();
    devStore.update((s) => {
      const target: any = s.ships.find((x) => x.id === shipId)!;
      if (body.action === "accept") {
        target[keys.value] = pendingValue;
        target.updatedBy = actor;
      }
      target[keys.pending] = null;
      target[keys.proposedBy] = null;
      target.updatedAt = now;
    });
    return NextResponse.json({ ok: true, status: body.action === "accept" ? "confirmed" : "declined" });
  }

  // --- Ending a ship ---
  if (body.status === "ended") {
    if (!ship.isTwoAuth && !canManage) {
      return NextResponse.json({ error: "Only an admin (or the Ship Creator who made this) can end it." }, { status: 403 });
    }
    const now = new Date().toISOString();
    devStore.update((s) => {
      const target = s.ships.find((x) => x.id === shipId)!;
      target.status = "ended";
      target.endedAt = now;
      target.updatedAt = now;
    });
    return NextResponse.json({ ok: true });
  }

  // --- Archiving an ended ship: the same people who could end it can also
  // archive it afterward, not just admins. ---
  if (body.status === "archived") {
    if (ship.status !== "ended") {
      return NextResponse.json({ error: "Only an ended ship can be archived." }, { status: 400 });
    }
    if (!isParticipant && !canManage) {
      return NextResponse.json({ error: "You're not authorized to manage this ship." }, { status: 403 });
    }
    const now = new Date().toISOString();
    devStore.update((s) => {
      const target = s.ships.find((x) => x.id === shipId)!;
      target.status = "archived";
      target.updatedAt = now;
    });
    return NextResponse.json({ ok: true });
  }

  // --- Renaming a not-yet-claimed participant, and/or editing their claim
  // code, on a manual ship. Direct edit only. A side that's already been
  // claimed can't be touched here: their identity comes from Discord from
  // that point on. Renaming is open to whoever can manage this ship;
  // editing the Discord ID is admin-only. ---
  if (
    typeof body.personAName === "string" ||
    typeof body.personBName === "string" ||
    "personADiscordId" in body ||
    "personBDiscordId" in body
  ) {
    if (ship.isTwoAuth) {
      return NextResponse.json({ error: "Both people's names come from Discord on this ship." }, { status: 400 });
    }
    if (!canManage) {
      return NextResponse.json({ error: "Only an admin (or the Ship Creator who made this) can rename this card." }, { status: 403 });
    }
    const wantsDiscordIdChange = "personADiscordId" in body || "personBDiscordId" in body;
    if (wantsDiscordIdChange && !isAtLeast(role, "admin")) {
      return NextResponse.json({ error: "Only an admin can edit Discord IDs." }, { status: 403 });
    }
    if (typeof body.personAName === "string" && !ship.userA.isPlaceholder) {
      return NextResponse.json({ error: "That side has already connected a Discord account." }, { status: 400 });
    }
    if (typeof body.personBName === "string" && !ship.userB.isPlaceholder) {
      return NextResponse.json({ error: "That side has already connected a Discord account." }, { status: 400 });
    }
    if ("personADiscordId" in body && !ship.userA.isPlaceholder) {
      return NextResponse.json({ error: "That side has already connected a Discord account." }, { status: 400 });
    }
    if ("personBDiscordId" in body && !ship.userB.isPlaceholder) {
      return NextResponse.json({ error: "That side has already connected a Discord account." }, { status: 400 });
    }

    const nameA = typeof body.personAName === "string" ? body.personAName.trim() : null;
    const nameB = typeof body.personBName === "string" ? body.personBName.trim() : null;
    if ((nameA !== null && (!nameA || nameA.length > 40)) || (nameB !== null && (!nameB || nameB.length > 40))) {
      return NextResponse.json({ error: "Names need to be 1–40 characters." }, { status: 400 });
    }

    const DISCORD_ID_RE = /^\d{15,25}$/;
    const existingCodes = store.claimCodes[shipId] ?? {};
    let codeA: string | null | undefined; // undefined = not being changed
    let codeB: string | null | undefined;
    if ("personADiscordId" in body) {
      const raw = typeof body.personADiscordId === "string" ? body.personADiscordId.trim() : "";
      if (raw && !DISCORD_ID_RE.test(raw)) {
        return NextResponse.json({ error: "That doesn't look like a real Discord ID." }, { status: 400 });
      }
      if (raw && raw === (body.personBDiscordId ?? existingCodes.b)) {
        return NextResponse.json({ error: "Those can't be the same Discord ID." }, { status: 400 });
      }
      codeA = raw || null;
    }
    if ("personBDiscordId" in body) {
      const raw = typeof body.personBDiscordId === "string" ? body.personBDiscordId.trim() : "";
      if (raw && !DISCORD_ID_RE.test(raw)) {
        return NextResponse.json({ error: "That doesn't look like a real Discord ID." }, { status: 400 });
      }
      if (raw && raw === (codeA ?? existingCodes.a)) {
        return NextResponse.json({ error: "Those can't be the same Discord ID." }, { status: 400 });
      }
      codeB = raw || null;
    }

    const now = new Date().toISOString();
    devStore.update((s) => {
      const target = s.ships.find((x) => x.id === shipId)!;
      if (nameA !== null) {
        target.userA = { ...target.userA, username: nameA, displayName: nameA };
      }
      if (nameB !== null) {
        target.userB = { ...target.userB, username: nameB, displayName: nameB };
      }
      if (codeA !== undefined || codeB !== undefined) {
        const current = s.claimCodes[shipId] ?? {};
        const next: { a?: string; b?: string } = { ...current };
        if (codeA !== undefined) {
          if (codeA) next.a = codeA;
          else delete next.a;
        }
        if (codeB !== undefined) {
          if (codeB) next.b = codeB;
          else delete next.b;
        }
        if (next.a || next.b) s.claimCodes[shipId] = next;
        else delete s.claimCodes[shipId];
      }
      target.updatedAt = now;
      target.updatedBy = actor;
      s.auditLog.push({
        id: crypto.randomUUID(),
        actor,
        action: wantsDiscordIdChange ? "edited ship participant claim code" : "renamed ship participant",
        targetType: "ship",
        targetId: shipId,
        detail: null,
        createdAt: now,
      });
    });
    return NextResponse.json({ ok: true, status: "updated" });
  }

  // --- Proposing (or, for admin-created ships, directly setting) a bio / background ---
  if (typeof body.customText === "string" || typeof body.backgroundId === "string") {
    const field: "bio" | "background" = typeof body.customText === "string" ? "bio" : "background";
    const keys = KEYS[field];

    let value: unknown = body.customText;
    if (field === "background") {
      const entry = store.backgrounds.find((b) => b.id === body.backgroundId);
      if (!entry) {
        return NextResponse.json({ error: "Pick a background from the catalog." }, { status: 400 });
      }
      value = { id: entry.id, name: entry.name, imageUrl: backgroundImageUrl(entry.id), createdAt: entry.createdAt };
    }

    const now = new Date().toISOString();

    if (!ship.isTwoAuth) {
      if (!canManage) {
        return NextResponse.json({ error: "Only an admin (or the Ship Creator who made this) can change this card." }, { status: 403 });
      }
      devStore.update((s) => {
        const target: any = s.ships.find((x) => x.id === shipId)!;
        target[keys.value] = value;
        target[keys.pending] = null;
        target[keys.proposedBy] = null;
        target.updatedAt = now;
        target.updatedBy = actor;
        s.auditLog.push({
          id: crypto.randomUUID(),
          actor,
          action: `updated ship ${FIELD_LABEL[field]}`,
          targetType: "ship",
          targetId: shipId,
          detail: null,
          createdAt: now,
        });
      });
      return NextResponse.json({ ok: true, status: "updated" });
    }

    if (!isParticipant) {
      return NextResponse.json({ error: "Only the two people in this ship can change its card." }, { status: 403 });
    }
    const existingPending = (ship as any)[keys.pending];
    if (existingPending !== null && existingPending !== undefined && (ship as any)[keys.proposedBy]?.id !== session.discordId) {
      return NextResponse.json(
        { error: `The other person already proposed a ${FIELD_LABEL[field]} change — respond to it in Requests first.` },
        { status: 409 }
      );
    }

    devStore.update((s) => {
      const target: any = s.ships.find((x) => x.id === shipId)!;
      target[keys.pending] = value;
      target[keys.proposedBy] = actor;
    });
    return NextResponse.json({ ok: true, status: "awaiting_confirmation" });
  }

  // --- Admin status change (confirmed / pending / ended / archived) ---
  if (body.status) {
    if (!isAtLeast(role, "admin")) {
      return NextResponse.json({ error: "Admins only." }, { status: 403 });
    }
    const now = new Date().toISOString();
    devStore.update((s) => {
      const target = s.ships.find((x) => x.id === shipId)!;
      target.status = body.status as typeof target.status;
      target.updatedAt = now;
      s.auditLog.push({
        id: crypto.randomUUID(),
        actor,
        action: `set ship status to ${body.status}`,
        targetType: "ship",
        targetId: shipId,
        detail: null,
        createdAt: now,
      });
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}
