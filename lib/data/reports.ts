import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import { getUserMapFor } from "./users";
import { devStore } from "./dev-store";
import type { Report } from "@/types";

/**
 * Reports, newest first — admin-only (see app/admin/layout.tsx). Uses the
 * service-role client: there's no Supabase Auth session to check an
 * `auth.jwt()`-based RLS policy against (see the note in schema.sql), so
 * admin-only reads for this table are gated in application code instead.
 */
export async function getReports(): Promise<Report[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data: rows, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const users = await getUserMapFor((rows ?? []).flatMap((r: any) => [r.reported_by, r.reported_user_id]));
      return (rows ?? []).map((r: any) => ({
        id: r.id,
        shipId: r.ship_id,
        reportedUser: r.reported_user_id ? users.get(r.reported_user_id) ?? null : null,
        reportedBy: users.get(r.reported_by)!,
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at,
      }));
    } catch (err) {
      console.error("Failed to load reports from Supabase, falling back to the local dev store", err);
    }
  }
  return [...devStore.get().reports].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

/** Files a new report against a ship/card and/or a specific person. */
export async function createReport(input: {
  shipId: string | null;
  reportedUserId: string | null;
  reportedBy: string;
  reason: string;
}): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { error } = await supabase.from("reports").insert({
        ship_id: input.shipId,
        reported_user_id: input.reportedUserId,
        reported_by: input.reportedBy,
        reason: input.reason,
        status: "open",
      });
      if (error) throw error;
      return;
    } catch (err) {
      console.error("Failed to save report to Supabase, falling back to the local dev store", err);
    }
  }

  const users = await getUserMapFor([input.reportedBy, input.reportedUserId]);
  devStore.update((s) => {
    s.reports.push({
      id: crypto.randomUUID(),
      shipId: input.shipId,
      reportedUser: input.reportedUserId ? users.get(input.reportedUserId) ?? null : null,
      reportedBy: users.get(input.reportedBy)!,
      reason: input.reason,
      status: "open",
      createdAt: new Date().toISOString(),
    });
  });
}
