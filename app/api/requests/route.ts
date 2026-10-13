import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/config";
import { devStore } from "@/lib/data/dev-store";
import { getSession } from "@/lib/session";
import { isDiscordId } from "@/lib/ids";
import type { ShipRequest } from "@/types";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in with Discord first." }, { status: 401 });
  }

  const { toUserId } = await req.json();
  if (!toUserId || toUserId === session.discordId || (isSupabaseConfigured() && !isDiscordId(toUserId))) {
    return NextResponse.json({ error: "Pick someone else to ship with." }, { status: 400 });
  }

  if (isSupabaseConfigured()) {
    const supabase = createServiceRoleClient();

    const { data: toUser, error: toUserError } = await supabase
      .from("users")
      .select("accepts_requests")
      .eq("discord_id", toUserId)
      .maybeSingle();

    if (toUserError) {
      console.error("Failed to look up recipient before creating ship request", toUserError);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
    if (!toUser) {
      return NextResponse.json({ error: "Couldn't find that user." }, { status: 404 });
    }
    if (toUser.accepts_requests === false) {
      return NextResponse.json({ error: "This person isn't accepting ship requests right now." }, { status: 403 });
    }

    const { data: existingShip } = await supabase
      .from("ships")
      .select("id")
      .eq("status", "confirmed")
      .or(
        `and(user_a_id.eq.${session.discordId},user_b_id.eq.${toUserId}),and(user_a_id.eq.${toUserId},user_b_id.eq.${session.discordId})`
      )
      .maybeSingle();

    if (existingShip) {
      return NextResponse.json({ error: "You're already shipped with this person." }, { status: 409 });
    }

    const { data: existing } = await supabase
      .from("ship_requests")
      .select("id")
      .eq("status", "pending")
      .or(
        `and(from_user_id.eq.${session.discordId},to_user_id.eq.${toUserId}),and(from_user_id.eq.${toUserId},to_user_id.eq.${session.discordId})`
      )
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "There's already a pending request between you two." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("ship_requests")
      .insert({ from_user_id: session.discordId, to_user_id: toUserId, status: "pending" })
      .select()
      .single();

    if (error) {
      console.error("Failed to create ship request", error);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  }

  // Local dev store fallback
  const store = devStore.get();
  const fromUser = store.users.find((u) => u.id === session.discordId) ?? {
    id: session.discordId,
    username: session.username,
    displayName: null,
    avatarUrl: session.avatarUrl,
  };
  const toUser = store.users.find((u) => u.id === toUserId);
  if (!toUser) {
    return NextResponse.json({ error: "Couldn't find that user." }, { status: 404 });
  }
  if (toUser.acceptsRequests === false) {
    return NextResponse.json({ error: "This person isn't accepting ship requests right now." }, { status: 403 });
  }

  const alreadyShipped = store.ships.some(
    (s) =>
      s.status === "confirmed" &&
      ((s.userA.id === fromUser.id && s.userB.id === toUser.id) ||
        (s.userA.id === toUser.id && s.userB.id === fromUser.id))
  );
  if (alreadyShipped) {
    return NextResponse.json({ error: "You're already shipped with this person." }, { status: 409 });
  }

  const alreadyPending = store.requests.some(
    (r) =>
      r.status === "pending" &&
      ((r.fromUser.id === fromUser.id && r.toUser.id === toUser.id) ||
        (r.fromUser.id === toUser.id && r.toUser.id === fromUser.id))
  );
  if (alreadyPending) {
    return NextResponse.json({ error: "There's already a pending request between you two." }, { status: 409 });
  }

  const request: ShipRequest = {
    id: crypto.randomUUID(),
    fromUser,
    toUser,
    status: "pending",
    createdAt: new Date().toISOString(),
    respondedAt: null,
  };

  devStore.update((s) => {
    s.requests.push(request);
    if (!s.users.some((u) => u.id === fromUser.id)) s.users.push(fromUser);
  });

  return NextResponse.json(request, { status: 201 });
}
