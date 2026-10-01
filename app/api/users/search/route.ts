import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/config";
import { devStore } from "@/lib/data/dev-store";
import type { DiscordUser } from "@/types";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return NextResponse.json([]);

  const session = getSession();

  if (isSupabaseConfigured()) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .select("discord_id, username, display_name, avatar_url, avatar_override_url")
      .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
      .neq("discord_id", session?.discordId ?? "")
      .limit(8);

    if (!error) {
      const users: DiscordUser[] = (data ?? []).map((row) => ({
        id: row.discord_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_override_url || row.avatar_url,
      }));
      return NextResponse.json(users);
    }
    console.error("User search failed against Supabase, falling back to the local dev store", error);
  }

  const lower = q.toLowerCase();
  const matches = devStore
    .get()
    .users.filter((u) => u.id !== session?.discordId && (u.username.toLowerCase().includes(lower) || (u.displayName ?? "").toLowerCase().includes(lower)))
    .slice(0, 8);

  return NextResponse.json(matches);
}
