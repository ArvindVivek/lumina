import { NextResponse } from 'next/server'
import { getPostgresPool } from '@/lib/supabase/server'

export async function GET() {
  const sql = getPostgresPool()

  try {
    // Fetch all counts in parallel
    const [
      tournamentsResult,
      teamsResult,
      playersResult,
      seriesResult,
      gamesResult,
      roundsResult,
      killEventsResult,
      clutchSituationsResult
    ] = await Promise.all([
      sql`SELECT COUNT(*)::int as count FROM public.tournaments`,
      sql`SELECT COUNT(*)::int as count FROM public.teams`,
      sql`SELECT COUNT(*)::int as count FROM public.players`,
      sql`SELECT COUNT(*)::int as count FROM public.series WHERE processed = true`,
      sql`SELECT COUNT(*)::int as count FROM public.games`,
      sql`SELECT COUNT(*)::int as count FROM public.rounds`,
      sql`SELECT COUNT(*)::int as count FROM public.kill_events`,
      sql`SELECT COUNT(*)::int as count FROM public.player_round_stats WHERE clutch_situation = true`
    ])

    return NextResponse.json({
      tournaments: tournamentsResult[0]?.count || 0,
      teams: teamsResult[0]?.count || 0,
      players: playersResult[0]?.count || 0,
      series: seriesResult[0]?.count || 0,
      games: gamesResult[0]?.count || 0,
      rounds: roundsResult[0]?.count || 0,
      killEvents: killEventsResult[0]?.count || 0,
      clutchSituations: clutchSituationsResult[0]?.count || 0
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
