import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { createReport } from "@/lib/data/reports";
import { getShipById } from "@/lib/data/ships";

export async function POST(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in with Discord first." }, { status: 401 });
  }

  const { shipId, reportedUserId, reason } = await req.json();

  if (!shipId && !reportedUserId) {
    return NextResponse.json({ error: "Pick something to report." }, { status: 400 });
  }
  if (typeof reason !== "string" || reason.trim().length < 3) {
    return NextResponse.json({ error: "Tell us a bit more about what's going on." }, { status: 400 });
  }

  if (shipId) {
    const ship = await getShipById(shipId);
    if (!ship) {
      return NextResponse.json({ error: "That ship doesn't exist." }, { status: 404 });
    }
  }

  await createReport({
    shipId: shipId ?? null,
    reportedUserId: reportedUserId ?? null,
    reportedBy: session.discordId,
    reason: reason.trim(),
  });

  return NextResponse.json({ ok: true }, { status: 201 });
}
