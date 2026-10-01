import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Not parameterized with the generated Database type yet — see the note in
// client.ts. Regenerate lib/supabase/types.ts with the Supabase CLI and
// swap `createServerClient(...)` back in when you do.

/** Supabase client for use in Server Components, Route Handlers and Server Actions. */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Parameters<typeof cookieStore.set>[2] }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component with no request context — safe to ignore
            // as long as middleware also refreshes the session.
          }
        },
      },
    }
  );
}

/**
 * Service-role client that bypasses Row Level Security.
 * Only use this on the server, for admin actions and OAuth callback handling.
 * Never import this from a Client Component.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
