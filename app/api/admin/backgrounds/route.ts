import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/roles";
import { createBackground } from "@/lib/data/backgrounds";
import { recordAudit } from "@/lib/data/audit";
import { MAX_BACKGROUND_CHARS, validateImageDataUrl } from "@/lib/images";

// Admin-only: add a background to the catalog. Regular users can never
// upload one — they can only pick from what's in the catalog.
export async function POST(req: NextRequest) {
  const gate = await requireRole("admin");
  if (gate.forbidden) return NextResponse.json({ error: gate.forbidden.error }, { status: gate.forbidden.status });
  const session = getSession()!;

  const { name, imageData } = await req.json();
  const cleanName = typeof name === "string" ? name.trim() : "";
  if (cleanName.length < 1 || cleanName.length > 40) {
    return NextResponse.json({ error: "Give it a name (up to 40 characters)." }, { status: 400 });
  }
  const image = validateImageDataUrl(imageData, MAX_BACKGROUND_CHARS);
  if (!image) {
    return NextResponse.json({ error: "That image couldn't be used — try a JPG, PNG or WebP." }, { status: 400 });
  }

  try {
    const background = await createBackground(cleanName, image);
    await recordAudit({
      actor: { id: session.discordId, username: session.username, displayName: session.displayName, avatarUrl: session.avatarUrl },
      action: "added background",
      targetType: "background",
      targetId: background.id,
      detail: cleanName,
    });
    return NextResponse.json({ background }, { status: 201 });
  } catch (err) {
    console.error("Failed to add background", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
