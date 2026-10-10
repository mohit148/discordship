import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/config";
import { devStore } from "@/lib/data/dev-store";
import { discordAvatarUrl, fetchDiscordUser } from "@/lib/discord";
import { checkRefreshToken } from "@/lib/oauth-check";
import { getOAuthConfig } from "@/lib/oauth-config";
import { decryptTokens, getTokenRow, listDueForSync, patchState, replaceTokensIfUnchanged, type TokenRow } from "@/lib/data/oauth-tokens";

/**
 * Keeps people's Discord name + picture current. There's no background job
 * runner in the app itself, so this runs opportunistically (from AppShell) and
 * at most once per SYNC_INTERVAL per person. It only ever touches the
 * Discord-owned fields (username, display_name, avatar_url) — never
 * avatar_override_url, so a custom picture is never overwritten, and resetting
 * a custom picture falls back to whatever was synced most recently.
 *
 * Syncing NEVER decides anything about authorization: if a token is rejected
 * here it just backs off. Only the dedicated checker (lib/oauth-cleanup.ts)
 * counts failures.
 */
export const SYNC_INTERVAL_MS = 60 * 60 * 1000;

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

/** Pulls the latest Discord profile for one person. Never throws. */
export async function syncDiscordProfile(userId: string): Promise<boolean> {
  try {
    const row = await getTokenRow(userId);
    if (!row || row.authStatus === "confirmed_revoked") return false;

    const accessToken = await accessTokenFor(row);
    if (!accessToken) {
      await patchState(userId, { lastSyncedAt: new Date().toISOString() }); // back off until the next interval
      return false;
    }

    const du = await fetchDiscordUser(accessToken);
    // The token must belong to the person we think it does.
    if (du.id !== row.discordId) throw new Error("Discord account mismatch");
    const avatarUrl = discordAvatarUrl(du);

    if (isSupabaseConfigured()) {
      const { error } = await createServiceRoleClient()
        .from("users")
        .update({ username: du.username, display_name: du.global_name, avatar_url: avatarUrl })
        .eq("discord_id", userId);
      if (error) throw error;
    } else {
      devStore.update((s) => {
        const u = s.users.find((x) => x.id === userId);
        if (u) {
          u.username = du.username;
          u.displayName = du.global_name;
          u.avatarUrl = avatarUrl; // customAvatarUrl deliberately untouched
        }
      });
    }
    await patchState(userId, { lastSyncedAt: new Date().toISOString() });
    return true;
  } catch (err) {
    console.error("Discord profile sync failed", err instanceof Error ? err.message : "unknown error");
    try {
      await patchState(userId, { lastSyncedAt: new Date().toISOString() });
    } catch {
      /* ignore */
    }
    return false;
  }
}

export async function maybeSyncDiscordProfile(userId: string) {
  try {
    const row = await getTokenRow(userId);
    if (!row) return;
    if (row.lastSyncedAt && Date.now() - row.lastSyncedAt < SYNC_INTERVAL_MS) return;
    await syncDiscordProfile(userId);
  } catch (err) {
    console.error("maybeSyncDiscordProfile failed", err instanceof Error ? err.message : "unknown error");
  }
}

/** Refreshes up to `limit` of the stalest profiles, so other people's pictures stay current even if they haven't visited lately. */
export async function syncStaleProfiles(limit = 2) {
  try {
    const due = await listDueForSync(Date.now() - SYNC_INTERVAL_MS, limit);
    await Promise.all(due.map((r) => syncDiscordProfile(r.userId)));
  } catch (err) {
    console.error("syncStaleProfiles failed", err instanceof Error ? err.message : "unknown error");
  }
}
