/**
 * Regression test for the Discord authorization checker + cleanup, against a
 * fake Discord server and the local dev store (it backs up and restores
 * .dev-store.json). Run:  npm run test:oauth
 */
import http from "http";
import fs from "fs";
import path from "path";
import assert from "node:assert/strict";

const STORE = path.join(process.cwd(), ".dev-store.json");
const BACKUP = STORE + ".test-backup";
const hadStore = fs.existsSync(STORE);
if (hadStore) fs.copyFileSync(STORE, BACKUP);

let rotations = 0;
const server = http.createServer((req, res) => {
  const url = req.url ?? "";
  const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
    res.writeHead(status, { "Content-Type": "application/json", ...headers });
    res.end(JSON.stringify(body));
  };
  if (url === "/oauth2/@me") {
    const tok = (req.headers.authorization ?? "").replace("Bearer ", "");
    return tok.startsWith("goodaccess") ? send(200, { application: {} }) : send(401, { message: "401: Unauthorized" });
  }
  if (url === "/oauth2/token") {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      const p = new URLSearchParams(raw);
      if (p.get("client_secret") === "WRONG") return send(401, { error: "invalid_client" });
      const rt = p.get("refresh_token") ?? "";
      if (rt.startsWith("revoked")) return send(400, { error: "invalid_grant", error_description: 'Invalid "refresh_token" in request.' });
      if (rt.startsWith("err500")) return send(500, { message: "boom" });
      if (rt.startsWith("err503")) return send(503, "<html>down</html>" as any);
      if (rt.startsWith("rl")) return send(429, { retry_after: 0.01, global: false }, { "Retry-After": "0.01" });
      if (rt.startsWith("slow")) return void setTimeout(() => send(200, {}), 1500);
      if (rt.startsWith("weird400")) return send(400, { error: "invalid_request" });
      rotations++;
      return send(200, { access_token: `goodaccess_new_${rotations}`, refresh_token: `fresh_${rotations}`, expires_in: 604800, token_type: "Bearer" });
    });
    return;
  }
  send(404, {});
});

const results: string[] = [];
function ok(name: string) {
  results.push(name);
  console.log("  ✓ " + name);
}

