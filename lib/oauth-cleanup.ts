import { applyOutcome, checkAccessToken, checkRefreshToken, withRetries, type CheckOutcome } from "@/lib/oauth-check";
import { getOAuthConfig, type OAuthConfig } from "@/lib/oauth-config";
import {
  decryptTokens, getTokenRow, getTokenRowByDiscordId, listConfirmedRevoked, listDueForCheck, patchState, replaceTokensIfUnchanged, type TokenRow,
} from "@/lib/data/oauth-tokens";
import {
  deleteUserAccount, finishDeletionLog, findAccountByDiscordId, getAccountInfo, hasRecentDeletionLog, logDeletion,
} from "@/lib/data/accounts";
import { recordAudit } from "@/lib/data/audit";
import { isOwnerId } from "@/lib/roles";
import { isDiscordId } from "@/lib/ids";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const REASON = "oauth_revoked";

/** Never put a token, secret or raw error body into anything that gets logged. */
function safeMsg(err: unknown): string {
  return (err instanceof Error ? err.message : "unknown error").slice(0, 200);
}

// ------------------------------------------------------------------------------------
// One check of one person
// ------------------------------------------------------------------------------------

/**
 * Asks Discord whether this person's authorization is still good.
 *  1. If their access token is still fresh, GET /oauth2/@me with it — no token
 *     rotation, so nothing can be lost. 200 = authorized.
 *  2. Otherwise (or on a 401) exchange the refresh token. HTTP 400 invalid_grant
 *     is the one reliable "revoked" signal. A successful exchange hands back a
 *     new token pair, which is saved right away (compare-and-swap).
 * Temporary trouble is retried, then reported as `transient`.
 */
export async function checkTokenRow(row: TokenRow, cfg: OAuthConfig): Promise<CheckOutcome> {
  let tokens: { accessToken: string; refreshToken: string };
  try {
    tokens = decryptTokens(row);
  } catch {
    return { kind: "transient", reason: "decrypt_failed" }; // wrong/missing TOKEN_ENCRYPTION_KEY — says nothing about the user
  }

  if (row.expiresAt - Date.now() > 5 * 60_000) {
    // A 401 here isn't proof of anything (expired/unknown access token), so it
    // is mapped to a marker and the refresh token gets the final say.
    const viaAccess = await withRetries(async () => {
      const r = await checkAccessToken(tokens.accessToken, cfg);
      return r.kind === "unauthorized" ? ({ kind: "valid", rotated: undefined, unauthorized: true } as CheckOutcome & { unauthorized: true }) : r;
    }, cfg);
    if (viaAccess.kind === "valid" && !(viaAccess as any).unauthorized) return viaAccess;
    if (viaAccess.kind !== "valid") return viaAccess; // transient / config problem: stop here
    // fall through: the refresh token decides
  }

  const outcome = await withRetries(() => checkRefreshToken(tokens.refreshToken, cfg), cfg);

  if (outcome.kind === "valid" && outcome.rotated) {
    // Discord refresh tokens are single-use: persist the new pair immediately.
    let saved = false;
    for (let i = 0; i < 3 && !saved; i++) {
      try {
        await replaceTokensIfUnchanged(row.userId, row.refreshTokenEnc, outcome.rotated);
        saved = true; // true even if someone else rotated first — their pair is valid too
      } catch (err) {
        console.error("Saving rotated Discord tokens failed (attempt " + (i + 1) + "):", safeMsg(err));
        await sleep(200 * (i + 1));
      }
    }
    if (!saved) return { kind: "transient", reason: "token_save_failed" };
    return { kind: "valid" };
  }

  if (outcome.kind === "invalid") {
    // Did someone else rotate the token while we were asking? Then our (old) token was
    // rejected for that reason, not because of a revocation.
    try {
      const fresh = await getTokenRow(row.userId);
      if (fresh && fresh.refreshTokenEnc !== row.refreshTokenEnc) return { kind: "transient", reason: "token_rotated_concurrently" };
    } catch {
      return { kind: "transient", reason: "recheck_failed" };
    }
  }
  return outcome;
}

// ------------------------------------------------------------------------------------
// The scheduled run
// ------------------------------------------------------------------------------------

export interface RunReport {
  dryRun: boolean;
  startedAt: string;
  checked: number;
  authorized: number;
  transientFailures: number;
  newlyInvalid: number;
  suspectedRevoked: number;
  confirmedRevoked: number;
  /** Who would be / was removed (internal ids only). */
  wouldDelete: string[];
  deleted: string[];
  skipped: { userId: string; why: string }[];
  failed: { userId: string; error: string }[];
  aborted?: string;
  notes: string[];
}

