// ETL Edge Function: Extract draft picks/bans from series
// File: supabase/functions/etl-drafts/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GridAPIClient } from '../_shared/lumina/grid-client.ts';
import {
  Database,
  GameInsert,
  DraftInsert,
  ChampionPickInsert,
  PlayerInsert,
  Role,
  TeamSide,
} from '../_shared/lumina/types.ts';
import {
  markStarted,
  markCompleted,
  markFailed,
  getCompletedJobs,
} from '../_shared/lumina/checkpoint.ts';
import { inferRole } from '../_shared/synapse/role-inference.ts';

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
    const seriesId = body.seriesId;

    if (!seriesId) {
      throw new Error('seriesId is required in request body');
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

    console.log(`Extracting drafts for series: ${seriesId}`);

    // Check if already completed
    const completedJobs = await getCompletedJobs(supabase, 'drafts');
    if (completedJobs.has(seriesId)) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Series already processed',
          seriesId,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Mark checkpoint as in_progress
    await markStarted(supabase, {
      jobType: 'drafts',
      entityId: seriesId,
    });

    // Get series database ID
    const { data: seriesData, error: seriesError } = await supabase
      .from('series')
      .select('id, blue_team_id, red_team_id')
      .eq('grid_id', seriesId)
      .single();

    if (seriesError || !seriesData) {
      throw new Error(`Series ${seriesId} not found in database`);
    }

    const dbSeriesId = seriesData.id;

    // Fetch series state from GRID API
    const stateResponse = await gridClient.getSeriesState(seriesId);
    const seriesState = stateResponse.data.seriesState;

    if (!seriesState || !seriesState.games || seriesState.games.length === 0) {
      console.warn(`No games found for series ${seriesId}`);
      await markCompleted(supabase, {
        jobType: 'drafts',
        entityId: seriesId,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: 'No games to process',
          seriesId,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    let gamesProcessed = 0;
    let picksProcessed = 0;
    let roleInferenceStats = {
      high: 0, // >0.9 confidence
      medium: 0, // 0.5-0.9 confidence
      low: 0, // <0.5 confidence
    };

    // Process each game
    for (const game of seriesState.games) {
      try {
        // Create game record
        const gameData: GameInsert = {
          grid_id: game.id,
          series_id: dbSeriesId,
          game_number: game.number || 0,
          blue_team_won: null, // Can be determined from game.teams if needed
          duration_seconds: null,
        };

        const { data: gameResult, error: gameError } = await supabase
          .from('games')
          .upsert(gameData, { onConflict: 'grid_id' })
          .select('id')
          .single();

        if (gameError || !gameResult) {
          throw new Error(`Failed to upsert game: ${gameError?.message}`);
        }

        const dbGameId = gameResult.id;

        // Extract bans from both teams
        let blueBans: string[] = [];
        let redBans: string[] = [];

        if (game.teams && game.teams.length >= 2) {
          blueBans = game.teams[0].characterBans || [];
          redBans = game.teams[1].characterBans || [];
        }

        // Create draft record
        const draftData: DraftInsert = {
          game_id: dbGameId,
          blue_bans: blueBans,
          red_bans: redBans,
        };

        const { data: draftResult, error: draftError } = await supabase
          .from('drafts')
          .upsert(draftData, { onConflict: 'game_id' })
          .select('id')
          .single();

        if (draftError || !draftResult) {
          throw new Error(`Failed to upsert draft: ${draftError?.message}`);
        }

        const dbDraftId = draftResult.id;

        // Process picks for each team
        if (game.teams && game.teams.length >= 2) {
          const blueTeam = game.teams[0];
          const redTeam = game.teams[1];

          // Track assigned roles per team
          const blueAssignedRoles: Role[] = [];
          const redAssignedRoles: Role[] = [];

          // Process blue team picks
          if (blueTeam.players) {
            for (let i = 0; i < blueTeam.players.length; i++) {
              const player = blueTeam.players[i];

              if (!player.characterName) continue;

              // Upsert player
              const playerData: PlayerInsert = {
                grid_id: player.id,
                name: player.name || 'Unknown',
                team_id: seriesData.blue_team_id,
                primary_role: (player.role as Role) || 'mid',
              };

              const { data: playerResult } = await supabase
                .from('players')
                .upsert(playerData, { onConflict: 'grid_id' })
                .select('id')
                .single();

              const dbPlayerId = playerResult?.id || null;

              // Infer role
              const roleResult = inferRole({
                championName: player.characterName,
                playerPrimaryRole: (player.role as Role) || null,
                assignedRoles: blueAssignedRoles,
              });

              blueAssignedRoles.push(roleResult.role);

              // Track confidence stats
              if (roleResult.confidence > 0.9) roleInferenceStats.high++;
              else if (roleResult.confidence >= 0.5) roleInferenceStats.medium++;
              else roleInferenceStats.low++;

              // Create champion pick
              const pickData: ChampionPickInsert = {
                draft_id: dbDraftId,
                player_id: dbPlayerId,
                team_side: 'blue' as TeamSide,
                champion_name: player.characterName,
                role: roleResult.role,
                role_confidence: roleResult.confidence,
                pick_order: i + 1,
              };

              const { error: pickError } = await supabase
                .from('champion_picks')
                .insert(pickData);

              if (pickError) {
                console.error('Failed to insert champion pick:', pickError);
              } else {
                picksProcessed++;
              }
            }
          }

          // Process red team picks
          if (redTeam.players) {
            for (let i = 0; i < redTeam.players.length; i++) {
              const player = redTeam.players[i];

              if (!player.characterName) continue;

              // Upsert player
              const playerData: PlayerInsert = {
                grid_id: player.id,
                name: player.name || 'Unknown',
                team_id: seriesData.red_team_id,
                primary_role: (player.role as Role) || 'mid',
              };

              const { data: playerResult } = await supabase
                .from('players')
                .upsert(playerData, { onConflict: 'grid_id' })
                .select('id')
                .single();

              const dbPlayerId = playerResult?.id || null;

              // Infer role
              const roleResult = inferRole({
                championName: player.characterName,
                playerPrimaryRole: (player.role as Role) || null,
                assignedRoles: redAssignedRoles,
              });

              redAssignedRoles.push(roleResult.role);

              // Track confidence stats
              if (roleResult.confidence > 0.9) roleInferenceStats.high++;
              else if (roleResult.confidence >= 0.5) roleInferenceStats.medium++;
              else roleInferenceStats.low++;

              // Create champion pick
              const pickData: ChampionPickInsert = {
                draft_id: dbDraftId,
                player_id: dbPlayerId,
                team_side: 'red' as TeamSide,
                champion_name: player.characterName,
                role: roleResult.role,
                role_confidence: roleResult.confidence,
                pick_order: i + 1,
              };

              const { error: pickError } = await supabase
                .from('champion_picks')
                .insert(pickData);

              if (pickError) {
                console.error('Failed to insert champion pick:', pickError);
              } else {
                picksProcessed++;
              }
            }
          }
        }

        gamesProcessed++;
      } catch (error) {
        console.error(`Error processing game ${game.id}:`, error);
        // Continue processing other games
      }
    }

    // Mark checkpoint as completed
    await markCompleted(supabase, {
      jobType: 'drafts',
      entityId: seriesId,
    });

    // Return summary
    const summary = {
      success: true,
      seriesId,
      gamesProcessed,
      picksProcessed,
      roleInference: roleInferenceStats,
      message: `Processed ${gamesProcessed} games, ${picksProcessed} picks`,
    };

    console.log('Draft ETL complete:', summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Draft ETL error:', error);

    // Mark checkpoint as failed
    const body = await req.json().catch(() => ({}));
    if (body.seriesId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      db: { schema: 'synapse' },
    });

      await markFailed(supabase, {
        jobType: 'drafts',
        entityId: body.seriesId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

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
