import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/config";
import { devStore, nextShipNumber } from "@/lib/data/dev-store";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/roles";
import { BIO_MAX_LENGTH, type Ship } from "@/types";
import { backgroundImageUrl } from "@/lib/data/backgrounds";
import { manualPerson } from "@/lib/data/ships";

const SHIP_SELECT = "*, user_a:users!ships_user_a_id_fkey(*), user_b:users!ships_user_b_id_fkey(*)";

export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get("status");
  const page = Number(req.nextUrl.searchParams.get("page") ?? "1");
  const pageSize = 10;

  if (isSupabaseConfigured()) {
    const supabase = createClient();
    let query = supabase.from("ships").select(SHIP_SELECT, { count: "exact" });
    if (status && status !== "all") query = query.eq("status", status);

    const { data, count, error } = await query
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (!error) {
      return NextResponse.json({ ships: data, total: count ?? 0 });
    }
    console.error("Failed to list ships from Supabase, falling back to the local dev store", error);
  }

  let ships = [...devStore.get().ships].sort((a, b) => b.number - a.number);
  if (status && status !== "all") ships = ships.filter((s) => s.status === status);
  const total = ships.length;
  ships = ships.slice((page - 1) * pageSize, page * pageSize);
  return NextResponse.json({ ships, total });
}

/**
 * Manually-created ship: just two display names, an optional bio and
 * background — nobody has to have a Discord account connected to the site
 * to appear in a ship. Ship Creators and Admins can both do this; it's
 * created as confirmed straight away, because the person creating it is
 * vouching that they already collected consent from both people (the form
 * makes them tick that, and it's recorded in the audit log). Ship Creators
 * can later manage the ships they made this way (see created_by below);
 * Admins can manage any ship regardless of who created it.
 */
export async function POST(req: NextRequest) {
  const gate = await requireRole("ship_creator");
  if (gate.forbidden) return NextResponse.json({ error: gate.forbidden.error }, { status: gate.forbidden.status });
  const session = getSession()!;

  const body = await req.json();
  const personAName = typeof body.personAName === "string" ? body.personAName.trim() : "";
  const personBName = typeof body.personBName === "string" ? body.personBName.trim() : "";
  const bio = typeof body.bio === "string" ? body.bio.trim() : "";
  const backgroundId = typeof body.backgroundId === "string" && body.backgroundId ? body.backgroundId : null;

  // Optional "claim codes" — a Discord ID entered for a not-yet-connected
  // participant, checked only server-side later against whoever actually
  // logs in and tries to claim this ship (see lib/data/claims.ts). Not
  // validated against Discord's API here (we don't look people up by raw
  // ID), just shaped like a real snowflake so a typo doesn't silently save
  // something that can never match anyone.
  const DISCORD_ID_RE = /^\d{15,25}$/;
  const rawA = typeof body.personADiscordId === "string" ? body.personADiscordId.trim() : "";
  const rawB = typeof body.personBDiscordId === "string" ? body.personBDiscordId.trim() : "";
  if (rawA && !DISCORD_ID_RE.test(rawA)) {
    return NextResponse.json({ error: "Person 1's Discord ID doesn't look right." }, { status: 400 });
  }
  if (rawB && !DISCORD_ID_RE.test(rawB)) {
    return NextResponse.json({ error: "Person 2's Discord ID doesn't look right." }, { status: 400 });
  }
  if (rawA && rawB && rawA === rawB) {
    return NextResponse.json({ error: "Those can't be the same Discord ID." }, { status: 400 });
  }
  const personADiscordId = rawA || null;
  const personBDiscordId = rawB || null;

  if (!personAName || !personBName) {
    return NextResponse.json({ error: "Enter a display name for both people." }, { status: 400 });
  }
  if (personAName.length > 40 || personBName.length > 40) {
    return NextResponse.json({ error: "Display names can be up to 40 characters." }, { status: 400 });
  }
  if (personAName.toLowerCase() === personBName.toLowerCase()) {
    return NextResponse.json({ error: "A ship needs two different people." }, { status: 400 });
  }
  if (bio.length > BIO_MAX_LENGTH) {
    return NextResponse.json({ error: `Bios can be up to ${BIO_MAX_LENGTH} characters.` }, { status: 400 });
  }
  if (body.consentObtained !== true) {
    return NextResponse.json({ error: "Confirm that both people agreed to this ship first." }, { status: 400 });
  }

    if (isSupabaseConfigured()) {
    const supabase = createServiceRoleClient();

    if (backgroundId) {
      const { data: exists } = await supabase.from("backgrounds").select("id").eq("id", backgroundId).maybeSingle();
      if (!exists) {
        return NextResponse.json({ error: "Pick a background from the catalog." }, { status: 400 });
      }
    }

    const { data: ship, error } = await supabase
      .from("ships")
      .insert({
        person_a_name: personAName,
        person_b_name: personBName,
        status: "confirmed",
        is_two_auth: false,
        custom_text: bio || null,
        background_id: backgroundId,
        updated_by: session.discordId,
        created_by: session.discordId,
        person_a_discord_id: personADiscordId,
        person_b_discord_id: personBDiscordId,
      })
      .select("id, number")
      .single();

    if (error || !ship) {
      console.error("Failed to create ship", error);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }

    await supabase.from("audit_logs").insert({
      actor_id: session.discordId,
      action: `created ship (${gate.role})`,
      target_type: "ship",
      target_id: ship.id,
      detail: `#${ship.number} ${personAName} × ${personBName}`,
    });

    return NextResponse.json({ ship }, { status: 201 });
  }

  // Local dev store fallback
  const store = devStore.get();
  let background = null;
  if (backgroundId) {
    const entry = store.backgrounds.find((b) => b.id === backgroundId);
    if (!entry) {
      return NextResponse.json({ error: "Pick a background from the catalog." }, { status: 400 });
    }
    background = { id: entry.id, name: entry.name, imageUrl: backgroundImageUrl(entry.id), createdAt: entry.createdAt };
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const actor = { id: session.discordId, username: session.username, displayName: session.displayName ?? null, avatarUrl: session.avatarUrl };
  const ship: Ship = {
    id,
    number: nextShipNumber(store),
    userA: manualPerson(id, "a", personAName),
    userB: manualPerson(id, "b", personBName),
    status: "confirmed",
    isTwoAuth: false,
    customText: bio || null,
    customTextPending: null,
    customTextProposedBy: null,
    background,
    backgroundPending: null,
    backgroundProposedBy: null,
    createdAt: now,
    updatedAt: now,
    updatedBy: actor,
    createdBy: actor,
    endedAt: null,
  };

  devStore.update((s) => {
    s.ships.push(ship);
    if (personADiscordId || personBDiscordId) {
      s.claimCodes[id] = {
        ...(personADiscordId ? { a: personADiscordId } : {}),
        ...(personBDiscordId ? { b: personBDiscordId } : {}),
      };
    }
    s.auditLog.push({
      id: crypto.randomUUID(),
      actor,
      action: `created ship (${gate.role})`,
      targetType: "ship",
      targetId: id,
      detail: `#${ship.number} ${personAName} × ${personBName}`,
      createdAt: now,
    });
  });

  return NextResponse.json({ ship }, { status: 201 });
}
