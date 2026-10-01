import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { setAcceptsRequests, setCustomAvatar } from "@/lib/data/users";
import { MAX_AVATAR_CHARS, validateImageDataUrl } from "@/lib/images";

/**
 * Updates the signed-in person's own account settings: whether they accept
 * ship requests, and their own profile picture. Neither takes a target user
 * ID — both always act on `session.discordId`, which is how "you can only
 * change your own PFP, never your partner's" is enforced. A PFP change is
 * personal, so it applies immediately and never goes through Requests.
 */
export async function PATCH(req: NextRequest) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Log in with Discord first." }, { status: 401 });
  }

  const body = await req.json();

  if (typeof body.acceptsRequests === "boolean") {
    await setAcceptsRequests(session.discordId, body.acceptsRequests);
    return NextResponse.json({ acceptsRequests: body.acceptsRequests });
  }

  if ("avatarData" in body) {
    if (body.avatarData === null) {
      await setCustomAvatar(session.discordId, null);
      return NextResponse.json({ ok: true });
    }
    const image = validateImageDataUrl(body.avatarData, MAX_AVATAR_CHARS);
    if (!image) {
      return NextResponse.json({ error: "That image couldn't be used — try a JPG, PNG or WebP." }, { status: 400 });
    }
    try {
      await setCustomAvatar(session.discordId, image);
    } catch (err) {
      console.error("Failed to save avatar", err);
      return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
}
