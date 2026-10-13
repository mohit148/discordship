/**
 * Settings for the Discord authorization checker and the revoked-account
 * cleanup. All optional; defaults are deliberately cautious.
 */
function num(name: string, fallback: number, min = 0): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= min ? n : fallback;
}

export interface OAuthConfig {
  /** Re-check each person at most this often (hours). OAUTH_CHECK_INTERVAL_HOURS, default 24 (once a day). */
  checkIntervalHours: number;
  /** Confirmed-invalid checks in a row before a person counts as revoked. OAUTH_CONFIRMATIONS_REQUIRED, default 3. */
  confirmationsRequired: number;
  /** Two confirmed-invalid results closer together than this count as one. OAUTH_MIN_HOURS_BETWEEN_FAILURES, default 20. */
  minHoursBetweenFailures: number;
  /** Extra attempts for temporary errors within one check. OAUTH_CHECK_MAX_RETRIES, default 2. */
  maxRetries: number;
  retryBaseMs: number;
  timeoutMs: number;
  /** People checked per run (oldest check first). OAUTH_CHECK_BATCH_SIZE, default 100. */
  batchSize: number;
  /** Pause between people so Discord isn't hammered. OAUTH_CHECK_DELAY_MS, default 250. */
  delayMs: number;
  /**
   * OAUTH_CLEANUP_DRY_RUN — anything other than the exact text "false" means
   * dry-run: checks happen, nothing is deleted. Deletion is OFF by default.
   */
  dryRun: boolean;
  /** Hard cap on deletions in one run. OAUTH_CLEANUP_MAX_DELETIONS_PER_RUN, default 5. */
  maxDeletionsPerRun: number;
  /** If more than this share of a run's checks come back invalid, assume something global is wrong and delete nobody. Default 0.25. */
  maxInvalidFraction: number;
  /** Admins and the Owner are never auto-deleted unless OAUTH_CLEANUP_PROTECT_ADMINS=false. */
  protectAdmins: boolean;
}

export function getOAuthConfig(): OAuthConfig {
  return {
    checkIntervalHours: num("OAUTH_CHECK_INTERVAL_HOURS", 24, 0.01),
    confirmationsRequired: Math.max(1, Math.floor(num("OAUTH_CONFIRMATIONS_REQUIRED", 3, 1))),
    minHoursBetweenFailures: num("OAUTH_MIN_HOURS_BETWEEN_FAILURES", 20, 0),
    maxRetries: Math.floor(num("OAUTH_CHECK_MAX_RETRIES", 2, 0)),
    retryBaseMs: num("OAUTH_CHECK_RETRY_BASE_MS", 1000, 0),
    timeoutMs: num("OAUTH_CHECK_TIMEOUT_MS", 10000, 100),
    batchSize: Math.floor(num("OAUTH_CHECK_BATCH_SIZE", 100, 1)),
    delayMs: num("OAUTH_CHECK_DELAY_MS", 250, 0),
    dryRun: process.env.OAUTH_CLEANUP_DRY_RUN?.trim().toLowerCase() !== "false",
    maxDeletionsPerRun: Math.floor(num("OAUTH_CLEANUP_MAX_DELETIONS_PER_RUN", 5, 0)),
    maxInvalidFraction: num("OAUTH_CLEANUP_MAX_INVALID_FRACTION", 0.25, 0),
    protectAdmins: process.env.OAUTH_CLEANUP_PROTECT_ADMINS?.trim().toLowerCase() !== "false",
  };
}
