import { AdminShell } from "@/components/AdminShell";
import { getSession } from "@/lib/session";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/config";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import { PUBLIC_SHIP_COLUMNS } from "@/lib/data/ships";

export const dynamic = "force-dynamic";

type Check = { name: string; ok: boolean; detail: string; fix?: string };

async function run(name: string, fn: () => Promise<string>, fix?: string): Promise<Check> {
  try {
    return { name, ok: true, detail: await fn() };
  } catch (err) {
    const e = err as { message?: string; code?: string; hint?: string };
    return { name, ok: false, detail: `${e.message ?? "failed"}${e.code ? ` (${e.code})` : ""}`, fix };
  }
}

function env(name: string, ok: boolean, detail: string, fix: string): Check {
  return { name, ok, detail, fix };
}

/**
 * Plain-English health check of everything the site depends on. Every line is
 * either green or tells you exactly what is wrong and what to do. Nothing secret
 * is ever printed (only whether a value is present / valid).
 */
export default async function DiagnosticsPage() {
  const session = getSession()!;
  const configured = isSupabaseConfigured();
  const checks: Check[] = [];

  checks.push(env("Supabase connection settings", configured, configured ? "URL and anon key are set." : "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are missing — the site is showing sample data.", "Set them in Vercel → Settings → Environment Variables, then redeploy."));
  checks.push(env("Service role key", !!process.env.SUPABASE_SERVICE_ROLE_KEY, process.env.SUPABASE_SERVICE_ROLE_KEY ? "Set." : "SUPABASE_SERVICE_ROLE_KEY is missing.", "Add SUPABASE_SERVICE_ROLE_KEY in Vercel and redeploy."));

  let keyOk = false;
  let keyDetail = "";
  try {
    keyOk = decryptSecret(encryptSecret("ping", "diag"), "diag") === "ping";
    keyDetail = "Set and valid.";
  } catch (e) {
    keyDetail = e instanceof Error ? e.message : "invalid";
  }
  checks.push(env("TOKEN_ENCRYPTION_KEY", keyOk, keyDetail, "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\" and add it as TOKEN_ENCRYPTION_KEY in Vercel, then redeploy and log in again. Without it, Discord logins can't be stored, so every user shows \"Hasn't logged in since the update\"."));

  const cron = process.env.CRON_SECRET ?? "";
  checks.push(env("CRON_SECRET (daily automatic check)", cron.length >= 16, cron.length >= 16 ? "Set — the daily check can run." : "Missing or shorter than 16 characters — the daily check will NOT run.", "Add CRON_SECRET (16+ random characters) in Vercel and redeploy. Vercel then calls the daily job by itself."));
  checks.push({
    name: "Deleting revoked accounts",
    ok: true,
    detail: process.env.OAUTH_CLEANUP_DRY_RUN === "false" ? "LIVE — accounts confirmed revoked are deleted." : "Dry run — the daily check only records what it WOULD delete.",
  });
  checks.push({ name: "DISCORD_BOT_TOKEN (optional)", ok: true, detail: process.env.DISCORD_BOT_TOKEN ? "Set — everyone's picture can refresh without logging in." : "Not set — pictures refresh only for people who logged in since the update." });

  if (configured) {
    const anon = createClient();
    const svc = createServiceRoleClient();
    checks.push(
      await run("Public can read ships", async () => {
        const { data, error } = await anon.from("ships").select(PUBLIC_SHIP_COLUMNS).limit(5);
        if (error) throw error;
        return `OK (${data?.length ?? 0} sample rows).`;
      }, "Run 3_fix_read_access.sql in the Supabase SQL editor."),
      await run("Public can read users", async () => {
        const { data, error } = await anon.from("users").select("discord_id, username, display_name, avatar_url, avatar_override_url").limit(5);
        if (error) throw error;
        return `OK (${data?.length ?? 0} sample rows).`;
      }, "Run 3_fix_read_access.sql in the Supabase SQL editor."),
      await run("Public can read backgrounds, rules, navigation", async () => {
        for (const t of ["backgrounds", "rule_sections", "nav_items"]) {
          const { error } = await anon.from(t).select("*").limit(1);
          if (error) throw new Error(`${t}: ${error.message}`);
        }
        return "OK.";
      }, "Run 3_fix_read_access.sql in the Supabase SQL editor."),
      await run("Server can read the ships table", async () => {
        const { count, error } = await svc.from("ships").select("id", { count: "exact", head: true });
        if (error) throw error;
        return `${count ?? 0} ships in the database.`;
      }),
      await run("Stored Discord logins", async () => {
        const [{ count: tokens, error }, { count: users }] = await Promise.all([
          svc.from("user_discord_tokens").select("discord_id", { count: "exact", head: true }),
          svc.from("users").select("discord_id", { count: "exact", head: true }),
        ]);
        if (error) throw error;
        return `${tokens ?? 0} of ${users ?? 0} users have a stored login. Everyone else must log in once more.`;
      }, "Run 2_migration_0007_oauth_revoke_checks.sql in the Supabase SQL editor."),
      await run("Your own Discord login is stored", async () => {
        const { data, error } = await svc.from("user_discord_tokens").select("auth_status, last_checked_at").eq("discord_id", session.discordId).maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("No stored login for you. Log out and log in again, then reload this page.");
        return `Yes — status: ${data.auth_status}.`;
      }, "If it is still missing after logging in again, the TOKEN_ENCRYPTION_KEY line above is the usual cause; otherwise check the Vercel function logs for \"Could not store Discord tokens\"."),
    );
  }

  const bad = checks.filter((c) => !c.ok).length;

  return (
    <AdminShell currentUser={session}>
      <h1 className="text-xl font-semibold text-ink">Diagnostics</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {bad === 0 ? "Everything checks out." : `${bad} thing${bad === 1 ? "" : "s"} need${bad === 1 ? "s" : ""} attention.`} Nothing secret is shown here.
      </p>
      <ul className="mt-5 flex flex-col gap-2">
        {checks.map((c) => (
          <li key={c.name} className="rounded-2xl border border-border bg-white p-4 shadow-softer">
            <div className="flex items-start gap-3">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${c.ok ? "bg-sage-500" : "bg-blossom-500"}`} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{c.name}</p>
                <p className="mt-0.5 break-words text-sm text-ink-soft">{c.detail}</p>
                {!c.ok && c.fix && <p className="mt-1.5 break-words text-xs text-blossom-600">Fix: {c.fix}</p>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
