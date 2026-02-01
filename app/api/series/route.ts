import { NextRequest, NextResponse } from 'next/server'
import { getPostgresPool } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const sql = getPostgresPool()

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const tournamentId = searchParams.get('tournament_id')

    const result = await sql`
      SELECT
        s.id,
        s.tournament_id,
        s.start_time,
        s.format,
        s.team_a_id,
        s.team_b_id,
        s.winner_id,
        ta.name as team_a_name,
        tb.name as team_b_name,
        t.name as tournament_name
      FROM public.series s
      JOIN public.teams ta ON s.team_a_id = ta.id
      JOIN public.teams tb ON s.team_b_id = tb.id
      LEFT JOIN public.tournaments t ON s.tournament_id = t.id
      WHERE s.processed = true
        ${tournamentId ? sql`AND s.tournament_id = ${tournamentId}` : sql``}
      ORDER BY s.start_time DESC
      LIMIT ${limit}
    `

    return NextResponse.json({
      series: result.map(row => ({
        id: row.id,
        start_time: row.start_time,
        format: row.format,
        team_a_id: row.team_a_id,
        team_b_id: row.team_b_id,
        team_a_name: row.team_a_name,
        team_b_name: row.team_b_name,
        winner_id: row.winner_id,
        tournament_id: row.tournament_id,
        tournament_name: row.tournament_name || 'Unknown Tournament',
      })),
    })
  } catch (error) {
    console.error('Error fetching series:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
