import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import { devStore, type StoredAccountDeletion } from "./dev-store";
import { manualPerson } from "./ships";
import { isDiscordId } from "@/lib/ids";

export interface AccountInfo {
  userId: string;
  discordId: string;
  role: "visitor" | "ship_creator" | "admin";
}

/** The person behind an internal user id, or null if they don't exist (any more). */
export async function getAccountInfo(userId: string): Promise<AccountInfo | null> {
  if (isSupabaseConfigured()) {
    if (!isDiscordId(userId)) return null;
    const { data, error } = await createServiceRoleClient().from("users").select("discord_id, role").eq("discord_id", userId).maybeSingle();
    if (error) throw new Error(`Failed to look up account (${error.code ?? "db_error"})`);
    return data ? { userId: data.discord_id, discordId: data.discord_id, role: data.role ?? "visitor" } : null;
  }
  const u = devStore.get().users.find((x) => x.id === userId);
  return u ? { userId: u.id, discordId: u.id, role: (u.role as AccountInfo["role"]) ?? "visitor" } : null;
}

export async function findAccountByDiscordId(discordId: string): Promise<AccountInfo | null> {
  if (isSupabaseConfigured()) {
    return getAccountInfo(discordId);
  }
  return getAccountInfo(discordId);
}

// ---- deletion log --------------------------------------------------------------------

export type DeletionStatus = StoredAccountDeletion["status"];

export async function logDeletion(entry: {
  userId: string;
  discordId: string | null;
  reason: string;
  status: DeletionStatus;
  detail?: string | null;
}): Promise<string | null> {
  const row = { discord_id: entry.discordId ?? entry.userId, reason: entry.reason, status: entry.status, detail: entry.detail ?? null };
  if (isSupabaseConfigured()) {
    const { data, error } = await createServiceRoleClient().from("account_deletions").insert(row).select("id").single();
    if (error) throw new Error(`Failed to write deletion log (${error.code ?? "db_error"})`);
    return data.id as string;
  }
  const id = crypto.randomUUID();
  devStore.update((s) => {
    s.accountDeletions.push({ id, userId: entry.userId, discordId: entry.discordId, reason: entry.reason, status: entry.status, detail: entry.detail ?? null, error: null, createdAt: new Date().toISOString(), completedAt: null });
  });
  return id;
}

export async function finishDeletionLog(id: string | null, status: DeletionStatus, error?: string | null): Promise<void> {
  if (!id) return;
  const completedAt = new Date().toISOString();
  if (isSupabaseConfigured()) {
    await createServiceRoleClient().from("account_deletions").update({ status, error: error ?? null, completed_at: completedAt }).eq("id", id);
    return;
  }
  devStore.update((s) => {
    const r = s.accountDeletions.find((x) => x.id === id);
    if (r) {
      r.status = status;
      r.error = error ?? null;
      r.completedAt = completedAt;
    }
  });
}

/** Has a dry-run entry for this person been written since `sinceMs`? (keeps the log from filling up with repeats) */
export async function hasRecentDeletionLog(userId: string, status: DeletionStatus, sinceMs: number): Promise<boolean> {
  const since = new Date(sinceMs).toISOString();
  if (isSupabaseConfigured()) {
    const { data } = await createServiceRoleClient().from("account_deletions").select("id").eq("discord_id", userId).eq("status", status).gte("created_at", since).limit(1);
    return (data ?? []).length > 0;
  }
  return devStore.get().accountDeletions.some((r) => r.userId === userId && r.status === status && r.createdAt >= since);
}

// ---- the deletion itself -------------------------------------------------------------

export interface DeleteResult {
  profileStatus: "deleted" | "already_deleted";
  shipsAnonymized: number;
}

/**
 * Removes exactly one person, identified by their Discord ID (the users
 * primary key) — never by name, avatar or anything else. Idempotent. Other
 * people are never deleted: a ship the person shared keeps the other
 * participant and just loses this person's slot. In Supabase this is a single
 * transaction inside delete_user_account() (see migration 0007).
 */
export async function deleteUserAccount(discordId: string): Promise<DeleteResult> {
  const userId = discordId;
  if (isSupabaseConfigured()) {
    if (!isDiscordId(discordId)) throw new Error("Refusing to delete: not a valid Discord ID.");
    const { data, error } = await createServiceRoleClient().rpc("delete_user_account", { p_discord_id: discordId });
    if (error) throw new Error(`Account cleanup failed (${error.code ?? "db_error"})`);
    const status = (data as any)?.status;
    if (status !== "deleted" && status !== "already_deleted") throw new Error(`Unexpected cleanup result: ${String(status)}`);
    return { profileStatus: status, shipsAnonymized: Number((data as any)?.ships_anonymized ?? 0) };
  }

  // Local dev store — same behavior as the SQL function.
  let found = false;
  let shipsAnonymized = 0;
  devStore.update((s) => {
    const user = s.users.find((u) => u.id === userId);
    if (!user) return;
    found = true;
    const now = new Date().toISOString();
    for (const ship of s.ships) {
      for (const side of ["a", "b"] as const) {
        const key = side === "a" ? "userA" : "userB";
        if (ship[key].id !== userId) continue;
        shipsAnonymized++;
        ship[key] = manualPerson(ship.id, side, "Former member");
        ship.isTwoAuth = false;
        if (ship.status === "confirmed" || ship.status === "pending") {
          ship.status = "ended";
          ship.endedAt = ship.endedAt ?? now;
        }
        ship.customTextPending = null;
        ship.customTextProposedBy = null;
        ship.backgroundPending = null;
        ship.backgroundProposedBy = null;
      }
      if (ship.updatedBy?.id === userId) ship.updatedBy = null;
      if (ship.createdBy?.id === userId) ship.createdBy = null;
    }
    s.requests = s.requests.filter((r) => r.fromUser.id !== userId && r.toUser.id !== userId);
    s.reports = s.reports
      .filter((r) => !(r.reportedUser?.id === userId && !r.shipId))
      .map((r) => ({
        ...r,
        reportedUser: r.reportedUser?.id === userId ? null : r.reportedUser,
        reportedBy: r.reportedBy.id === userId ? { ...r.reportedBy, id: "deleted", username: "Former member", displayName: "Former member", avatarUrl: null } : r.reportedBy,
      }));
    s.auditLog = s.auditLog.map((a) => (a.actor?.id === userId ? { ...a, actor: null } : a));
    delete s.avatars[userId];
    delete s.discordTokens[userId];
    delete s.claimCodes[`__user:${userId}`];
    s.users = s.users.filter((u) => u.id !== userId);
  });
  return { profileStatus: found ? "deleted" : "already_deleted", shipsAnonymized };
}
