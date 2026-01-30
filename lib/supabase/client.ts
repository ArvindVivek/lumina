import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import postgres from 'postgres'
import type { Sql } from 'postgres'

/**
 * Create a Supabase client for server-side use in API routes.
 * Uses service role key for admin privileges.
 */
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

/**
 * Create a Supabase browser client for Client Components.
 * Uses publishable anon key for client-side operations.
 */
export function createBrowserSupabaseClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}

/**
 * Create a PostgreSQL client for raw SQL queries.
 * Uses DATABASE_URL for direct database access.
 */
export function createPostgresClient(): Sql {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL environment variable')
  }

  return postgres(databaseUrl)
}
