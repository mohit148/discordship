/**
 * True once real Supabase credentials are in .env.local. Until then, every
 * getX() function in this folder just returns the sample data from
 * lib/mock-data.ts instead of trying (and failing) to hit a fake project.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  // Treat the placeholder values from .env.local.example as "not configured".
  return !url.includes("your-project") && !url.includes("placeholder");
}
