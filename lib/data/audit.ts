import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import { getUserMapFor } from "./users";
import { devStore } from "./dev-store";
import type { AuditLogEntry } from "@/types";

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
      const users = await getUserMapFor((rows ?? []).map((r: any) => r.actor_id));
      return (rows ?? []).map((r: any) => ({
        id: r.id,
        actor: r.actor_id ? users.get(r.actor_id) ?? null : null,
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
  return [...devStore.get().auditLog].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 100);
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
