import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import { getUserMapFor } from "./users";
import { getBackgroundMap, backgroundImageUrl } from "./backgrounds";
import { devStore } from "./dev-store";
import type { BackgroundPreset, CardChangeRequest, DiscordUser, Ship } from "@/types";

/**
 * Someone who only exists as a name on an admin-created ship — no Discord
 * account connected. Their ID can never match a real session, so they can
 * never be treated as a participant who can log in and edit things.
 */
export function manualPerson(shipId: string, side: "a" | "b", name: string): DiscordUser {
  return {
    id: `manual:${shipId}:${side}`,
    username: name,
    displayName: name,
    avatarUrl: null,
    isPlaceholder: true,
  };
}

function mapShipRow(row: any, users: Map<string, DiscordUser>, backgrounds: Map<string, BackgroundPreset>): Ship {
  return {
    id: row.id,
    number: row.number,
    userA: row.user_a_id ? users.get(row.user_a_id)! : manualPerson(row.id, "a", row.person_a_name ?? "Someone"),
    userB: row.user_b_id ? users.get(row.user_b_id)! : manualPerson(row.id, "b", row.person_b_name ?? "Someone"),
    status: row.status,
    isTwoAuth: row.is_two_auth,
    customText: row.custom_text,
    customTextPending: row.custom_text_pending,
    customTextProposedBy: row.custom_text_proposed_by ? users.get(row.custom_text_proposed_by) ?? null : null,
    background: row.background_id ? backgrounds.get(row.background_id) ?? null : null,
    backgroundPending: row.background_pending ? backgrounds.get(row.background_pending) ?? null : null,
    backgroundProposedBy: row.background_proposed_by ? users.get(row.background_proposed_by) ?? null : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ? users.get(row.updated_by) ?? null : null,
    createdBy: row.created_by ? users.get(row.created_by) ?? null : null,
    endedAt: row.ended_at,
  };
}

/**
 * The dev store snapshots each participant's DiscordUser and background
 * onto the ship record when it's written (unlike the Supabase path, which
 * always joins the live tables). This re-overlays the current avatars and
 * catalog backgrounds at read time so later changes — a new profile
 * picture, a background removed from the catalog — show up on existing
 * ships. Everything else stays as stored.
 */
function withLive(ship: Ship, store: ReturnType<typeof devStore.get>): Ship {
  const catalog = new Map<string, BackgroundPreset>(
    store.backgrounds.map((b) => [
      b.id,
      { id: b.id, name: b.name, imageUrl: backgroundImageUrl(b.id), createdAt: b.createdAt },
    ])
  );
  /**
   * Keeps a ship's participants in sync with Discord — not just avatar
   * overrides, but username/displayName too, so a Discord display-name
   * change shows up on every ship they're part of rather than staying
   * frozen at whatever it was when the ship was created. Manual
   * placeholder people (no linked account yet) simply have no match in
   * store.users, so they're left exactly as the admin entered them.
   */
  const refresh = (u: DiscordUser): DiscordUser => {
    const live = store.users.find((x) => x.id === u.id);
    if (!live) return u;
    return {
      ...u,
      username: live.username,
      displayName: live.displayName,
      avatarUrl: live.customAvatarUrl || live.avatarUrl,
      customAvatarUrl: live.customAvatarUrl,
    };
  };
  return {
    ...ship,
    userA: refresh(ship.userA),
    userB: refresh(ship.userB),
    background: ship.background ? catalog.get(ship.background.id) ?? null : null,
    backgroundPending: ship.backgroundPending ? catalog.get(ship.backgroundPending.id) ?? null : null,
  };
}

/**
 * All ships, newest first. Reads from Supabase whenever it's configured —
 * including a genuinely empty table, which now correctly returns `[]`
 * instead of masking it with sample data. Only falls back to the local dev
 * store (see dev-store.ts) if Supabase isn't configured, or the query
 * itself fails (bad keys, network error, etc).
 */
export async function getShips(): Promise<Ship[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: rows, error } = await supabase.from("ships").select("*").order("number", { ascending: false });
      if (error) throw error;
      const [users, backgrounds] = await Promise.all([
        getUserMapFor(
          (rows ?? []).flatMap((r: any) => [
            r.user_a_id,
            r.user_b_id,
            r.updated_by,
            r.custom_text_proposed_by,
            r.background_proposed_by,
          ])
        ),
        getBackgroundMap(),
      ]);
      return (rows ?? []).map((r: any) => mapShipRow(r, users, backgrounds));
    } catch (err) {
      console.error("Failed to load ships from Supabase, falling back to the local dev store", err);
    }
  }
  const store = devStore.get();
  return [...store.ships].sort((a, b) => b.number - a.number).map((s) => withLive(s, store));
}

/** A single ship by ID — checks Supabase first, then the local dev store. */
export async function getShipById(id: string): Promise<Ship | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data: row, error } = await supabase.from("ships").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (row) {
        const [users, backgrounds] = await Promise.all([
          getUserMapFor([
            row.user_a_id,
            row.user_b_id,
            row.updated_by,
            row.custom_text_proposed_by,
            row.background_proposed_by,
          ]),
          getBackgroundMap(),
        ]);
        return mapShipRow(row, users, backgrounds);
      }
      return null;
    } catch (err) {
      console.error("Failed to load ship from Supabase, falling back to the local dev store", err);
    }
  }
  const store = devStore.get();
  const ship = store.ships.find((s) => s.id === id);
  return ship ? withLive(ship, store) : null;
}

/**
 * Bio and background changes that someone else proposed on one of the
 * viewer's ships, still waiting on the viewer's confirmation — shown on the
 * unified Requests page alongside ship requests. Not a separate table:
 * derived from the pending/proposed_by columns already on `ships` (the same
 * ones the ship page's propose flow writes — see app/api/ships/[id]/route.ts).
 */
export async function getCardChangeRequestsForUser(userId: string): Promise<CardChangeRequest[]> {
  const ships = await getShips();
  const mine = ships.filter((s) => s.userA.id === userId || s.userB.id === userId);
  const result: CardChangeRequest[] = [];

  for (const ship of mine) {
    if (ship.customTextPending !== null && ship.customTextProposedBy && ship.customTextProposedBy.id !== userId) {
      result.push({
        id: `${ship.id}:bio`,
        ship,
        field: "bio",
        proposedBy: ship.customTextProposedBy,
        proposedValue: ship.customTextPending,
        currentValue: ship.customText,
        proposedBackground: null,
        currentBackground: null,
      });
    }
    if (ship.backgroundPending && ship.backgroundProposedBy && ship.backgroundProposedBy.id !== userId) {
      result.push({
        id: `${ship.id}:background`,
        ship,
        field: "background",
        proposedBy: ship.backgroundProposedBy,
        proposedValue: ship.backgroundPending.name,
        currentValue: ship.background?.name ?? null,
        proposedBackground: ship.backgroundPending,
        currentBackground: ship.background,
      });
    }
  }

  return result;
}
