import { NextRequest, NextResponse } from 'next/server'
import { getPostgresPool } from '@/lib/supabase/server'

// Fetch rich context data for a given page
export async function GET(request: NextRequest) {
  const sql = getPostgresPool()

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
      const [tournament] = await sql`
        SELECT id, name, start_date, end_date
        FROM public.tournaments
        WHERE id = ${tournamentId}
      `

      const series = await sql`
        SELECT s.id, ta.name as team_a_name, tb.name as team_b_name, s.winner_id
        FROM public.series s
        JOIN public.teams ta ON s.team_a_id = ta.id
        JOIN public.teams tb ON s.team_b_id = tb.id
        WHERE s.tournament_id = ${tournamentId}
        ORDER BY s.start_time DESC
      `

      if (tournament) {
        contextData = {
          type: 'tournament',
          tournamentName: tournament.name,
          matchCount: series.length,
          matches: series.map(s => ({
            teamA: s.team_a_name,
            teamB: s.team_b_name,
            completed: s.winner_id !== null
          }))
        }
      }
    }

    // Fetch series context
    if (page === 'series' && seriesId) {
      const [series] = await sql`
        SELECT s.id, s.tournament_id, s.winner_id, s.format,
               ta.name as team_a_name, tb.name as team_b_name,
               t.name as tournament_name
        FROM public.series s
        JOIN public.teams ta ON s.team_a_id = ta.id
        JOIN public.teams tb ON s.team_b_id = tb.id
        LEFT JOIN public.tournaments t ON s.tournament_id = t.id
        WHERE s.id = ${seriesId}
      `

      const games = await sql`
        SELECT id, map_name, team_a_score, team_b_score, winner_id
        FROM public.games
        WHERE series_id = ${seriesId}
        ORDER BY sequence_number
      `

      if (series) {
        contextData = {
          type: 'series',
          tournamentName: series.tournament_name,
          teamA: series.team_a_name,
          teamB: series.team_b_name,
          format: series.format,
          completed: series.winner_id !== null,
          games: games.map(g => ({
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
      const [team] = await sql`
        SELECT id, name FROM public.teams WHERE id = ${teamId}
      `

      const players = await sql`
        SELECT id, name FROM public.players WHERE team_id = ${teamId}
      `

      const recentSeries = await sql`
        SELECT ta.name as team_a_name, tb.name as team_b_name, s.winner_id, s.team_a_id, s.team_b_id
        FROM public.series s
        JOIN public.teams ta ON s.team_a_id = ta.id
        JOIN public.teams tb ON s.team_b_id = tb.id
        WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId}) AND s.processed = true
        ORDER BY s.start_time DESC
        LIMIT 5
      `

      if (team) {
        contextData = {
          type: 'team',
          teamName: team.name,
          players: players.map(p => p.name),
          recentMatches: recentSeries.map(s => ({
            opponent: s.team_a_id === teamId ? s.team_b_name : s.team_a_name,
            won: s.winner_id === teamId
          }))
        }
      }
    }

    // Fetch player context
    if (page === 'player' && playerId) {
      const [player] = await sql`
        SELECT p.id, p.name, t.name as team_name
        FROM public.players p
        LEFT JOIN public.teams t ON p.team_id = t.id
        WHERE p.id = ${playerId}
      `

      if (player) {
        // Get recent stats
        const stats = await sql`
          SELECT
            COUNT(*) as rounds_played,
            SUM(kills) as total_kills,
            SUM(deaths) as total_deaths,
            SUM(CASE WHEN first_kill THEN 1 ELSE 0 END) as first_kills,
            SUM(CASE WHEN clutch_won THEN 1 ELSE 0 END) as clutches_won
          FROM public.player_round_stats
          WHERE player_id = ${playerId}
        `

        contextData = {
          type: 'player',
          playerName: player.name,
          teamName: player.team_name,
          stats: stats[0] || {}
        }
      }
    }

    return NextResponse.json(contextData)
  } catch (error) {
    console.error('Error fetching context:', error)
    return NextResponse.json({ error: 'Failed to fetch context' }, { status: 500 })
  }
  // Note: No sql.end() - we use a shared connection pool
}
