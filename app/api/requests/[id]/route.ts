import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/data/config";
import { devStore, nextShipNumber } from "@/lib/data/dev-store";
import { getSession } from "@/lib/session";
import type { Ship } from "@/types";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in with Discord first." }, { status: 401 });
  }

  const { action } = await req.json(); // "accept" | "decline" | "cancel"

  if (isSupabaseConfigured()) {
    const supabase = createServiceRoleClient();

    const { data: request, error: fetchError } = await supabase
      .from("ship_requests")
      .select("*")
      .eq("id", params.id)
      .single();

    if (fetchError || !request) {
      return NextResponse.json({ error: "Request not found." }, { status: 404 });
    }

    const isRecipient = session.discordId === request.to_user_id;
    const isSender = session.discordId === request.from_user_id;

    if (action === "cancel" && !isSender) {
      return NextResponse.json({ error: "Only the sender can cancel this." }, { status: 403 });
    }
    if ((action === "accept" || action === "decline") && !isRecipient) {
      return NextResponse.json({ error: "Only the recipient can respond to this." }, { status: 403 });
    }
    if (request.status !== "pending") {
      return NextResponse.json({ error: "This request has already been resolved." }, { status: 409 });
    }

    const newStatus = action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled";

    await supabase
      .from("ship_requests")
      .update({ status: newStatus, responded_at: new Date().toISOString() })
      .eq("id", params.id);

    if (newStatus === "accepted") {
      const { data: ship, error: shipError } = await supabase
        .from("ships")
        .insert({
          user_a_id: request.from_user_id,
          user_b_id: request.to_user_id,
          status: "confirmed",
          is_two_auth: true,
          custom_text: null,
          custom_text_pending: null,
          custom_text_proposed_by: null,
          updated_by: session.discordId,
          ended_at: null,
        })
        .select()
        .single();

      if (shipError) {
        console.error("Failed to create ship from accepted request", shipError);
        return NextResponse.json({ error: "Couldn't create the ship." }, { status: 500 });
      }

      return NextResponse.json({ ship });
    }

    return NextResponse.json({ status: newStatus });
  }

  // Local dev store fallback
  const store = devStore.get();
  const request = store.requests.find((r) => r.id === params.id);
  if (!request) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  const isRecipient = session.discordId === request.toUser.id;
  const isSender = session.discordId === request.fromUser.id;

  if (action === "cancel" && !isSender) {
    return NextResponse.json({ error: "Only the sender can cancel this." }, { status: 403 });
  }
  if ((action === "accept" || action === "decline") && !isRecipient) {
    return NextResponse.json({ error: "Only the recipient can respond to this." }, { status: 403 });
  }
  if (request.status !== "pending") {
    return NextResponse.json({ error: "This request has already been resolved." }, { status: 409 });
  }

  const newStatus = action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled";
  let createdShip: Ship | null = null;

  devStore.update((s) => {
    const r = s.requests.find((x) => x.id === params.id)!;
    r.status = newStatus;
    r.respondedAt = new Date().toISOString();

    if (newStatus === "accepted") {
      const now = new Date().toISOString();
      const ship: Ship = {
        id: crypto.randomUUID(),
        number: nextShipNumber(s),
        userA: r.fromUser,
        userB: r.toUser,
        status: "confirmed",
        isTwoAuth: true,
        customText: null,
        customTextPending: null,
        customTextProposedBy: null,
        background: null,
        backgroundPending: null,
        backgroundProposedBy: null,
        createdAt: now,
        updatedAt: now,
        updatedBy: r.toUser,
        createdBy: null,
        endedAt: null,
      };
      s.ships.push(ship);
      createdShip = ship;
    }
  });

  if (newStatus === "accepted") {
    return NextResponse.json({ ship: createdShip });
  }
  return NextResponse.json({ status: newStatus });
}
