/**
 * Run the Discord authorization check / cleanup by hand:
 *   npm run oauth-cleanup:dry     # checks, reports, deletes nothing
 *   npm run oauth-cleanup         # honours OAUTH_CLEANUP_DRY_RUN (default: dry run)
 *   npm run oauth-cleanup -- --live   # same as OAUTH_CLEANUP_DRY_RUN=false for this run only
 */
import { runOAuthCleanup } from "../lib/oauth-cleanup";

async function main() {
  const args = process.argv.slice(2);
  const opts = args.includes("--dry-run") ? { dryRun: true } : args.includes("--live") ? { dryRun: false } : {};
  const report = await runOAuthCleanup(opts);
  console.log(JSON.stringify(report, null, 2));
  if (report.aborted?.startsWith("config_error")) process.exit(2);
}

main().catch((err) => {
  console.error("oauth-cleanup failed:", err instanceof Error ? err.message : "unknown error");
  process.exit(1);
});
