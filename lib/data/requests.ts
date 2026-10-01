import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import { getUserMapFor } from "./users";
import { devStore } from "./dev-store";
import type { DiscordUser, ShipRequest } from "@/types";

// NOTE ON RLS: ship_requests has a Supabase RLS policy that reads
// `auth.jwt() ->> 'sub'`. That only matches when the request is made with a
// Supabase Auth session — but this app authenticates via its own signed
// session cookie (see lib/session.ts) and never signs anyone into Supabase
// Auth, so that policy can never match and the anon client always sees zero
// rows here. Authorization for who's allowed to see/act on a request is
// already enforced in application code (see app/api/requests/[id]/route.ts,
// which checks session.discordId against from_user_id/to_user_id), so reads
// here use the service-role client, the same way writes already do.

function mapRequestRow(r: any, users: Map<string, DiscordUser>): ShipRequest {
  return {
    id: r.id,
    fromUser: users.get(r.from_user_id)!,
    toUser: users.get(r.to_user_id)!,
    status: r.status,
    createdAt: r.created_at,
    respondedAt: r.responded_at,
  };
}

/** All pending ship requests, newest first — used by the admin Requests page. */
export async function getPendingRequests(): Promise<ShipRequest[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = createServiceRoleClient();
      const { data: rows, error } = await supabase
        .from("ship_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const users = await getUserMapFor((rows ?? []).flatMap((r: any) => [r.from_user_id, r.to_user_id]));
      return (rows ?? []).map((r: any) => mapRequestRow(r, users));
    } catch (err) {
      console.error("Failed to load requests from Supabase, falling back to the local dev store", err);
    }
  }
  return devStore
    .get()
    .requests.filter((r) => r.status === "pending")
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

/**
 * Pending requests for one person, split into what they've received and
 * what they've sent — powers the "Requests" inbox page and its nav badge.
 */
export async function getRequestsForUser(userId: string): Promise<{ incoming: ShipRequest[]; outgoing: ShipRequest[] }> {
  const pending = await getPendingRequests();
  return {
    incoming: pending.filter((r) => r.toUser.id === userId),
    outgoing: pending.filter((r) => r.fromUser.id === userId),
  };
}