type Logger = (message: string) => void;

export async function runOAuthCleanup(opts: { dryRun?: boolean; now?: Date; log?: Logger } = {}): Promise<RunReport> {
  const cfg = getOAuthConfig();
  const dryRun = opts.dryRun ?? cfg.dryRun;
  const log = opts.log ?? ((m) => console.log(`[oauth-cleanup] ${m}`));
  const now = opts.now ?? new Date();
  const report: RunReport = {
    dryRun, startedAt: now.toISOString(), checked: 0, authorized: 0, transientFailures: 0, newlyInvalid: 0,
    suspectedRevoked: 0, confirmedRevoked: 0, wouldDelete: [], deleted: [], skipped: [], failed: [], notes: [],
  };
  log(`starting (${dryRun ? "DRY RUN — nothing will be deleted" : "LIVE — confirmed-revoked accounts will be deleted"})`);

  // ---- Phase 1: check everyone who is due --------------------------------------------
  const due = await listDueForCheck(now.getTime() - cfg.checkIntervalHours * 3_600_000, cfg.batchSize);
  let consecutiveRateLimits = 0;

  for (const row of due) {
    const outcome = await checkTokenRow(row, cfg);

    if (outcome.kind === "config_error") {
      report.aborted = `config_error: ${outcome.reason}`;
      log(`stopping: ${report.aborted}`);
      break;
    }

    report.checked++;
    const { patch, counted } = applyOutcome(row, outcome, now, cfg);
    try {
      await patchState(row.userId, patch);
    } catch (err) {
      report.failed.push({ userId: row.userId, error: `state_update_failed: ${safeMsg(err)}` });
      continue;
    }

    if (outcome.kind === "valid") report.authorized++;
    else if (outcome.kind === "transient") report.transientFailures++;
    else if (outcome.kind === "invalid") {
      report.newlyInvalid++;
      log(`user ${row.userId}: authorization rejected by Discord (${patch.authStatus}, ${patch.consecutiveFailures} confirmed${counted ? "" : ", not counted again yet"})`);
    }
    if (patch.authStatus === "suspected_revoked") report.suspectedRevoked++;

    consecutiveRateLimits = outcome.kind === "transient" && outcome.reason === "rate_limited" ? consecutiveRateLimits + 1 : 0;
    if (consecutiveRateLimits >= 3) {
      report.aborted = "rate_limited: Discord asked us to slow down; will continue on the next run";
      log(`stopping: ${report.aborted}`);
      break;
    }
    if (cfg.delayMs > 0) await sleep(cfg.delayMs);
  }

  if (report.aborted?.startsWith("config_error")) return report;

  // ---- Phase 2: act on the confirmed ones ---------------------------------------------
  const candidates = await listConfirmedRevoked(cfg.maxDeletionsPerRun * 4 + 20);
  report.confirmedRevoked = candidates.length;

  // Safety valve: if lots of people suddenly look revoked, something global is wrong (bad credentials,
  // Discord incident…). Delete nobody and say so.
  const invalidLimit = Math.max(3, cfg.maxInvalidFraction * Math.max(report.checked, 1));
  const breaker = report.newlyInvalid > invalidLimit;
  if (breaker) {
    report.notes.push(`Safety stop: ${report.newlyInvalid} of ${report.checked} checks were rejected, which is more than expected. No deletions this run.`);
    log(report.notes[report.notes.length - 1]);
  }

  let deletions = 0;
  for (const row of candidates) {
    try {
      const account = await getAccountInfo(row.userId);
      if (!account) {
        report.skipped.push({ userId: row.userId, why: "already_deleted" });
        continue;
      }
      if (account.discordId !== row.discordId) {
        report.skipped.push({ userId: row.userId, why: "identity_mismatch" });
        log(`user ${row.userId}: skipped — Discord ID on the token record doesn't match the account`);
        continue;
      }
      if (cfg.protectAdmins && (account.role === "admin" || isOwnerId(account.discordId))) {
        report.skipped.push({ userId: row.userId, why: "protected_role" });
        continue;
      }
      if (breaker) {
        report.skipped.push({ userId: row.userId, why: "safety_stop" });
        continue;
      }
      if (deletions >= cfg.maxDeletionsPerRun) {
        report.skipped.push({ userId: row.userId, why: "per_run_limit" });
        continue;
      }

      if (dryRun) {
        report.wouldDelete.push(row.userId);
        log(`user ${row.userId}: WOULD be deleted (confirmed revoked ${row.consecutiveFailures}×) — dry run`);
        if (!(await hasRecentDeletionLog(row.userId, "dry_run", now.getTime() - cfg.checkIntervalHours * 3_600_000))) {
          await logDeletion({ userId: row.userId, discordId: row.discordId, reason: REASON, status: "dry_run", detail: `confirmed ${row.consecutiveFailures}×` });
        }
        continue;
      }

      // One last live check, right before the irreversible step.
      const fresh = (await getTokenRow(row.userId)) ?? row;
      const final = await checkTokenRow(fresh, cfg);
      if (final.kind !== "invalid") {
        const { patch } = applyOutcome(fresh, final, now, cfg);
        await patchState(row.userId, patch);
        report.skipped.push({ userId: row.userId, why: `final_check_${final.kind}` });
        log(`user ${row.userId}: not deleted — final check was ${final.kind}`);
        continue;
      }

      const logId = await logDeletion({ userId: row.userId, discordId: row.discordId, reason: REASON, status: "started", detail: `confirmed ${row.consecutiveFailures}×` });
      try {
        const result = await deleteUserAccount(row.userId);
        await finishDeletionLog(logId, "completed");
        await recordAudit({
          actor: null,
          action: `account deleted (${REASON})`,
          targetType: "user",
          targetId: row.userId,
          detail: `ships anonymized: ${result.shipsAnonymized}`,
        });
        deletions++;
        report.deleted.push(row.userId);
        log(`user ${row.userId}: deleted (${REASON}); ships anonymized: ${result.shipsAnonymized}`);
      } catch (err) {
        await finishDeletionLog(logId, "failed", safeMsg(err));
        report.failed.push({ userId: row.userId, error: safeMsg(err) });
        log(`user ${row.userId}: deletion FAILED — ${safeMsg(err)}`);
      }
    } catch (err) {
      report.failed.push({ userId: row.userId, error: safeMsg(err) });
    }
  }

  log(`done: checked ${report.checked}, authorized ${report.authorized}, temporary failures ${report.transientFailures}, rejected ${report.newlyInvalid}, ${dryRun ? `would delete ${report.wouldDelete.length}` : `deleted ${report.deleted.length}`}`);
  return report;
}

