import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/config";
import { devStore } from "@/lib/data/dev-store";
import { DISCORD_API, discordAvatarUrl, fetchDiscordUser } from "@/lib/discord";
import { checkRefreshToken } from "@/lib/oauth-check";
import { getOAuthConfig } from "@/lib/oauth-config";
import { decryptTokens, getTokenRow, listDueForSync, patchState, replaceTokensIfUnchanged, type TokenRow } from "@/lib/data/oauth-tokens";

/**
 * Keeps people's Discord name + picture current. There's no background job
 * runner in the app itself, so this runs opportunistically (from AppShell) and
 * at most once per SYNC_INTERVAL (15 min) per person. It only ever touches the
 * Discord-owned fields (username, display_name, avatar_url) — never
 * avatar_override_url, so a custom picture is never overwritten, and resetting
 * a custom picture falls back to whatever was synced most recently.
 *
 * Syncing NEVER decides anything about authorization: if a token is rejected
 * here it just backs off. Only the dedicated checker (lib/oauth-cleanup.ts)
 * counts failures.
 */
export const SYNC_INTERVAL_MS = 15 * 60 * 1000;

const inflight = new Map<string, Promise<string | null>>();

/** A usable access token for this person, refreshing (and saving the rotated pair) when the old one has expired. */
function accessTokenFor(row: TokenRow): Promise<string | null> {
  const existing = inflight.get(row.userId);
  if (existing) return existing;
  const p = (async () => {
    try {
      const { accessToken, refreshToken } = decryptTokens(row);
      if (row.expiresAt - Date.now() > 60_000) return accessToken;

      const outcome = await checkRefreshToken(refreshToken, getOAuthConfig());
      if (outcome.kind !== "valid" || !outcome.rotated) return null;

      const saved = await replaceTokensIfUnchanged(row.userId, row.refreshTokenEnc, outcome.rotated);
      // If someone else rotated first, our freshly issued token is still good for this one call.
      void saved;
      return outcome.rotated.access_token;
    } catch (err) {
      console.error("Could not get a Discord access token for profile sync", err instanceof Error ? err.message : "unknown error");
      return null;
    } finally {
      setTimeout(() => inflight.delete(row.userId), 0);
    }
  })();
  inflight.set(row.userId, p);
  return p;
}

export type SyncResult = "changed" | "unchanged" | "failed";

/** Pulls the latest Discord profile for one person. Never throws. */
export async function syncDiscordProfile(userId: string): Promise<SyncResult> {
  try {
    const row = await getTokenRow(userId);
    if (!row || row.authStatus === "confirmed_revoked") return "failed";

    const accessToken = await accessTokenFor(row);
    if (!accessToken) {
      await patchState(userId, { lastSyncedAt: new Date().toISOString() }); // back off until the next interval
      return "failed";
    }

    const du = await fetchDiscordUser(accessToken);
    // The token must belong to the person we think it does.
    if (du.id !== row.discordId) throw new Error("Discord account mismatch");
    const avatarUrl = discordAvatarUrl(du);

    let result: SyncResult = "unchanged";
    if (isSupabaseConfigured()) {
      const db = createServiceRoleClient();
      const { data: before } = await db.from("users").select("username, display_name, avatar_url").eq("discord_id", userId).maybeSingle();
      if (before && (before.username !== du.username || (before.display_name ?? null) !== (du.global_name ?? null) || before.avatar_url !== avatarUrl)) {
        // Only the Discord-owned columns — never avatar_override_url (a custom picture).
        const { error } = await db
          .from("users")
          .update({ username: du.username, display_name: du.global_name, avatar_url: avatarUrl })
          .eq("discord_id", userId);
        if (error) throw error;
        result = "changed";
      }
    } else {
      devStore.update((s) => {
        const u = s.users.find((x) => x.id === userId);
        if (u && (u.username !== du.username || (u.displayName ?? null) !== (du.global_name ?? null) || u.avatarUrl !== avatarUrl)) {
          u.username = du.username;
          u.displayName = du.global_name;
          u.avatarUrl = avatarUrl; // customAvatarUrl deliberately untouched
          result = "changed";
        }
      });
    }
    await patchState(userId, { lastSyncedAt: new Date().toISOString() });
    return result;
  } catch (err) {
    console.error("Discord profile sync failed", err instanceof Error ? err.message : "unknown error");
    try {
      await patchState(userId, { lastSyncedAt: new Date().toISOString() });
    } catch {
      /* ignore */
    }
    return "failed";
  }
}

