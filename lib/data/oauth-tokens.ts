import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "./config";
import { devStore } from "./dev-store";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { isDiscordId } from "@/lib/ids";
import type { StatePatch } from "@/lib/oauth-check";

/**
 * Server-only storage for each person's Discord OAuth tokens and authorization
 * status. Tokens are encrypted before they're stored (lib/crypto.ts), the
 * table has no public policies, and nothing here is ever returned to the
 * browser, written to a log, or put in an audit record. Callers get a
 * TokenRow with the ciphertext only; decryption is explicit (decryptTokens).
 */
export interface TokenRow {
  userId: string;
  discordId: string;
  accessTokenEnc: string;
  refreshTokenEnc: string;
  expiresAt: number;
  lastSyncedAt: number | null;
  authStatus: "authorized" | "suspected_revoked" | "confirmed_revoked";
  lastCheckedAt: number | null;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
  lastFailureReason: string | null;
  consecutiveFailures: number;
  lastConfirmedFailureAt: string | null;
}

const ms = (v: string | null | undefined) => (v ? new Date(v).getTime() : null);

function fromDb(r: any): TokenRow {
  return {
    userId: r.discord_id,
    discordId: r.discord_id,
    accessTokenEnc: r.access_token_enc,
    refreshTokenEnc: r.refresh_token_enc,
    expiresAt: new Date(r.expires_at).getTime(),
    lastSyncedAt: ms(r.last_synced_at),
    authStatus: r.auth_status,
    lastCheckedAt: ms(r.last_checked_at),
    lastSuccessAt: ms(r.last_success_at),
    lastFailureAt: ms(r.last_failure_at),
    lastFailureReason: r.last_failure_reason ?? null,
    consecutiveFailures: r.consecutive_failures ?? 0,
    lastConfirmedFailureAt: r.last_confirmed_failure_at ?? null,
  };
}

function fromDev(userId: string, r: import("./dev-store").StoredDiscordTokens): TokenRow {
  return {
    userId,
    discordId: r.discordId,
    accessTokenEnc: r.accessTokenEnc,
    refreshTokenEnc: r.refreshTokenEnc,
    expiresAt: new Date(r.expiresAt).getTime(),
    lastSyncedAt: ms(r.lastSyncedAt),
    authStatus: r.authStatus,
    lastCheckedAt: ms(r.lastCheckedAt),
    lastSuccessAt: ms(r.lastSuccessAt),
    lastFailureAt: ms(r.lastFailureAt),
    lastFailureReason: r.lastFailureReason,
    consecutiveFailures: r.consecutiveFailures,
    lastConfirmedFailureAt: r.lastConfirmedFailureAt,
  };
}

export function decryptTokens(row: TokenRow): { accessToken: string; refreshToken: string } {
  return {
    accessToken: decryptSecret(row.accessTokenEnc, row.userId),
    refreshToken: decryptSecret(row.refreshTokenEnc, row.userId),
  };
}

export interface NewTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/** Called at login: stores fresh tokens and resets all authorization-check state (they just proved authorization). */
export async function saveLoginTokens(userId: string, discordId: string, t: NewTokens): Promise<void> {
  const nowIso = new Date().toISOString();
  const expiresAt = new Date(Date.now() + t.expires_in * 1000).toISOString();
  const accessTokenEnc = encryptSecret(t.access_token, userId);
  const refreshTokenEnc = encryptSecret(t.refresh_token, userId);

  if (isSupabaseConfigured()) {
    const { error } = await createServiceRoleClient().from("user_discord_tokens").upsert({
      discord_id: discordId,
      access_token_enc: accessTokenEnc,
      refresh_token_enc: refreshTokenEnc,
      expires_at: expiresAt,
      last_synced_at: nowIso,
      auth_status: "authorized",
      last_checked_at: nowIso,
      last_success_at: nowIso,
      last_failure_at: null,
      last_failure_reason: null,
      consecutive_failures: 0,
      last_confirmed_failure_at: null,
      updated_at: nowIso,
    });
    if (error) throw new Error(`Failed to store Discord tokens (${error.code ?? "db_error"})`);
    return;
  }
  devStore.update((s) => {
    s.discordTokens[userId] = {
      discordId,
      accessTokenEnc,
      refreshTokenEnc,
      expiresAt,
      lastSyncedAt: nowIso,
      authStatus: "authorized",
      lastCheckedAt: nowIso,
      lastSuccessAt: nowIso,
      lastFailureAt: null,
      lastFailureReason: null,
      consecutiveFailures: 0,
      lastConfirmedFailureAt: null,
    };
  });
}

