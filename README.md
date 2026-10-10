# ship.

A little community "ship" board for a Discord server — friendships, chaotic duos, and yes,
the occasional couple. Built with Next.js (App Router), TypeScript, Tailwind, Supabase, and
Discord OAuth.

## What's here right now

The frontend is fully built out and matches the reference design closely — pastel status
badges, thin borders, soft shadows, avatars, sidebar nav that collapses to a bottom bar on
mobile.

**Supabase is the source of truth once it's configured.** Every page and API route calls a
function in `lib/data/*.ts` (e.g. `getShips()`, `getUsers()`) or checks
`isSupabaseConfigured()` directly. If Supabase is connected, that's what you see — including
a correctly empty list, if a table has no rows yet. The local JSON file — `.dev-store.json`
at the project root (see `lib/data/dev-store.ts`) — is only used when Supabase isn't
configured at all, or a query genuinely fails (bad keys, network error). That means clicking
Approve, ending a ship, editing custom text, etc. actually persists across refreshes even
before you've set up Supabase. Delete `.dev-store.json` any time to reset back to the sample
data.

The backend scaffolding — Supabase schema, RLS policies, Discord OAuth flow, session
cookies, and every API route (ships, requests, admin actions) — is written and wired for
consent-first ship creation.

**If you already ran an earlier `supabase/schema.sql`:** don't rerun it — run, in order,
`0003_backgrounds_avatars_manual_people.sql`, `0004_roles_and_creator_tracking.sql`, and
`0005_claim_profiles_and_renumbering.sql`, and `0006_discord_sync_rules_nav.sql` from
`supabase/migrations/` instead (all are safe to run more than once).

**Discord picture sync:** there's no background job runner, so pictures/names re-sync from
Discord opportunistically (at most hourly per person, triggered by site visits). It needs the
OAuth tokens saved at login, so people who logged in before this update need to log in once
more. A custom uploaded picture is never overwritten; resetting returns to the latest synced
Discord picture.

**Rules & Navigation:** both are managed in the Admin Portal (Rules, Navigation) and take
effect immediately — no redeploy. Hidden pages 404 for everyone except admins.

**Roles:** set `OWNER_DISCORD_ID` in `.env.local` to your own Discord user ID — that's the
only Owner, permanently, regardless of anything in the database. `ADMIN_DISCORD_IDS` (optional)
only seeds the Admin role on someone's very first login; after that, roles live in the database
and are only ever changed from the Admin Portal (or by being the Owner).

## 1. Install

```bash
npm install
```

## 2. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql`. It creates `users`, `ships`,
   `ship_requests`, `ship_history`, `reports`, `audit_logs`, plus RLS policies.
3. Copy `.env.local.example` to `.env.local` and fill in:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API)
   - `SUPABASE_SERVICE_ROLE_KEY` (same page — keep this secret, server-only)

## 3. Set up Discord OAuth

