import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import { getUserMapFor } from "./users";
import { devStore } from "./dev-store";
import { isDiscordId } from "@/lib/ids";
import type { AuditLogEntry, DiscordUser } from "@/types";

/** Shown for someone who has since left (account removed) or whose id no longer matches anyone. */
export const FORMER_MEMBER: DiscordUser = { id: "former-member", username: "Former member", displayName: "Former member", avatarUrl: null, isPlaceholder: true };

/**
 * A real person from the user map, or null. getUserMapFor() hands back a bare
 * "user_<id>" stand-in for ids it can't find — that must never reach the screen.
 */
function realUser(users: Map<string, DiscordUser>, id: string | null | undefined): DiscordUser | null {
  if (!id) return null;
  const u = users.get(id);
  if (!u || u.username === `user_${id}`) return null;
  return u;
}

/**
 * The last 100 audit log entries, newest first — admin-only (see
 * app/admin/layout.tsx). audit_logs has no RLS select policy at all (by
 * design — see schema.sql), so this must use the service-role client; the
 * anon client would always see zero rows here.
 */
export async function getAuditLog(): Promise<AuditLogEntry[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data: rows, error } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const targetIds = (rows ?? []).filter((r: any) => r.target_type === "user" && isDiscordId(r.target_id)).map((r: any) => r.target_id);
      const users = await getUserMapFor([...(rows ?? []).map((r: any) => r.actor_id), ...targetIds]);
      return (rows ?? []).map((r: any) => ({
        id: r.id,
        // An actor id that matches nobody (account removed, or an id left over from an older
        // setup) reads as "Former member" — never a raw id. No actor id at all = the system.
        actor: r.actor_id ? realUser(users, r.actor_id) ?? FORMER_MEMBER : null,
        targetUser: r.target_type === "user" ? realUser(users, r.target_id) : null,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        detail: r.detail,
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.error("Failed to load audit log from Supabase, falling back to the local dev store", err);
    }
  }
  const store = devStore.get();
  return [...store.auditLog]
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, 100)
    .map((e) => {
      // Show the live profile (name + picture) rather than whatever was saved when the action happened.
      const live = e.actor ? store.users.find((u) => u.id === e.actor!.id) : null;
      const target = e.targetType === "user" ? store.users.find((u) => u.id === e.targetId) ?? null : null;
      return { ...e, actor: e.actor ? (live ?? e.actor) : null, targetUser: target };
    });
}

/** Records an admin action in the audit log (Supabase, or the local dev store). */
export async function recordAudit(entry: {
  /** null = the system itself (e.g. the automatic cleanup job). */
  actor: { id: string; username: string; displayName?: string | null; avatarUrl: string | null } | null;
  action: string;
  targetType: AuditLogEntry["targetType"];
  targetId: string | null;
  detail?: string | null;
}): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { error } = await supabase.from("audit_logs").insert({
        actor_id: entry.actor?.id ?? null,
        action: entry.action,
        target_type: entry.targetType,
        target_id: entry.targetId,
        detail: entry.detail ?? null,
      });
      if (error) throw error;
      return;
    } catch (err) {
      console.error("Failed to write audit log to Supabase, falling back to the local dev store", err);
    }
  }
  devStore.update((s) => {
    s.auditLog.push({
      id: crypto.randomUUID(),
      actor: entry.actor ? { ...entry.actor, displayName: entry.actor.displayName ?? null } : null,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      detail: entry.detail ?? null,
      createdAt: new Date().toISOString(),
    });
  });
}
