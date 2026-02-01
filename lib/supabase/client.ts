import { createBrowserClient } from '@supabase/ssr'

/**
 * Create a Supabase browser client for Client Components and React hooks.
 * Uses anon key for client-side operations.
 *
 * ✅ BROWSER-SAFE: Can be imported in Client Components
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
