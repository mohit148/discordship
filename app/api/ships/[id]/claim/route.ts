import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { claimShip } from "@/lib/data/claims";

/**
 * Lets someone connect themselves to a names-only ship an admin/Ship
 * Creator made for them. No separate claim token — the proof is simply
 * being logged in with the Discord account whose ID was entered for that
 * slot. `session.discordId` (never anything from the request body) is
 * what gets checked against the stored ID, so this can't be spoofed by
 * passing a different ID in the request.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in with Discord first." }, { status: 401 });
  }

  const result = await claimShip(params.id, session.discordId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  return NextResponse.json({ ok: true, side: result.side });
}