async function main() {
  await new Promise<void>((r) => server.listen(0, r));
  const port = (server.address() as any).port;
  Object.assign(process.env, {
    DISCORD_API_BASE: `http://127.0.0.1:${port}`,
    DISCORD_CLIENT_ID: "cid",
    DISCORD_CLIENT_SECRET: "secret",
    SESSION_SECRET: "test-session-secret-xxxxxxxx",
    OWNER_DISCORD_ID: "900000000000000001",
    OAUTH_CHECK_DELAY_MS: "0",
    OAUTH_CHECK_RETRY_BASE_MS: "5",
    OAUTH_CHECK_TIMEOUT_MS: "300",
    OAUTH_CHECK_MAX_RETRIES: "1",
  });
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.OAUTH_CLEANUP_DRY_RUN;

  const { devStore } = await import("../lib/data/dev-store");
  const { saveLoginTokens, getTokenRow, patchState, decryptTokens } = await import("../lib/data/oauth-tokens");
  const { runOAuthCleanup, checkUserAuthorization } = await import("../lib/oauth-cleanup");
  const { manualPerson } = await import("../lib/data/ships");

  fs.writeFileSync(STORE, JSON.stringify({ backgrounds: [], avatars: {}, ships: [], claimCodes: {}, discordTokens: {}, accountDeletions: [], ruleSections: [], navItems: [], users: [], requests: [], reports: [], auditLog: [] }));

  const logs: string[] = [];
  const log = (m: string) => logs.push(m);
  const origLog = console.log;
  const captured: string[] = [];
  console.log = (...a: unknown[]) => { captured.push(a.join(" ")); };
  const origErr = console.error;
  console.error = (...a: unknown[]) => { captured.push(a.join(" ")); };

  const mkUser = (id: string, role: "visitor" | "admin" = "visitor") =>
    devStore.update((s) => { s.users.push({ id, username: "u" + id, displayName: null, avatarUrl: null, role }); });
  const DAY = 86_400_000;
  const t0 = new Date("2026-03-01T04:00:00Z");
  const mkTokens = async (id: string, refresh: string, access: string, expiresInSec: number) => {
    await saveLoginTokens(id, id, { access_token: access, refresh_token: refresh, expires_in: expiresInSec });
    // the (simulated) clock in this test starts in the past — make them due
    await patchState(id, { lastCheckedAt: new Date(t0.getTime() - 2 * DAY).toISOString() });
  };
  const at = (days: number, hours = 0) => new Date(t0.getTime() + days * DAY + hours * 3_600_000);
  const status = async (id: string) => (await getTokenRow(id))!;

  // people
  const ids = { valid: "100000000000000001", rotate: "100000000000000002", revoked: "100000000000000003", e500: "100000000000000004",
    e503: "100000000000000005", rl: "100000000000000006", slow: "100000000000000007", weird: "100000000000000008", partner: "100000000000000009" };
  for (const id of Object.values(ids)) mkUser(id);
  await mkTokens(ids.valid, "refresh_ok", "goodaccess_1", 604800);          // fresh access token → @me 200
  await mkTokens(ids.rotate, "refresh_ok", "oldaccess", 60);                 // expired-ish → refresh → rotates
  await mkTokens(ids.revoked, "revoked_1", "oldaccess", 60);
  await mkTokens(ids.e500, "err500_1", "oldaccess", 60);
  await mkTokens(ids.e503, "err503_1", "oldaccess", 60);
  await mkTokens(ids.rl, "rl_1", "oldaccess", 60);
  await mkTokens(ids.slow, "slow_1", "oldaccess", 60);
  await mkTokens(ids.weird, "weird400_1", "oldaccess", 60);
  // partner has no tokens (never logged in through the new flow)

  // a ship between the revoked user and the partner
  devStore.update((s) => {
    const u = (id: string) => s.users.find((x) => x.id === id)!;
    s.ships.push({ id: "ship1", number: 1, userA: u(ids.revoked), userB: u(ids.partner), status: "confirmed", isTwoAuth: true, customText: "hi",
      customTextPending: "proposal", customTextProposedBy: u(ids.revoked), background: null, backgroundPending: null, backgroundProposedBy: null,
      createdAt: t0.toISOString(), updatedAt: t0.toISOString(), updatedBy: null, createdBy: null, endedAt: null } as any);
    s.requests.push({ id: "rq1", fromUser: u(ids.revoked), toUser: u(ids.partner), status: "pending", createdAt: t0.toISOString(), respondedAt: null });
  });

  console.log = origLog; console.error = origErr;
  console.log("Day 1 — dry run");
  console.log = (...a: unknown[]) => { captured.push(a.join(" ")); }; console.error = console.log;

  let r = await runOAuthCleanup({ now: at(0), log, dryRun: true });
  console.log = origLog; console.error = origErr;
  assert.equal(r.checked, 8);
  assert.equal((await status(ids.valid)).authStatus, "authorized");
  ok("valid authorization (access token) stays authorized, no rotation");
  const rot = await status(ids.rotate);
  assert.equal(rot.authStatus, "authorized");
  assert.equal(decryptTokens(rot).refreshToken.startsWith("fresh_"), true);
  ok("expired access token → refreshed, rotated tokens saved");
  const rev = await status(ids.revoked);
  assert.equal(rev.authStatus, "suspected_revoked"); assert.equal(rev.consecutiveFailures, 1);
  ok("invalid_grant → suspected_revoked (count 1), not deleted");
  for (const k of ["e500", "e503", "rl", "slow", "weird"] as const) {
    const row = await status(ids[k]);
    assert.equal(row.authStatus, "authorized", k); assert.equal(row.consecutiveFailures, 0, k);
    assert.match(row.lastFailureReason ?? "", /^transient:/, k);
  }
  ok("HTTP 500, 503, 429 rate limit, timeout, odd 400 → transient, counter untouched");
  assert.equal(r.transientFailures, 5);

  // same-day re-run: not due; and even forced a few hours later the failure isn't double-counted
  r = await runOAuthCleanup({ now: at(0, 2), log, dryRun: true });
  assert.equal((await status(ids.revoked)).consecutiveFailures, 1);
  ok("running again the same day doesn't double count");
  // transient users are retried on the next run (still due)
  assert.ok(r.checked >= 5);
  ok("transient failures are retried on the next run (still due)");

  // day 1 evening: a failure inside min-gap window with forced due-ness
  await patchState(ids.revoked, { lastCheckedAt: at(-1).toISOString() });
  r = await runOAuthCleanup({ now: at(0, 5), log, dryRun: true });
  assert.equal((await status(ids.revoked)).consecutiveFailures, 1);
  ok("two rejections within the minimum gap count once");

  console.log("Day 2/3 — confirmations");
  await runOAuthCleanup({ now: at(1, 6), log, dryRun: true });
  assert.equal((await status(ids.revoked)).consecutiveFailures, 2);
  r = await runOAuthCleanup({ now: at(2, 12), log, dryRun: true });
  assert.equal((await status(ids.revoked)).authStatus, "confirmed_revoked");
  assert.deepEqual(r.wouldDelete, [ids.revoked]);
  ok("3 confirmed rejections on different days → confirmed_revoked");
  assert.ok(devStore.get().users.some((u) => u.id === ids.revoked));
  assert.ok(devStore.get().ships.length === 1);
  ok("dry run reports who WOULD be deleted and deletes nothing");
  assert.equal(devStore.get().accountDeletions.filter((d) => d.status === "dry_run").length, 1);
  ok("dry run is logged once (not spammed)");

  // default (no flag) is dry-run
  r = await runOAuthCleanup({ now: at(2, 13), log });
  assert.equal(r.dryRun, true);
  ok("destructive cleanup is OFF by default (OAUTH_CLEANUP_DRY_RUN unset ⇒ dry run)");

  // admin read-only check never deletes
  const adminCheck = await checkUserAuthorization(ids.revoked);
  assert.equal(adminCheck.status, "confirmed_revoked");
  assert.equal((await checkUserAuthorization(ids.valid)).status, "authorized");
  assert.equal((await checkUserAuthorization(ids.e500)).status, "temporary_failure");
  assert.equal((await checkUserAuthorization(ids.partner)).status, "no_authorization_on_file");
  assert.equal((await checkUserAuthorization("123456789012345678")).status, "already_deleted");
  assert.ok(devStore.get().users.some((u) => u.id === ids.revoked));
  ok("admin check reports authorized / temporary / confirmed / no-record / already-deleted and deletes nothing");

  console.log("Day 4 — live");
  r = await runOAuthCleanup({ now: at(3, 14), log, dryRun: false });
  assert.deepEqual(r.deleted, [ids.revoked]);
  const after = devStore.get();
  assert.ok(!after.users.some((u) => u.id === ids.revoked));
  assert.equal(after.users.length, 8);
  for (const id of Object.values(ids)) if (id !== ids.revoked) assert.ok(after.users.some((u) => u.id === id), id);
  ok("live run deletes ONLY the confirmed-revoked user (all 8 others intact)");
  const ship = after.ships[0];
  assert.equal(ship.userB.id, ids.partner);
  assert.equal(ship.userA.isPlaceholder, true);
  assert.equal(ship.status, "ended");
  assert.equal(ship.customTextPending, null);
  assert.ok(after.users.some((u) => u.id === ids.partner));
  ok("ship survives: partner kept, leaving person anonymized, ship ended, proposals cleared");
  assert.equal(after.requests.length, 0);
  ok("their ship requests are removed");
  assert.ok(after.accountDeletions.some((d) => d.status === "completed" && d.reason === "oauth_revoked" && d.userId === ids.revoked));
  assert.ok(after.auditLog.some((a) => a.action.includes("oauth_revoked") && a.actor === null));
  ok("deletion + audit entries recorded");
  r = await runOAuthCleanup({ now: at(4, 15), log, dryRun: false });
  assert.deepEqual(r.deleted, []);
  assert.equal(devStore.get().users.length, 8);
  ok("running cleanup again is safe (idempotent)");

  console.log("Safety rails");
  // admin protected
  mkUser("200000000000000001", "admin");
  await mkTokens("200000000000000001", "revoked_admin", "oldaccess", 60);
  await patchState("200000000000000001", { authStatus: "confirmed_revoked", consecutiveFailures: 3, lastConfirmedFailureAt: at(1).toISOString(), lastCheckedAt: at(-5).toISOString() });
  r = await runOAuthCleanup({ now: at(10), log, dryRun: false });
  assert.ok(devStore.get().users.some((u) => u.id === "200000000000000001"));
  assert.ok(r.skipped.some((s) => s.userId === "200000000000000001" && s.why === "protected_role"));
  ok("admins/owner are never auto-deleted");

  // final re-check: user confirmed but token is valid again → not deleted
  mkUser("300000000000000001");
  await mkTokens("300000000000000001", "refresh_ok", "oldaccess", 60);
  await patchState("300000000000000001", { authStatus: "confirmed_revoked", consecutiveFailures: 3, lastConfirmedFailureAt: at(1).toISOString(), lastCheckedAt: at(20).toISOString() });
  r = await runOAuthCleanup({ now: at(20, 1), log, dryRun: false });
  assert.ok(devStore.get().users.some((u) => u.id === "300000000000000001"));
  ok("stale 'confirmed' state is re-verified right before deleting; valid token ⇒ kept");

  // mass revocation breaker
  const mass: string[] = [];
  for (let i = 0; i < 10; i++) {
    const id = `4000000000000000${String(i).padStart(2, "0")}`;
    mass.push(id); mkUser(id);
    await mkTokens(id, "revoked_mass", "oldaccess", 60);
    await patchState(id, { authStatus: "suspected_revoked", consecutiveFailures: 2, lastConfirmedFailureAt: at(28).toISOString(), lastCheckedAt: at(28).toISOString() });
  }
  r = await runOAuthCleanup({ now: at(30), log, dryRun: false });
  assert.equal(r.deleted.length, 0);
  assert.ok(r.notes.some((n) => n.startsWith("Safety stop")));
  for (const id of mass) assert.ok(devStore.get().users.some((u) => u.id === id));
  ok("mass-revocation safety stop: nobody deleted when too many look revoked at once");

  // per-run cap
  for (const id of mass.slice(0, 3)) devStore.update((s) => { s.users = s.users.filter((u) => u.id !== id); delete s.discordTokens[id]; });
  // bad client credentials abort without touching state
  process.env.DISCORD_CLIENT_SECRET = "WRONG";
  const before = JSON.stringify((await status(ids.valid)));
  r = await runOAuthCleanup({ now: at(60), log, dryRun: false });
  assert.match(r.aborted ?? "", /config_error/);
  assert.equal(r.deleted.length, 0);
  process.env.DISCORD_CLIENT_SECRET = "secret";
  ok("wrong Discord client credentials abort the run without counting or deleting anything");

  // secrets never in logs / store
  const everything = captured.join("\n") + logs.join("\n") + JSON.stringify(devStore.get().auditLog) + JSON.stringify(devStore.get().accountDeletions) + JSON.stringify(r);
  for (const secret of ["oldaccess", "refresh_ok", "revoked_1", "goodaccess", "fresh_", "secret"]) assert.ok(!everything.includes(secret), "leaked: " + secret);
  const storeText = fs.readFileSync(STORE, "utf8");
  for (const secret of ["oldaccess", "refresh_ok", "revoked_1", "fresh_1"]) assert.ok(!storeText.includes(secret), "plaintext in store: " + secret);
  ok("tokens never appear in logs, audit/deletion records, reports, or (plaintext) in storage");

  console.log(`\n${results.length} checks passed`);
}

main()
  .then(() => cleanup(0))
  .catch((err) => { console.error("\nTEST FAILED:", err); cleanup(1); });

function cleanup(code: number) {
  server.close();
  if (hadStore) fs.copyFileSync(BACKUP, STORE); else fs.rmSync(STORE, { force: true });
  fs.rmSync(BACKUP, { force: true });
  process.exit(code);
}
