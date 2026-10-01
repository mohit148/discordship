import { NextRequest, NextResponse } from "next/server";
import { getDiscordAuthorizeUrl } from "@/lib/discord";

// Starts the login flow. Optional ?redirect=/path is round-tripped through
// Discord's `state` param and honored by the callback route below.
export async function GET(req: NextRequest) {
  const redirectTo = req.nextUrl.searchParams.get("redirect") ?? "/";
  const state = Buffer.from(JSON.stringify({ redirectTo })).toString("base64url");
  return NextResponse.redirect(getDiscordAuthorizeUrl(state));
}
