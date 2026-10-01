import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForToken, fetchDiscordUser, discordAvatarUrl } from "@/lib/discord";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/config";
import { devStore } from "@/lib/data/dev-store";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/session";
import { getRoleFor } from "@/lib/roles";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const stateRaw = req.nextUrl.searchParams.get("state");

  if (!code) {
    return NextResponse.redirect(new URL("/?error=discord_denied", req.url));
  }

  let redirectTo = "/";
  if (stateRaw) {
    try {
      redirectTo = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8")).redirectTo ?? "/";
    } catch {
      // ignore malformed state, fall back to home
    }
  }

  try {
    const token = await exchangeCodeForToken(code);
    const discordUser = await fetchDiscordUser(token.access_token);
    const avatarUrl = discordAvatarUrl(discordUser);

    // Role lives in the database from here on, not in this callback. The
    // ADMIN_DISCORD_IDS list (if set) only seeds the role on someone's
    // very first login — after that, promoting/demoting only ever happens
    // through the Admin Portal (or by being the Owner, which is never
    // stored at all — see lib/roles.ts). This is what makes a promotion
    // actually stick: previously this callback recomputed "isAdmin" from
    // that static list on *every* login, silently overwriting whatever the
    // Admin Portal had just set.
    const seedAdminIds = (process.env.ADMIN_DISCORD_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

    let dbRole: string;

    if (isSupabaseConfigured()) {
      const supabase = createServiceRoleClient();
      const { data: existing } = await supabase.from("users").select("role").eq("discord_id", discordUser.id).maybeSingle();

      if (existing) {
        dbRole = existing.role ?? "visitor";
        // Only refresh the profile fields Discord actually owns — never role.
        await supabase
          .from("users")
          .update({ username: discordUser.username, display_name: discordUser.global_name, avatar_url: avatarUrl })
          .eq("discord_id", discordUser.id);
      } else {
        dbRole = seedAdminIds.includes(discordUser.id) ? "admin" : "visitor";
        await supabase.from("users").insert({
          discord_id: discordUser.id,
          username: discordUser.username,
          display_name: discordUser.global_name,
          avatar_url: avatarUrl,
          role: dbRole,
          is_admin: dbRole === "admin",
        });
      }
    } else {
      const existing = devStore.get().users.find((u) => u.id === discordUser.id);
      dbRole = existing?.role ?? (seedAdminIds.includes(discordUser.id) ? "admin" : "visitor");
      devStore.update((s) => {
        const user = s.users.find((u) => u.id === discordUser.id);
        if (user) {
          user.username = discordUser.username;
          user.displayName = discordUser.global_name;
          user.avatarUrl = avatarUrl;
          // role intentionally left untouched
        } else {
          s.users.push({
            id: discordUser.id,
            username: discordUser.username,
            displayName: discordUser.global_name,
            avatarUrl,
            role: dbRole as "visitor" | "ship_creator" | "admin",
            isAdmin: dbRole === "admin",
          });
        }
      });
    }

    const role = await getRoleFor(discordUser.id, dbRole);

    const res = NextResponse.redirect(new URL(redirectTo, req.url));
    res.cookies.set(
      SESSION_COOKIE_NAME,
      createSessionCookieValue({
        discordId: discordUser.id,
        username: discordUser.username,
        displayName: discordUser.global_name,
        avatarUrl,
        // Display-only snapshot (see the comment on SessionPayload in
        // lib/session.ts) — actual access is re-checked live every time.
        isAdmin: role === "admin" || role === "owner",
        issuedAt: Date.now(),
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );
    return res;
  } catch (err) {
    console.error("Discord OAuth callback failed", err);
    return NextResponse.redirect(new URL("/?error=discord_failed", req.url));
  }
}