export async function getTokenRow(userId: string): Promise<TokenRow | null> {
  if (isSupabaseConfigured()) {
    if (!isDiscordId(userId)) return null;
    const { data, error } = await createServiceRoleClient().from("user_discord_tokens").select("*").eq("discord_id", userId).maybeSingle();
    if (error) throw new Error(`Failed to read Discord tokens (${error.code ?? "db_error"})`);
    return data ? fromDb(data) : null;
  }
  const r = devStore.get().discordTokens[userId];
  return r ? fromDev(userId, r) : null;
}

export async function getTokenRowByDiscordId(discordId: string): Promise<TokenRow | null> {
  if (isSupabaseConfigured()) {
    const { data, error } = await createServiceRoleClient().from("user_discord_tokens").select("*").eq("discord_id", discordId).maybeSingle();
    if (error) throw new Error(`Failed to read Discord tokens (${error.code ?? "db_error"})`);
    return data ? fromDb(data) : null;
  }
  const entry = Object.entries(devStore.get().discordTokens).find(([, r]) => r.discordId === discordId);
  return entry ? fromDev(entry[0], entry[1]) : null;
}

/** People whose authorization hasn't been checked since `cutoffMs` (never-checked first, then oldest). */
export async function listDueForCheck(cutoffMs: number, limit: number): Promise<TokenRow[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await createServiceRoleClient()
      .from("user_discord_tokens")
      .select("*")
      .or(`last_checked_at.is.null,last_checked_at.lt.${new Date(cutoffMs).toISOString()}`)
      .order("last_checked_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (error) throw new Error(`Failed to list due checks (${error.code ?? "db_error"})`);
    return (data ?? []).map(fromDb);
  }
  return Object.entries(devStore.get().discordTokens)
    .map(([id, r]) => fromDev(id, r))
    .filter((r) => r.lastCheckedAt === null || r.lastCheckedAt < cutoffMs)
    .sort((a, b) => (a.lastCheckedAt ?? 0) - (b.lastCheckedAt ?? 0))
    .slice(0, limit);
}

/** People due for an avatar/profile sync. */
export async function listDueForSync(cutoffMs: number, limit: number): Promise<TokenRow[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await createServiceRoleClient()
      .from("user_discord_tokens")
      .select("*")
      .neq("auth_status", "confirmed_revoked")
      .or(`last_synced_at.is.null,last_synced_at.lt.${new Date(cutoffMs).toISOString()}`)
      .order("last_synced_at", { ascending: true, nullsFirst: true })
      .limit(limit);
    if (error) throw new Error(`Failed to list due syncs (${error.code ?? "db_error"})`);
    return (data ?? []).map(fromDb);
  }
  return Object.entries(devStore.get().discordTokens)
    .map(([id, r]) => fromDev(id, r))
    .filter((r) => r.authStatus !== "confirmed_revoked" && (r.lastSyncedAt === null || r.lastSyncedAt < cutoffMs))
    .sort((a, b) => (a.lastSyncedAt ?? 0) - (b.lastSyncedAt ?? 0))
    .slice(0, limit);
}

/**
 * Stores a rotated token pair — but only if the stored refresh token is still
 * the one we used (compare-and-swap). Discord refresh tokens are single-use,
 * so two concurrent refreshes would otherwise overwrite each other.
 */
