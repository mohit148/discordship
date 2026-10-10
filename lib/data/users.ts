import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import { devStore } from "./dev-store";
import type { DiscordUser } from "@/types";

export function mapUserRow(row: any): DiscordUser {
  return {
    id: row.discord_id,
    username: row.username,
    displayName: row.display_name,
    // Effective avatar: their own override if they set one, else the
    // Discord-synced avatar. The override is a separate column
    // (avatar_override_url) that Discord login never touches, so it
    // survives future logins — see app/api/auth/discord/callback/route.ts.
    avatarUrl: row.avatar_override_url || row.avatar_url,
    customAvatarUrl: row.avatar_override_url ?? null,
    isAdmin: row.is_admin,
    role: row.role ?? "visitor",
    // Older rows created before this column existed default to accepting
    // requests, same as the DB column default.
    acceptsRequests: row.accepts_requests ?? true,
  };
}

function placeholderUser(id: string): DiscordUser {
  return { id, username: `user_${id}`, displayName: null, avatarUrl: null, acceptsRequests: true, role: "visitor" };
}

/**
 * The dev store keeps each user's raw Discord-synced avatar in `avatarUrl`
 * (login always refreshes it there) and their override, if any, in
 * `customAvatarUrl` — never merging the two in storage. This computes the
 * same "effective avatar" view that mapUserRow() derives from the two
 * separate Supabase columns, so every read path shows the same thing
 * regardless of which backend is active.
 */
function withEffectiveAvatar(user: DiscordUser): DiscordUser {
  if (!user.customAvatarUrl) return user;
  return { ...user, avatarUrl: user.customAvatarUrl };
}

/**
 * Looks up a batch of Discord IDs and returns them keyed by ID, for
 * stitching onto ships/requests/reports/audit rows. Anyone not found in
 * Supabase falls back to the local dev store, then a bare placeholder — so
 * a page never crashes on a missing join.
 */
export async function getUserMapFor(ids: (string | null | undefined)[]): Promise<Map<string, DiscordUser>> {
  const uniqueIds = Array.from(new Set(ids.filter((id): id is string => !!id)));
  const map = new Map<string, DiscordUser>();
  if (uniqueIds.length === 0) return map;

  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("users").select("*").in("discord_id", uniqueIds);
      if (!error && data) {
        data.forEach((row: any) => map.set(row.discord_id, mapUserRow(row)));
      }
    } catch (err) {
      console.error("Failed to look up users from Supabase", err);
    }
  }

  if (map.size < uniqueIds.length) {
    const localUsers = devStore.get().users;
    uniqueIds.forEach((id) => {
      if (!map.has(id)) {
        const local = localUsers.find((u) => u.id === id);
        map.set(id, local ? withEffectiveAvatar(local) : placeholderUser(id));
      }
    });
  }

  return map;
}

/**
 * All users, for the admin Users page. Reads from Supabase whenever it's
 * configured — including a genuinely empty table, which now correctly
 * returns `[]` instead of masking it with sample data.
 */
export async function getUsers(): Promise<DiscordUser[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("users").select("*").order("username");
      if (error) throw error;
      return (data ?? []).map(mapUserRow);
    } catch (err) {
      console.error("Failed to load users from Supabase, falling back to the local dev store", err);
    }
  }
  return devStore.get().users.map(withEffectiveAvatar);
}

/**
 * A single user's own record, by Discord ID — used to hydrate the current
 * viewer's "accepts ship requests" preference and PFP override. Uses the
 * service-role client since this app authenticates via a custom session
 * cookie (see lib/session.ts), not Supabase Auth, so there's no `auth.jwt()`
 * for a per-row RLS policy to check against.
 */
export async function getUserById(id: string): Promise<DiscordUser | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase.from("users").select("*").eq("discord_id", id).maybeSingle();
      if (error) throw error;
      return data ? mapUserRow(data) : null;
    } catch (err) {
      console.error("Failed to load user from Supabase, falling back to the local dev store", err);
    }
  }
  const user = devStore.get().users.find((u) => u.id === id);
  return user ? withEffectiveAvatar(user) : null;
}

/** Updates whether a user accepts incoming ship requests. */
export async function setAcceptsRequests(id: string, acceptsRequests: boolean): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { error } = await supabase.from("users").update({ accepts_requests: acceptsRequests }).eq("discord_id", id);
      if (error) throw error;
      return;
    } catch (err) {
      console.error("Failed to update accepts_requests in Supabase, falling back to the local dev store", err);
    }
  }
  devStore.update((s) => {
    const user = s.users.find((u) => u.id === id);
    if (user) user.acceptsRequests = acceptsRequests;
  });
}

/**
 * Sets (or clears, with `null`) someone's own profile picture from an
 * uploaded image (already resized in the browser and validated by the
 * route). Every caller must have verified `id` is the signed-in user — see
 * PATCH /api/users/me — since this is the one bit of a card someone always
 * changes unilaterally, no partner approval needed. It only affects that
 * one person's own avatar, never their partner's, and never touches their
 * Discord avatar (clearing it just falls back to that).
 *
 * The image itself lives in user_avatars; users.avatar_override_url just
 * holds a small versioned URL to it, so listing users/ships stays light.
 */
export async function setCustomAvatar(id: string, imageData: string | null): Promise<void> {
  const url = imageData ? `/api/avatars/${id}?v=${Date.now()}` : null;

  if (isSupabaseConfigured()) {
    const supabase = createServiceRoleClient();
    if (imageData) {
      const { error } = await supabase
        .from("user_avatars")
        .upsert({ discord_id: id, image_data: imageData, updated_at: new Date().toISOString() });
      if (error) throw error;
    } else {
      await supabase.from("user_avatars").delete().eq("discord_id", id);
    }
    const { error } = await supabase.from("users").update({ avatar_override_url: url }).eq("discord_id", id);
    if (error) throw error;
    return;
  }

  devStore.update((s) => {
    if (imageData) s.avatars[id] = imageData;
    else delete s.avatars[id];
    const user = s.users.find((u) => u.id === id);
    if (user) user.customAvatarUrl = url;
  });
}

/** The stored uploaded picture (a data URL) for one person, for the avatar route. */
export async function getCustomAvatarData(id: string): Promise<string | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data, error } = await supabase.from("user_avatars").select("image_data").eq("discord_id", id).maybeSingle();
      if (error) throw error;
      return data?.image_data ?? null;
    } catch (err) {
      console.error("Failed to load avatar from Supabase, falling back to the local dev store", err);
    }
  }
  return devStore.get().avatars[id] ?? null;
}