1. Create an app at [discord.com/developers/applications](https://discord.com/developers/applications).
2. Under OAuth2 → Redirects, add `http://localhost:3000/api/auth/discord/callback`
   (and your production URL later).
3. Fill in `.env.local`:
   - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`
   - `DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback`
   - `ADMIN_DISCORD_IDS` — comma-separated Discord user IDs that should get admin access
   - `SESSION_SECRET` — any long random string (`openssl rand -hex 32`)

## 4. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`.

## Discord authorization checks (revoked-app cleanup)

Login is still the direct Discord flow with the **`identify` scope only** (no email). At login the
access/refresh tokens are stored **AES-256-GCM encrypted** in `user_discord_tokens` (server-only, RLS on, no policies).
A daily job (`/api/cron/oauth-cleanup`, scheduled in `vercel.json`) asks Discord whether each person's authorization is still valid:

- Only Discord's explicit `invalid_grant` counts as "revoked". Network errors, DNS, 429, 5xx, timeouts, odd responses = transient: retried, never counted.
- 3 confirmed rejections on different days (≥20h apart) are needed; any success resets the count.
- Before deleting: not an admin/owner, Discord ID matches, fewer than the per-run cap, no mass-revocation spike, and a fresh final recheck must still fail.
- Deletion = `delete_user_account(discord_id)`: exactly one user, one transaction, idempotent. Shared ships keep the other person; the leaver's slot becomes "Former member".
- Everything is logged in `account_deletions` (no secrets). **Dry run is the default** until `OAUTH_CLEANUP_DRY_RUN=false`.
- Admin → Users has a "Check" button per person (read-only; never deletes).

Setup: run `supabase/migrations/0007_oauth_revoke_checks.sql`, set `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`
(see `.env.local.example`), redeploy. People must log in once so their tokens get stored.
Commands: `npm run oauth-cleanup:dry`, `npm run oauth-cleanup`, `npm run test:oauth`.

## Project structure

```
app/
  page.tsx, HomeClient.tsx        Home / ship list
  ships/[id]/                     Ship details (+ custom text, end-ship)
  create/, create/send/           Create ship, send-a-request flow
  stats/                          Community stats
  about/                          About page
  admin/                          Admin dashboard, requests, users, ships, reports,
                                  settings, audit log — gated by app/admin/layout.tsx
  api/                            Route handlers: auth, ships, requests, admin actions
components/                       Shared UI: Sidebar, AdminSidebar, Avatar, StatusBadge,
                                  ShipTable, SearchBar, StatusFilters, Pagination,
                                  ConfirmDialog, Button
lib/
  data/                           Data layer: getShips(), getUsers(), getPendingRequests(),
                                  getReports(), getAuditLog(), plus dev-store.ts — the local
                                  JSON-file store used whenever Supabase isn't configured
  supabase/                       Browser + server + service-role Supabase clients
  discord.ts                      Discord OAuth helpers
  session.ts                      Signed session cookie (has a DEV_FAKE_ADMIN escape hatch
                                  for previewing /admin locally — see comments)
  dates.ts                        Duration / anniversary math
  mock-data.ts                    A couple of sample entries per type, used as a fallback
supabase/schema.sql               Full schema + RLS policies
types/index.ts                    Domain types (Ship, DiscordUser, etc.)
```

## Consent rules, as implemented

- **2-auth ships** (the "Send a Request" flow) only become `confirmed` once the *recipient*
  accepts — see `app/api/requests/[id]/route.ts`. Sending a request never creates a ship by
  itself.
- **Admin-created ships** start as `pending`, not `confirmed` — an admin creating a ship is
  not the same as both people consenting. Wire up whatever confirmation step fits your
  server (a Discord DM with a button, a "confirm this ship" page) before flipping it to
  `confirmed`.
- **Custom text on 2-auth ships** is proposed by one participant and held in
  `custom_text_pending` until the other confirms it — see the `PATCH` handler in
  `app/api/ships/[id]/route.ts`.
- **Ending a ship**: either participant on a 2-auth ship can end it themselves; ending an
  admin-created ship requires an admin. Ended/archived ships are never deleted — their
  history stays in `ship_history`.

## Known gaps to close before shipping (heh) to production

- `lib/data/*.ts` fetches related users with a second query (by ID) rather than a single
  joined query — this sidesteps needing to know Supabase's exact auto-generated foreign key
  constraint names, at the cost of an extra round trip per page. Fine at this scale; revisit
  if it ever shows up as a bottleneck.
- `lib/supabase/types.ts` is hand-written for reference and isn't wired into the clients
  yet (hand-rolled `Database` types can produce confusing `never` errors with supabase-js's
  generics unless every field is present). Run `npx supabase gen types typescript` once
  your project is linked, then parameterize `createClient<Database>()` in
  `lib/supabase/client.ts` / `lib/supabase/server.ts`.
- The mobile top bar's "Login" link and admin toggle switches on the Settings page are
  visual/functional placeholders — hook them up to your real auth state and a `settings`
  table respectively.
- No automated tests yet.