// ------------------------------------------------------------------------------------
// Admin: look at one person (never deletes, never counts a failure)
// ------------------------------------------------------------------------------------

export type AuthStatusLabel =
  | "authorized"
  | "temporary_failure"
  | "suspected_revoked"
  | "confirmed_revoked"
  | "already_deleted"
  | "no_authorization_on_file";

export interface AuthStatusReport {
  status: AuthStatusLabel;
  userId: string | null;
  checkedLive: boolean;
  detail?: string;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  consecutiveFailures?: number;
}

/** `identifier` is the person's Discord ID. */
export async function checkUserAuthorization(identifier: string): Promise<AuthStatusReport> {
  const cfg = { ...getOAuthConfig(), maxRetries: 1 };
  let userId: string | null = null;
  let account = null as Awaited<ReturnType<typeof getAccountInfo>>;

  if (!isDiscordId(identifier)) {
    return { status: "no_authorization_on_file", userId: null, checkedLive: false, detail: "Not a valid Discord ID." };
  }
  userId = identifier;
  account = await findAccountByDiscordId(identifier);
  if (!account) return { status: "already_deleted", userId, checkedLive: false };

  const row = (await getTokenRow(account.userId)) ?? (await getTokenRowByDiscordId(account.discordId));
  if (!row) return { status: "no_authorization_on_file", userId: account.userId, checkedLive: false, detail: "They haven't logged in since authorization checking was added." };

  const outcome = await checkTokenRow(row, cfg);
  const base = {
    userId: account.userId,
    checkedLive: true,
    lastSuccessAt: row.lastSuccessAt ? new Date(row.lastSuccessAt).toISOString() : null,
    lastFailureAt: row.lastFailureAt ? new Date(row.lastFailureAt).toISOString() : null,
    consecutiveFailures: row.consecutiveFailures,
  };

  if (row.authStatus === "confirmed_revoked" && outcome.kind === "invalid") return { ...base, status: "confirmed_revoked" };
  switch (outcome.kind) {
    case "valid":
      return { ...base, status: "authorized" };
    case "invalid":
      return { ...base, status: row.authStatus === "authorized" ? "suspected_revoked" : (row.authStatus as AuthStatusLabel), detail: "Discord rejected the authorization on this check (not counted toward cleanup)." };
    case "transient":
      return { ...base, status: "temporary_failure", detail: outcome.reason };
    case "config_error":
      return { ...base, status: "temporary_failure", detail: "Server configuration problem — see logs." };
  }
}
