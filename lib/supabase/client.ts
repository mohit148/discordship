import { createBrowserClient } from "@supabase/ssr";

// Not parameterized with the generated Database type yet — hand-rolled types
// in ./types.ts don't fully match what supabase-js's generic helpers expect
// (Views/Functions/Enums/CompositeTypes), which can produce confusing
// "never" errors. Once you run:
//   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts
// swap this back to `createBrowserClient<Database>(...)`.

/** Supabase client for use in Client Components. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
