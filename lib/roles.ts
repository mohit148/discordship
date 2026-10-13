import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/config";
import { devStore } from "@/lib/data/dev-store";
import { getSession } from "@/lib/session";

export type Role = "visitor" | "ship_creator" | "admin" | "owner";

export const DB_ROLES = ["visitor", "ship_creator", "admin"] as const;
export type DbRole = (typeof DB_ROLES)[number];

const RANK: Record<Role, number> = { visitor: 0, ship_creator: 1, admin: 2, owner: 3 };

export function isAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/** Can this person manage this manually-created (no-account) ship directly? Admins can manage any; a Ship Creator only the ones they made. */
export function canManageManualShip(role: Role, creatorId: string | null | undefined, viewerId: string): boolean {
  if (isAtLeast(role, "admin")) return true;
  return role === "ship_creator" && !!creatorId && creatorId === viewerId;
}

/**
 * The Owner is never a stored role — they're recognized purely by Discord
 * ID, from OWNER_DISCORD_ID in the environment. That's what lets them keep
 * Owner access "even if their database role is missing or incorrect": there
 * is no database row this depends on.
 */
export function isOwnerId(discordId: string): boolean {
  const ownerId = process.env.OWNER_DISCORD_ID;
  return !!ownerId && discordId === ownerId;
}

/**
 * Resolves someone's real role from the source of truth: the Owner env var
 * first, then their live `role` column. Never trust a session cookie for
 * this — a cookie is only a snapshot from whenever they last logged in, so
 * using it to gate anything would mean a promotion or demotion doesn't take
 * effect until their next login (or, worse, a forged/stale cookie claiming
 * a role it no longer has). Every admin-gated page and API route calls this
 * fresh on every request instead.
 */
export async function getRoleFor(discordId: string, dbRole?: string | null): Promise<Role> {
  if (isOwnerId(discordId)) return "owner";
  const role = dbRole !== undefined ? dbRole : await getStoredRole(discordId);
  if (role === "admin") return "admin";
  if (role === "ship_creator") return "ship_creator";
  return "visitor";
}

async function getStoredRole(discordId: string): Promise<DbRole> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from("users").select("role").eq("discord_id", discordId).maybeSingle();
      if (error) throw error;
      return (data?.role as DbRole) ?? "visitor";
    } catch (err) {
      console.error("Failed to look up role from Supabase, falling back to the local dev store", err);
    }
  }
  return (devStore.get().users.find((u) => u.id === discordId)?.role as DbRole) ?? "visitor";
}

/** The signed-in visitor's real, freshly-checked role — "visitor" if not logged in. */
export async function getCurrentRole(): Promise<Role> {
  const session = getSession();
  if (!session) return "visitor";
  return getRoleFor(session.discordId);
}

/**
 * Guards a route handler: resolves the caller's live role and, if it
 * doesn't meet `min`, returns a 403 body to send back immediately. Returns
 * null (meaning "go ahead") along with the resolved role when it's allowed.
 *
 * ```ts
 * const gate = await requireRole("admin");
 * if (gate.forbidden) return gate.forbidden;
 * // gate.role is "admin" or "owner" here
 * ```
 */
export async function requireRole(min: Role): Promise<{ forbidden: { error: string; status: number } | null; role: Role; discordId: string | null }> {
  const session = getSession();
  if (!session) {
    return { forbidden: { error: "Log in with Discord first.", status: 401 }, role: "visitor", discordId: null };
  }
  const role = await getRoleFor(session.discordId);
  if (!isAtLeast(role, min)) {
    return { forbidden: { error: "You don't have permission to do that.", status: 403 }, role, discordId: session.discordId };
  }
  return { forbidden: null, role, discordId: session.discordId };
}

/** Sets someone's stored role. Callers must already have verified the actor is allowed to do this (see requireRole). */
export async function setUserRole(discordId: string, role: DbRole): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = createServiceRoleClient();
    const { error } = await supabase
      .from("users")
      .update({ role, is_admin: role === "admin" }) // is_admin kept in sync for any legacy read of it
      .eq("discord_id", discordId);
    if (error) throw error;
    return;
  }
  devStore.update((s) => {
    const user = s.users.find((u) => u.id === discordId);
    if (user) {
      user.role = role;
      user.isAdmin = role === "admin";
    }
  });
}
