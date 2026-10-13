import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import { devStore } from "./dev-store";
import { isDiscordId } from "@/lib/ids";
import { getShips } from "./ships";
import { displayNameOf } from "@/lib/user-display";

export interface ClaimableSlot {
  shipId: string;
  side: "a" | "b";
  /** Just enough to recognize which ship this is — never the stored Discord ID itself. */
  otherPersonName: string;
  yourName: string;
}

/**
 * Ships where someone entered *this* Discord ID as a not-yet-connected
 * participant, and that side hasn't been claimed yet. Only ever looks up
 * by the caller's own authenticated ID — see getCurrentClaimableShips()
 * and the /claim page, which is the only place this is used.
 */
export async function getClaimableShipsForDiscordId(discordId: string): Promise<ClaimableSlot[]> {
  const slots: { shipId: string; side: "a" | "b" }[] = [];

  if (isSupabaseConfigured()) {
    try {
      if (!isDiscordId(discordId)) return [];
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("ships")
        .select("id, user_a_id, user_b_id, person_a_discord_id, person_b_discord_id")
        .or(`person_a_discord_id.eq.${discordId},person_b_discord_id.eq.${discordId}`);
      if (error) throw error;
      for (const row of data ?? []) {
        if (row.person_a_discord_id === discordId && !row.user_a_id) slots.push({ shipId: row.id, side: "a" });
        if (row.person_b_discord_id === discordId && !row.user_b_id) slots.push({ shipId: row.id, side: "b" });
      }
    } catch (err) {
      console.error("Failed to look up claimable ships from Supabase", err);
      return [];
    }
  } else {
    const store = devStore.get();
    for (const ship of store.ships) {
      const codes = store.claimCodes[ship.id];
      if (!codes) continue;
      if (codes.a === discordId && ship.userA.isPlaceholder) slots.push({ shipId: ship.id, side: "a" });
      if (codes.b === discordId && ship.userB.isPlaceholder) slots.push({ shipId: ship.id, side: "b" });
    }
  }

  if (slots.length === 0) return [];

  // Pull display names for the ship-picker UI through the normal public
  // path — nothing sensitive here, just which ships these are.
  const ships = await getShips();
  const result: ClaimableSlot[] = [];
  for (const { shipId, side } of slots) {
    const ship = ships.find((s) => s.id === shipId);
    if (!ship) continue;
    result.push({
      shipId,
      side,
      yourName: displayNameOf(side === "a" ? ship.userA : ship.userB),
      otherPersonName: displayNameOf(side === "a" ? ship.userB : ship.userA),
    });
  }
  return result;
}

/**
 * The raw claim codes for one ship, for the admin edit UI to prefill —
 * never returned by any public-facing function, and the ship detail page
 * only ever calls this once it's already confirmed the viewer is an admin.
 * A side that's already claimed (a real account linked) has no code to
 * show, since there's nothing left to verify for it.
 */
export async function getClaimCodesForShip(shipId: string): Promise<{ a: string | null; b: string | null }> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase
        .from("ships")
        .select("user_a_id, user_b_id, person_a_discord_id, person_b_discord_id")
        .eq("id", shipId)
        .maybeSingle();
      if (error || !data) return { a: null, b: null };
      return {
        a: !data.user_a_id ? data.person_a_discord_id ?? null : null,
        b: !data.user_b_id ? data.person_b_discord_id ?? null : null,
      };
    } catch (err) {
      console.error("Failed to load claim codes from Supabase", err);
      return { a: null, b: null };
    }
  }
  const codes = devStore.get().claimCodes[shipId];
  return { a: codes?.a ?? null, b: codes?.b ?? null };
}

export type ClaimResult = { ok: true; side: "a" | "b" } | { ok: false; error: string };

/**
 * The actual verification: does the stored Discord ID for either side of
 * this ship match the one the caller authenticated with? Always called
 * with `discordId` taken straight from the signed-in session (see
 * POST /api/ships/[id]/claim) — there's no separate claim token, the
 * existing Discord login *is* the proof. A match on one side only ever
 * links that side; the other participant is never touched.
 */
export async function claimShip(shipId: string, discordId: string): Promise<ClaimResult> {
  if (isSupabaseConfigured()) {
    const supabase = createServiceRoleClient();
    const { data: ship, error } = await supabase
      .from("ships")
      .select("id, user_a_id, user_b_id, person_a_discord_id, person_b_discord_id")
      .eq("id", shipId)
      .maybeSingle();
    if (error || !ship) return { ok: false, error: "That ship doesn't exist." };

    let side: "a" | "b" | null = null;
    if (ship.person_a_discord_id === discordId && !ship.user_a_id) side = "a";
    else if (ship.person_b_discord_id === discordId && !ship.user_b_id) side = "b";

    if (!side) return { ok: false, error: "This isn't something you can claim." };

    const { error: updateError } = await supabase
      .from("ships")
      .update(
        side === "a"
          ? { user_a_id: discordId, is_two_auth: !!ship.user_b_id }
          : { user_b_id: discordId, is_two_auth: !!ship.user_a_id }
      )
      .eq("id", shipId);
    if (updateError) return { ok: false, error: "Something went wrong." };

    return { ok: true, side };
  }

  const store = devStore.get();
  const ship = store.ships.find((s) => s.id === shipId);
  const codes = store.claimCodes[shipId];
  if (!ship || !codes) return { ok: false, error: "That ship doesn't exist." };

  let side: "a" | "b" | null = null;
  if (codes.a === discordId && ship.userA.isPlaceholder) side = "a";
  else if (codes.b === discordId && ship.userB.isPlaceholder) side = "b";
  if (!side) return { ok: false, error: "This isn't something you can claim." };

  const claimant = store.users.find((u) => u.id === discordId);
  if (!claimant) return { ok: false, error: "Log in with Discord first." };

  devStore.update((s) => {
    const target = s.ships.find((x) => x.id === shipId)!;
    if (side === "a") {
      target.userA = claimant;
      target.isTwoAuth = !target.userB.isPlaceholder;
    } else {
      target.userB = claimant;
      target.isTwoAuth = !target.userA.isPlaceholder;
    }
  });

  return { ok: true, side };
}
