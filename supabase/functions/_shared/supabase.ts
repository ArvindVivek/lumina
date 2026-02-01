import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Lumina uses its own schema in the shared c9-jetbrains-hackathon Supabase instance
export function getSupabaseClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      db: { schema: 'lumina' }
    }
  )
}
