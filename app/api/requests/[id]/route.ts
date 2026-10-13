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

  const { action } = await req.json().catch(() => ({})); // "accept" | "decline" | "cancel"
  if (action !== "accept" && action !== "decline" && action !== "cancel") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

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
    const respondedAt = new Date().toISOString();

    if (newStatus === "accepted") {
      // Make the ship FIRST and only then mark the request accepted, so a failure never leaves an
      // "accepted" request with no ship behind it. If these two people were shipped before (an ended or
      // archived card exists for the pair — a pair can only have one card), that card is brought back.
      const a = request.from_user_id;
      const b = request.to_user_id;
      const { data: existing, error: existingError } = await supabase
        .from("ships")
        .select("id, status")
        .or(`and(user_a_id.eq.${a},user_b_id.eq.${b}),and(user_a_id.eq.${b},user_b_id.eq.${a})`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingError) {
        console.error("Failed to look up an existing ship", existingError);
        return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
      }

      let ship: unknown;
      if (existing && existing.status === "confirmed") {
        return NextResponse.json({ error: "You two are already shipped." }, { status: 409 });
      }
      if (existing) {
        const { data, error } = await supabase
          .from("ships")
          .update({
            status: "confirmed",
            is_two_auth: true,
            ended_at: null,
            custom_text_pending: null,
            custom_text_proposed_by: null,
            background_pending: null,
            background_proposed_by: null,
            updated_by: session.discordId,
            updated_at: respondedAt,
          })
          .eq("id", existing.id)
          .select("id, number, status")
          .single();
        if (error) {
          console.error("Failed to bring back an earlier ship", error);
          return NextResponse.json({ error: "Couldn't create the ship." }, { status: 500 });
        }
        ship = data;
      } else {
        const { data, error } = await supabase
          .from("ships")
          .insert({
            user_a_id: a,
            user_b_id: b,
            status: "confirmed",
            is_two_auth: true,
            custom_text: null,
            custom_text_pending: null,
            custom_text_proposed_by: null,
            updated_by: session.discordId,
            ended_at: null,
          })
          .select("id, number, status")
          .single();
        if (error) {
          console.error("Failed to create ship from accepted request", error);
          return NextResponse.json({ error: "Couldn't create the ship." }, { status: 500 });
        }
        ship = data;
      }

      await supabase.from("ship_requests").update({ status: newStatus, responded_at: respondedAt }).eq("id", params.id);
      return NextResponse.json({ ship });
    }

    const { error: updateError } = await supabase
      .from("ship_requests")
      .update({ status: newStatus, responded_at: respondedAt })
      .eq("id", params.id)
      .eq("status", "pending");
    if (updateError) {
      console.error("Failed to update request", updateError);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
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
      const earlier = s.ships.find(
        (x) => (x.userA.id === r.fromUser.id && x.userB.id === r.toUser.id) || (x.userA.id === r.toUser.id && x.userB.id === r.fromUser.id)
      );
      if (earlier) {
        earlier.status = "confirmed";
        earlier.isTwoAuth = true;
        earlier.endedAt = null;
        earlier.customTextPending = null;
        earlier.customTextProposedBy = null;
        earlier.backgroundPending = null;
        earlier.backgroundProposedBy = null;
        earlier.updatedAt = now;
        createdShip = earlier;
        return;
      }
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
