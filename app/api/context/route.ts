import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

// Fetch rich context data for a given page
export async function GET(request: NextRequest) {
  const supabase = createServerClient()

  try {
    const { searchParams } = new URL(request.url)
    const page = searchParams.get('page')
    const tournamentId = searchParams.get('tournamentId')
    const seriesId = searchParams.get('seriesId')
    const teamId = searchParams.get('teamId')
    const playerId = searchParams.get('playerId')

    let contextData: Record<string, unknown> = {}

    // Fetch tournament context
    if (page === 'tournament' && tournamentId) {
      const { data: tournament } = await supabase
        .from('tournaments')
        .select('id, name, start_date, end_date')
        .eq('id', tournamentId)
        .single()

      const { data: series } = await supabase
        .from('series')
        .select(`
          id,
          winner_id,
          team_a:teams!series_team_a_id_fkey(name),
          team_b:teams!series_team_b_id_fkey(name)
        `)
        .eq('tournament_id', tournamentId)
        .order('start_time', { ascending: false })

      if (tournament) {
        contextData = {
          type: 'tournament',
          tournamentName: tournament.name,
          matchCount: series?.length || 0,
          matches: (series || []).map(s => ({
            teamA: (s.team_a as unknown as { name: string } | null)?.name || 'Unknown',
            teamB: (s.team_b as unknown as { name: string } | null)?.name || 'Unknown',
            completed: s.winner_id !== null
          }))
        }
      }
    }

    // Fetch series context
    if (page === 'series' && seriesId) {
      const { data: series } = await supabase
        .from('series')
        .select(`
          id,
          tournament_id,
          winner_id,
          format,
          team_a:teams!series_team_a_id_fkey(name),
          team_b:teams!series_team_b_id_fkey(name),
          tournament:tournaments(name)
        `)
        .eq('id', seriesId)
        .single()

      const { data: games } = await supabase
        .from('games')
        .select('id, map_name, team_a_score, team_b_score, winner_id')
        .eq('series_id', seriesId)
        .order('sequence_number')

      if (series) {
        contextData = {
          type: 'series',
          tournamentName: (series.tournament as unknown as { name: string } | null)?.name || 'Unknown',
          teamA: (series.team_a as unknown as { name: string } | null)?.name || 'Unknown',
          teamB: (series.team_b as unknown as { name: string } | null)?.name || 'Unknown',
          format: series.format,
          completed: series.winner_id !== null,
          games: (games || []).map(g => ({
            map: g.map_name,
            scoreA: g.team_a_score,
            scoreB: g.team_b_score,
            completed: g.winner_id !== null
          }))
        }
      }
    }

    // Fetch team context
    if (page === 'team' && teamId) {
      const { data: team } = await supabase
        .from('teams')
        .select('id, name')
        .eq('id', teamId)
        .single()

      const { data: players } = await supabase
        .from('players')
        .select('id, name')
        .eq('team_id', teamId)

      const { data: recentSeries } = await supabase
        .from('series')
        .select(`
          winner_id,
          team_a_id,
          team_b_id,
          team_a:teams!series_team_a_id_fkey(name),
          team_b:teams!series_team_b_id_fkey(name)
        `)
        .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
        .eq('processed', true)
        .order('start_time', { ascending: false })
        .limit(5)

      if (team) {
        contextData = {
          type: 'team',
          teamName: team.name,
          players: (players || []).map(p => p.name),
          recentMatches: (recentSeries || []).map(s => ({
            opponent: s.team_a_id === teamId
              ? (s.team_b as unknown as { name: string } | null)?.name || 'Unknown'
              : (s.team_a as unknown as { name: string } | null)?.name || 'Unknown',
            won: s.winner_id === teamId
          }))
        }
      }
    }

    // Fetch player context
    if (page === 'player' && playerId) {
      const { data: player } = await supabase
        .from('players')
        .select(`
          id,
          name,
          team:teams(name)
        `)
        .eq('id', playerId)
        .single()

      if (player) {
        // Get recent stats - use aggregation
        const { data: statsData } = await supabase
          .from('player_round_stats')
          .select('kills, deaths, first_kill, clutch_won')
          .eq('player_id', playerId)

        const stats = {
          rounds_played: statsData?.length || 0,
          total_kills: statsData?.reduce((sum, s) => sum + (s.kills || 0), 0) || 0,
          total_deaths: statsData?.reduce((sum, s) => sum + (s.deaths || 0), 0) || 0,
          first_kills: statsData?.filter(s => s.first_kill).length || 0,
          clutches_won: statsData?.filter(s => s.clutch_won).length || 0
        }

        contextData = {
          type: 'player',
          playerName: player.name,
          teamName: (player.team as unknown as { name: string } | null)?.name || 'Free Agent',
          stats
        }
      }
    }

    return NextResponse.json(contextData)
  } catch (error) {
    console.error('Error fetching context:', error)
    return NextResponse.json({ error: 'Failed to fetch context' }, { status: 500 })
  }
}
