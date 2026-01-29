// ETL Edge Function: Fetch tournaments from GRID API
// File: supabase/functions/etl-tournaments/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GridAPIClient } from '../_shared/lumina/grid-client.ts';
import { Database, TournamentInsert } from '../_shared/lumina/types.ts';
import {
  markStarted,
  markCompleted,
  markFailed,
  getCompletedJobs,
} from '../_shared/lumina/checkpoint.ts';

// ==========================================
// EDGE FUNCTION HANDLER
// ==========================================

Deno.serve(async (req) => {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'synapse' },
    });

    // Create GRID API client
    const gridApiKey = Deno.env.get('GRID_API_KEY');
    if (!gridApiKey) {
      throw new Error('GRID_API_KEY environment variable is required');
    }

    const gridClient = new GridAPIClient(gridApiKey);

    // Parse request body for optional parameters
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const startDate = body.startDate || '2024-01-01';
    const gameId = body.gameId || 'lol';

    console.log(`Fetching tournaments for game: ${gameId}, start date: ${startDate}`);

    // Get already-completed tournament jobs from checkpoints
    const completedJobs = await getCompletedJobs(supabase, 'tournaments');
    console.log(`Found ${completedJobs.size} completed tournament jobs`);

    // Fetch tournaments from GRID API
    const response = await gridClient.getTournaments(gameId, startDate);
    const tournaments = response.data.allTournament.nodes;

    console.log(`Fetched ${tournaments.length} tournaments from GRID API`);

    let newCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each tournament
    for (const tournament of tournaments) {
      const tournamentId = tournament.id;

      // Skip if already completed
      if (completedJobs.has(tournamentId)) {
        skippedCount++;
        continue;
      }

      try {
        // Mark checkpoint as in_progress
        await markStarted(supabase, {
          jobType: 'tournaments',
          entityId: tournamentId,
        });

        // Prepare tournament data for insertion
        const tournamentData: TournamentInsert = {
          grid_id: tournament.id,
          title: tournament.title,
          region: tournament.region || null,
          start_date: tournament.startTimeScheduled,
          end_date: tournament.endTimeScheduled,
        };

        // Upsert tournament to database (using grid_id for uniqueness)
        const { error: upsertError } = await supabase
          .from('tournaments')
          .upsert(tournamentData, {
            onConflict: 'grid_id',
          });

        if (upsertError) {
          throw new Error(`Failed to upsert tournament: ${upsertError.message}`);
        }

        // Mark checkpoint as completed
        await markCompleted(supabase, {
          jobType: 'tournaments',
          entityId: tournamentId,
        });

        newCount++;
      } catch (error) {
        console.error(`Error processing tournament ${tournamentId}:`, error);

        // Mark checkpoint as failed
        await markFailed(supabase, {
          jobType: 'tournaments',
          entityId: tournamentId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        errorCount++;
      }
    }

    // Return summary
    const summary = {
      success: true,
      fetched: tournaments.length,
      new: newCount,
      skipped: skippedCount,
      errors: errorCount,
      message: `Processed ${newCount} new tournaments, skipped ${skippedCount} already completed, ${errorCount} errors`,
    };

    console.log('Tournament ETL complete:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Tournament ETL error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
