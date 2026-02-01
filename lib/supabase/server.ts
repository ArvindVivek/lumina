import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createServerClient as createSSRClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import postgres from 'postgres'
import type { Sql } from 'postgres'

/**
 * Create a Supabase client for Server Components.
 * Uses SSR-compatible client with cookie handling for auth.
 *
 * Note: This project doesn't use auth (no login), but the SSR pattern
 * is still needed for proper cookie handling in Server Components.
 *
 * ⚠️ SERVER-ONLY: Do not import this in Client Components
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createSSRClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component - can't set cookies
            // This is expected and safe to ignore
          }
        },
      },
    }
  )
}

/**
 * Create a Supabase client for API routes and Server Actions.
 * Uses service role key for admin privileges.
 *
 * ⚠️ SERVER-ONLY: Do not import this in Client Components
 */
export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables')
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

// Shared connection pool - reused across all requests
let sharedPool: Sql | null = null

/**
 * Get a shared PostgreSQL connection pool.
 * Uses a singleton pattern to avoid connection exhaustion.
 *
 * ⚠️ SERVER-ONLY: Do not import this in Client Components
 * ⚠️ DO NOT call sql.end() on this - it's a shared pool!
 */
export function getPostgresPool(): Sql {
  if (!sharedPool) {
    const databaseUrl = process.env.DATABASE_URL

    if (!databaseUrl) {
      throw new Error('Missing DATABASE_URL environment variable')
    }

    sharedPool = postgres(databaseUrl, {
      max: 20, // Maximum connections in pool
      idle_timeout: 30, // Close idle connections after 30 seconds
      connect_timeout: 10, // Connection timeout
    })
  }

  return sharedPool
}

/**
 * Create a PostgreSQL client for raw SQL queries.
 * Creates a NEW connection - caller is responsible for calling sql.end()
 *
 * ⚠️ SERVER-ONLY: Do not import this in Client Components
 * ⚠️ DEPRECATED: Prefer getPostgresPool() for better connection management
 */
export function createPostgresClient(): Sql {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error('Missing DATABASE_URL environment variable')
  }

  return postgres(databaseUrl)
}