export async function replaceTokensIfUnchanged(userId: string, expectedRefreshTokenEnc: string, t: NewTokens): Promise<boolean> {
  const accessTokenEnc = encryptSecret(t.access_token, userId);
  const refreshTokenEnc = encryptSecret(t.refresh_token, userId);
  const expiresAt = new Date(Date.now() + t.expires_in * 1000).toISOString();
  if (isSupabaseConfigured()) {
    const { data, error } = await createServiceRoleClient()
      .from("user_discord_tokens")
      .update({ access_token_enc: accessTokenEnc, refresh_token_enc: refreshTokenEnc, expires_at: expiresAt, updated_at: new Date().toISOString() })
      .eq("discord_id", userId)
      .eq("refresh_token_enc", expectedRefreshTokenEnc)
      .select("discord_id");
    if (error) throw new Error(`Failed to save rotated tokens (${error.code ?? "db_error"})`);
    return (data ?? []).length === 1;
  }
  let swapped = false;
  devStore.update((s) => {
    const r = s.discordTokens[userId];
    if (r && r.refreshTokenEnc === expectedRefreshTokenEnc) {
      r.accessTokenEnc = accessTokenEnc;
      r.refreshTokenEnc = refreshTokenEnc;
      r.expiresAt = expiresAt;
      swapped = true;
    }
  });
  return swapped;
}

/** Writes check-state fields (never tokens). */
export async function patchState(userId: string, patch: Partial<StatePatch> & { lastSyncedAt?: string }): Promise<void> {
  const nowIso = new Date().toISOString();
  if (isSupabaseConfigured()) {
    const row: Record<string, unknown> = { updated_at: nowIso };
    if (patch.authStatus !== undefined) row.auth_status = patch.authStatus;
    if (patch.consecutiveFailures !== undefined) row.consecutive_failures = patch.consecutiveFailures;
    if (patch.lastConfirmedFailureAt !== undefined) row.last_confirmed_failure_at = patch.lastConfirmedFailureAt;
    if (patch.lastCheckedAt !== undefined) row.last_checked_at = patch.lastCheckedAt;
    if (patch.lastSuccessAt !== undefined) row.last_success_at = patch.lastSuccessAt;
    if (patch.lastFailureAt !== undefined) row.last_failure_at = patch.lastFailureAt;
    if (patch.lastFailureReason !== undefined) row.last_failure_reason = patch.lastFailureReason;
    if (patch.lastSyncedAt !== undefined) row.last_synced_at = patch.lastSyncedAt;
    const { error } = await createServiceRoleClient().from("user_discord_tokens").update(row).eq("discord_id", userId);
    if (error) throw new Error(`Failed to update authorization state (${error.code ?? "db_error"})`);
    return;
  }
  devStore.update((s) => {
    const r = s.discordTokens[userId];
    if (!r) return;
    if (patch.authStatus !== undefined) r.authStatus = patch.authStatus;
    if (patch.consecutiveFailures !== undefined) r.consecutiveFailures = patch.consecutiveFailures;
    if (patch.lastConfirmedFailureAt !== undefined) r.lastConfirmedFailureAt = patch.lastConfirmedFailureAt;
    if (patch.lastCheckedAt !== undefined) r.lastCheckedAt = patch.lastCheckedAt;
    if (patch.lastSuccessAt !== undefined) r.lastSuccessAt = patch.lastSuccessAt;
    if (patch.lastFailureAt !== undefined) r.lastFailureAt = patch.lastFailureAt;
    if (patch.lastFailureReason !== undefined) r.lastFailureReason = patch.lastFailureReason;
    if (patch.lastSyncedAt !== undefined) r.lastSyncedAt = patch.lastSyncedAt;
  });
}

/** People currently marked confirmed_revoked (candidates for cleanup). */
export async function listConfirmedRevoked(limit: number): Promise<TokenRow[]> {
  if (isSupabaseConfigured()) {
    const { data, error } = await createServiceRoleClient()
      .from("user_discord_tokens")
      .select("*")
      .eq("auth_status", "confirmed_revoked")
      .order("last_confirmed_failure_at", { ascending: true })
      .limit(limit);
    if (error) throw new Error(`Failed to list revoked accounts (${error.code ?? "db_error"})`);
    return (data ?? []).map(fromDb);
  }
  return Object.entries(devStore.get().discordTokens)
    .filter(([, r]) => r.authStatus === "confirmed_revoked")
    .map(([id, r]) => fromDev(id, r))
    .slice(0, limit);
}
