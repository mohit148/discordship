import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { requireRole } from "@/lib/roles";
import { NAV_KEYS, getAllNavItems, reorderNavItems, setNavItemVisible } from "@/lib/data/nav";
import { recordAudit } from "@/lib/data/audit";

// Only the public pages in NAV_KEYS can be touched here. Admin pages aren't
// part of this system at all, so they can't be hidden or exposed through it.
export async function PATCH(req: NextRequest) {
  const gate = await requireRole("admin");
  if (gate.forbidden) return NextResponse.json({ error: gate.forbidden.error }, { status: gate.forbidden.status });
  const session = getSession()!;
  const actor = { id: session.discordId, username: session.username, displayName: session.displayName, avatarUrl: session.avatarUrl };

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    if (Array.isArray(body?.order)) {
      const order: unknown[] = body.order;
      const valid =
        order.length === NAV_KEYS.length &&
        new Set(order).size === order.length &&
        order.every((k) => typeof k === "string" && NAV_KEYS.includes(k));
      if (!valid) return NextResponse.json({ error: "Invalid page order." }, { status: 400 });
      await reorderNavItems(order as string[]);
      await recordAudit({ actor, action: "reordered navigation", targetType: "settings", targetId: "navigation", detail: order.join(", ") });
    } else if (typeof body?.key === "string" && typeof body?.visible === "boolean") {
      if (!NAV_KEYS.includes(body.key)) return NextResponse.json({ error: "Unknown page." }, { status: 400 });
      await setNavItemVisible(body.key, body.visible);
      await recordAudit({
        actor,
        action: body.visible ? "showed page" : "hid page",
        targetType: "settings",
        targetId: "navigation",
        detail: body.key,
      });
    } else {
      return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    }
    return NextResponse.json({ items: await getAllNavItems() });
  } catch (err) {
    console.error("Failed to update navigation", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
