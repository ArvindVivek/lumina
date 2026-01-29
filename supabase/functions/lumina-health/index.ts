// Health check Edge Function for Lumina
// Validates infrastructure is operational

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from "../_shared/cors.ts"
import { getSupabaseClient } from "../_shared/supabase.ts"

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = getSupabaseClient()

    // Test database connectivity - will fail until migration (expected)
    const { error } = await supabase
      .from('tournaments')
      .select('id')
      .limit(1)

    return new Response(
      JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: error ? 'not_migrated' : 'connected',
        message: error ? 'Database tables not yet created' : 'Ready'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'error',
        message: (error as Error).message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
