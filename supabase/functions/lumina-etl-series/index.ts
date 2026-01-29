// ETL Edge Function: Fetch series for a tournament
// File: supabase/functions/etl-series/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GridAPIClient } from '../_shared/lumina/grid-client.ts';
import { Database, SeriesInsert, TeamInsert } from '../_shared/lumina/types.ts';
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
    // Parse request body
    const body = await req.json();
    const tournamentId = body.tournamentId;

    if (!tournamentId) {
      throw new Error('tournamentId is required in request body');
    }

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

    console.log(`Fetching series for tournament: ${tournamentId}`);

    // Get already-completed series jobs for this tournament
    const completedJobs = await getCompletedJobs(supabase, 'series');
    console.log(`Found ${completedJobs.size} completed series jobs`);

    // Get tournament database ID (needed for foreign key)
    const { data: tournamentData, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id')
      .eq('grid_id', tournamentId)
      .single();

    if (tournamentError || !tournamentData) {
      throw new Error(`Tournament ${tournamentId} not found in database`);
    }

    const dbTournamentId = tournamentData.id;

    // Fetch series from GRID API
    const response = await gridClient.getSeriesForTournament(tournamentId);
    const series = response.data.allSeries.nodes;

    console.log(`Fetched ${series.length} series from GRID API`);

    let newCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Process each series
    for (const seriesData of series) {
      const seriesId = seriesData.id;

      // Skip if already completed
      if (completedJobs.has(seriesId)) {
        skippedCount++;
        continue;
      }

      try {
        // Mark checkpoint as in_progress
        await markStarted(supabase, {
          jobType: 'series',
          entityId: seriesId,
        });

        // Fetch series state to get team and game details
        const stateResponse = await gridClient.getSeriesState(seriesId);
        const seriesState = stateResponse.data.seriesState;

        if (!seriesState) {
          console.warn(`No series state found for ${seriesId}, skipping`);
          await markCompleted(supabase, {
            jobType: 'series',
            entityId: seriesId,
          });
          skippedCount++;
          continue;
        }

        // Extract and upsert teams
        let blueTeamDbId: string | null = null;
        let redTeamDbId: string | null = null;

        if (seriesState.teams && seriesState.teams.length >= 2) {
          const blueTeam = seriesState.teams[0];
          const redTeam = seriesState.teams[1];

          // Upsert blue team
          const blueTeamData: TeamInsert = {
            grid_id: blueTeam.id,
            name: blueTeam.name || 'Unknown Team',
            short_name: null,
            region: null,
          };

          const { data: blueTeamResult, error: blueTeamError } = await supabase
            .from('teams')
            .upsert(blueTeamData, { onConflict: 'grid_id' })
            .select('id')
            .single();

          if (blueTeamError) {
            console.error('Error upserting blue team:', blueTeamError);
          } else if (blueTeamResult) {
            blueTeamDbId = blueTeamResult.id;
          }

          // Upsert red team
          const redTeamData: TeamInsert = {
            grid_id: redTeam.id,
            name: redTeam.name || 'Unknown Team',
            short_name: null,
            region: null,
          };

          const { data: redTeamResult, error: redTeamError } = await supabase
            .from('teams')
            .upsert(redTeamData, { onConflict: 'grid_id' })
            .select('id')
            .single();

          if (redTeamError) {
            console.error('Error upserting red team:', redTeamError);
          } else if (redTeamResult) {
            redTeamDbId = redTeamResult.id;
          }
        }

        // Determine winner (if series finished)
        let winnerTeamDbId: string | null = null;
        if (seriesState.teams && seriesState.teams.length >= 2) {
          const winningTeam = seriesState.teams.find((t) => t.won === true);
          if (winningTeam) {
            const { data: winnerData } = await supabase
              .from('teams')
              .select('id')
              .eq('grid_id', winningTeam.id)
              .single();

            if (winnerData) {
              winnerTeamDbId = winnerData.id;
            }
          }
        }

        // Extract patch version (typically from game data, but not always available)
        // For now, set to null; can be extracted from game details in etl-drafts
        const patchVersion: string | null = null;

        // Prepare series data for insertion
        const seriesInsertData: SeriesInsert = {
          grid_id: seriesData.id,
          tournament_id: dbTournamentId,
          blue_team_id: blueTeamDbId,
          red_team_id: redTeamDbId,
          winner_team_id: winnerTeamDbId,
          patch_version: patchVersion,
          started_at: seriesState.started,
          finished_at: seriesState.finished,
        };

        // Upsert series to database
        const { error: upsertError } = await supabase
          .from('series')
          .upsert(seriesInsertData, {
            onConflict: 'grid_id',
          });

        if (upsertError) {
          throw new Error(`Failed to upsert series: ${upsertError.message}`);
        }

        // Mark checkpoint as completed
        await markCompleted(supabase, {
          jobType: 'series',
          entityId: seriesId,
        });

        newCount++;
      } catch (error) {
        console.error(`Error processing series ${seriesId}:`, error);

        // Mark checkpoint as failed
        await markFailed(supabase, {
          jobType: 'series',
          entityId: seriesId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });

        errorCount++;
      }
    }

    // Return summary
    const summary = {
      success: true,
      tournamentId,
      fetched: series.length,
      new: newCount,
      skipped: skippedCount,
      errors: errorCount,
      message: `Processed ${newCount} new series, skipped ${skippedCount} already completed, ${errorCount} errors`,
    };

    console.log('Series ETL complete:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Series ETL error:', error);

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