export async function maybeSyncDiscordProfile(userId: string): Promise<boolean> {
  try {
    const row = await getTokenRow(userId);
    if (!row) return false;
    if (row.lastSyncedAt && Date.now() - row.lastSyncedAt < SYNC_INTERVAL_MS) return false;
    return (await syncDiscordProfile(userId)) === "changed";
  } catch (err) {
    console.error("maybeSyncDiscordProfile failed", err instanceof Error ? err.message : "unknown error");
    return false;
  }
}

/** Refreshes up to `limit` of the stalest profiles, so other people's pictures stay current even if they haven't visited lately. */
export async function syncStaleProfiles(limit = 2): Promise<boolean> {
  try {
    const due = await listDueForSync(Date.now() - SYNC_INTERVAL_MS, limit);
    const results = await Promise.all(due.map((r) => syncDiscordProfile(r.userId)));
    return results.includes("changed");
  } catch (err) {
    console.error("syncStaleProfiles failed", err instanceof Error ? err.message : "unknown error");
    return false;
  }
}

/**
 * Optional safety net: with DISCORD_BOT_TOKEN set (a bot in the same Discord
 * application — it needs no permissions and no server), the daily job also
 * refreshes EVERYONE's name + picture straight from Discord, including people
 * who haven't logged in since the update and so have no stored token.
 * Never touches avatar_override_url. Stops quietly on rate limits.
 */
export async function syncAllProfilesWithBot(limit = 300): Promise<{ checked: number; updated: number; skipped: string | null }> {
  const bot = process.env.DISCORD_BOT_TOKEN;
  if (!bot) return { checked: 0, updated: 0, skipped: "DISCORD_BOT_TOKEN not set" };

  type Row = { id: string; username: string; displayName: string | null; avatarUrl: string | null };
  let rows: Row[];
  if (isSupabaseConfigured()) {
    const { data, error } = await createServiceRoleClient().from("users").select("discord_id, username, display_name, avatar_url").limit(limit);
    if (error) throw new Error(`Failed to list users (${error.code ?? "db_error"})`);
    rows = (data ?? []).map((r: any) => ({ id: r.discord_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url }));
  } else {
    rows = devStore.get().users.slice(0, limit).map((u) => ({ id: u.id, username: u.username, displayName: u.displayName ?? null, avatarUrl: u.avatarUrl ?? null }));
  }

  let checked = 0;
  let updated = 0;
  for (const row of rows) {
    if (!/^[0-9]{5,25}$/.test(row.id)) continue; // skip placeholders
    try {
      const res = await fetch(`${DISCORD_API}/users/${row.id}`, { headers: { Authorization: `Bot ${bot}` }, cache: "no-store" });
      if (res.status === 429) return { checked, updated, skipped: "rate limited — will continue next run" };
      if (res.status === 401) return { checked, updated, skipped: "bot token rejected" };
      if (!res.ok) continue; // 404 (deleted Discord account) etc. — leave as is
      const du = await res.json();
      if (du.id !== row.id) continue;
      checked++;
      const avatarUrl = discordAvatarUrl(du);
      if (du.username === row.username && (du.global_name ?? null) === row.displayName && avatarUrl === row.avatarUrl) continue;
      if (isSupabaseConfigured()) {
        const { error } = await createServiceRoleClient().from("users").update({ username: du.username, display_name: du.global_name ?? null, avatar_url: avatarUrl }).eq("discord_id", row.id);
        if (error) continue;
      } else {
        devStore.update((s) => {
          const u = s.users.find((x) => x.id === row.id);
          if (u) { u.username = du.username; u.displayName = du.global_name ?? null; u.avatarUrl = avatarUrl; }
        });
      }
      updated++;
    } catch {
      /* one person failing never stops the rest */
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  return { checked, updated, skipped: null };
}
