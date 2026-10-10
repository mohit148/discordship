import { DISCORD_API } from "@/lib/discord";
import type { OAuthConfig } from "@/lib/oauth-config";

/**
 * The result of asking Discord "is this person's authorization still good?".
 * The three-way split is the whole point: ONLY `invalid` means the person
 * revoked the app. Anything unclear is `transient` and never counts against them.
 */
export type CheckOutcome =
  | { kind: "valid"; rotated?: { access_token: string; refresh_token: string; expires_in: number } }
  | { kind: "invalid"; reason: "invalid_grant" }
  | { kind: "transient"; reason: string; retryAfterMs?: number }
  | { kind: "config_error"; reason: string };

async function timedFetch(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

function retryAfterMs(res: Response, body: any): number | undefined {
  const header = Number(res.headers.get("retry-after"));
  if (Number.isFinite(header) && header > 0) return header * 1000;
  const fromBody = Number(body?.retry_after);
  if (Number.isFinite(fromBody) && fromBody > 0) return fromBody * 1000;
  return undefined;
}

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

/** Step 1 — use the access token itself (no rotation): GET /oauth2/@me. */
export async function checkAccessToken(accessToken: string, cfg: Pick<OAuthConfig, "timeoutMs">): Promise<CheckOutcome | { kind: "unauthorized" }> {
  let res: Response;
  try {
    res = await timedFetch(`${DISCORD_API}/oauth2/@me`, { headers: { Authorization: `Bearer ${accessToken}` } }, cfg.timeoutMs);
  } catch (err: any) {
    return { kind: "transient", reason: err?.name === "AbortError" ? "timeout" : "network_error" };
  }
  if (res.status === 200) return { kind: "valid" };
  // An expired/unknown access token isn't proof of anything — the refresh token is the judge.
  if (res.status === 401) return { kind: "unauthorized" };
  if (res.status === 429) return { kind: "transient", reason: "rate_limited", retryAfterMs: retryAfterMs(res, await readJson(res)) };
  return { kind: "transient", reason: `http_${res.status}` };
}

/**
 * Step 2 — exchange the refresh token. Discord answers a revoked/invalid
 * refresh token with HTTP 400 {"error":"invalid_grant"}. That exact answer is
 * the only thing treated as "invalid". Everything else (5xx, 429, timeouts,
 * DNS failures, odd 400s, bad client credentials, unparseable bodies) is
 * transient or a configuration problem.
 */
export async function checkRefreshToken(refreshToken: string, cfg: Pick<OAuthConfig, "timeoutMs">): Promise<CheckOutcome> {
  let res: Response;
  try {
    res = await timedFetch(
      `${DISCORD_API}/oauth2/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.DISCORD_CLIENT_ID ?? "",
          client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      },
      cfg.timeoutMs
    );
  } catch (err: any) {
    return { kind: "transient", reason: err?.name === "AbortError" ? "timeout" : "network_error" };
  }

  const body = await readJson(res);

  if (res.status === 200) {
    if (body && typeof body.access_token === "string" && typeof body.refresh_token === "string" && Number(body.expires_in) > 0) {
      return { kind: "valid", rotated: { access_token: body.access_token, refresh_token: body.refresh_token, expires_in: Number(body.expires_in) } };
    }
    return { kind: "transient", reason: "malformed_success_response" };
  }
  if (res.status === 400 && body?.error === "invalid_grant") return { kind: "invalid", reason: "invalid_grant" };
  if (res.status === 401 && body?.error === "invalid_client") {
    return { kind: "config_error", reason: "invalid_client (check DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET)" };
  }
  if (res.status === 429) return { kind: "transient", reason: "rate_limited", retryAfterMs: retryAfterMs(res, body) };
  if (res.status >= 500) return { kind: "transient", reason: `http_${res.status}` };
  return { kind: "transient", reason: `unexpected_http_${res.status}${typeof body?.error === "string" ? `_${body.error.slice(0, 40)}` : ""}` };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_RETRY_AFTER_MS = 30_000;

/** Runs `attempt`, retrying transient outcomes with backoff (and honouring Retry-After up to a cap). */
export async function withRetries(
  attempt: () => Promise<CheckOutcome>,
  cfg: Pick<OAuthConfig, "maxRetries" | "retryBaseMs">
): Promise<CheckOutcome> {
  let outcome = await attempt();
  for (let i = 0; i < cfg.maxRetries && outcome.kind === "transient"; i++) {
    const wait = outcome.retryAfterMs ?? cfg.retryBaseMs * 2 ** i;
    if (wait > MAX_RETRY_AFTER_MS) break; // told to wait too long — try again on the next run instead
    await sleep(wait);
    outcome = await attempt();
  }
  return outcome;
}

// ---------------------------------------------------------------------------
// The state machine. Pure, so it's easy to test.
// ---------------------------------------------------------------------------

export interface CheckState {
  authStatus: "authorized" | "suspected_revoked" | "confirmed_revoked";
  consecutiveFailures: number;
  lastConfirmedFailureAt: string | null;
}

export interface StatePatch extends CheckState {
  lastCheckedAt?: string;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastFailureReason?: string | null;
}

/**
 * - valid      → authorized, counter reset.
 * - invalid    → counted at most once per `minHoursBetweenFailures`; 1st = suspected,
 *                `confirmationsRequired`-th = confirmed. Never deletes by itself.
 * - transient  → remembered as a failed check, but the confirmed-revocation counter
 *                and status are untouched, and the person stays "due" for the next run.
 * - config_error → no change at all.
 */
export function applyOutcome(
  prev: CheckState,
  outcome: CheckOutcome,
  now: Date,
  cfg: Pick<OAuthConfig, "confirmationsRequired" | "minHoursBetweenFailures">
): { patch: StatePatch; counted: boolean } {
  const iso = now.toISOString();
  switch (outcome.kind) {
    case "valid":
      return {
        counted: false,
        patch: { authStatus: "authorized", consecutiveFailures: 0, lastConfirmedFailureAt: null, lastCheckedAt: iso, lastSuccessAt: iso, lastFailureReason: null },
      };
    case "invalid": {
      const gapMs = cfg.minHoursBetweenFailures * 3_600_000;
      const tooSoon = prev.lastConfirmedFailureAt && now.getTime() - new Date(prev.lastConfirmedFailureAt).getTime() < gapMs;
      if (tooSoon) {
        return { counted: false, patch: { ...prev, lastCheckedAt: iso, lastFailureAt: iso, lastFailureReason: outcome.reason } };
      }
      const failures = prev.consecutiveFailures + 1;
      return {
        counted: true,
        patch: {
          authStatus: failures >= cfg.confirmationsRequired ? "confirmed_revoked" : "suspected_revoked",
          consecutiveFailures: failures,
          lastConfirmedFailureAt: iso,
          lastCheckedAt: iso,
          lastFailureAt: iso,
          lastFailureReason: outcome.reason,
        },
      };
    }
    case "transient":
      return { counted: false, patch: { ...prev, lastFailureAt: iso, lastFailureReason: `transient:${outcome.reason}` } };
    case "config_error":
      return { counted: false, patch: { ...prev } };
  }
}
