// DISCORD_API_BASE exists so tests can point the server at a local fake Discord.
export const DISCORD_API = process.env.DISCORD_API_BASE || "https://discord.com/api/v10";

export function getDiscordAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: process.env.DISCORD_REDIRECT_URI!,
    response_type: "code",
    scope: "identify",
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string) {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    client_secret: process.env.DISCORD_CLIENT_SECRET!,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI!,
  });

  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    throw new Error(`Discord token exchange failed: ${res.status} ${await res.text()}`);
  }

  return res.json() as Promise<{
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token: string;
    scope: string;
  }>;
}

export interface DiscordApiUser {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordApiUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Discord user: ${res.status}`);
  }

  return res.json();
}

export function discordAvatarUrl(user: DiscordApiUser): string {
  if (!user.avatar) {
    // Default embed avatar, keyed off the user's ID mod 6, per Discord's docs.
    const index = Number(BigInt(user.id) % BigInt(6));
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  const ext = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}`;
}
