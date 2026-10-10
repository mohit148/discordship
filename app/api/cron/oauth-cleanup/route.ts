import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { runOAuthCleanup } from "@/lib/oauth-cleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false; // disabled until a real secret is set
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The scheduled authorization check. Called by the host's cron (vercel.json,
 * GitHub Actions, system cron…) with `Authorization: Bearer $CRON_SECRET`.
 * Runs entirely on the server. `?dry_run=true` can force a dry run, but there
 * is no way to force a live run — deleting is only enabled by
 * OAUTH_CLEANUP_DRY_RUN=false in the environment.
 */
async function handle(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Not configured." }, { status: 503 });
  }
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const forceDry = req.nextUrl.searchParams.get("dry_run") === "true";
  try {
    const report = await runOAuthCleanup(forceDry ? { dryRun: true } : {});
    return NextResponse.json(report);
  } catch (err) {
    console.error("OAuth cleanup run failed:", err instanceof Error ? err.message : "unknown error");
    return NextResponse.json({ error: "Run failed." }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
