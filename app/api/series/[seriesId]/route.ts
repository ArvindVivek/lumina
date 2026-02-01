import { NextRequest, NextResponse } from 'next/server'
import { getPostgresPool } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const sql = getPostgresPool()

  try {
    const { seriesId } = await params

    const result = await sql`
      SELECT
        s.id,
        s.tournament_id,
        s.start_time,
        s.format,
        s.team_a_id,
        s.team_b_id,
        s.winner_id,
        s.processed,
        ta.name as team_a_name,
        tb.name as team_b_name,
        t.name as tournament_name
      FROM public.series s
      JOIN public.teams ta ON s.team_a_id = ta.id
      JOIN public.teams tb ON s.team_b_id = tb.id
      LEFT JOIN public.tournaments t ON s.tournament_id = t.id
      WHERE s.id = ${seriesId}
    `

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Series not found' },
        { status: 404 }
      )
    }

    const row = result[0]
    return NextResponse.json({
      id: row.id,
      tournament_id: row.tournament_id,
      start_time: row.start_time,
      format: row.format,
      team_a_id: row.team_a_id,
      team_b_id: row.team_b_id,
      team_a_name: row.team_a_name,
      team_b_name: row.team_b_name,
      winner_id: row.winner_id,
      processed: row.processed,
      tournament_name: row.tournament_name || 'Unknown Tournament',
    })
  } catch (error) {
    console.error('Error fetching series:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
