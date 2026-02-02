import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const supabase = createServerClient()

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const tournamentId = searchParams.get('tournament_id')

    // Build query
    let query = supabase
      .from('series')
      .select(`
        id,
        tournament_id,
        start_time,
        format,
        team_a_id,
        team_b_id,
        winner_id,
        team_a:teams!series_team_a_id_fkey(name),
        team_b:teams!series_team_b_id_fkey(name),
        tournament:tournaments(name)
      `)
      .eq('processed', true)
      .order('start_time', { ascending: false })
      .limit(limit)

    if (tournamentId) {
      query = query.eq('tournament_id', tournamentId)
    }

    const { data: result, error } = await query

    if (error) throw error

    return NextResponse.json({
      series: (result || []).map(row => ({
        id: row.id,
        start_time: row.start_time,
        format: row.format,
        team_a_id: row.team_a_id,
        team_b_id: row.team_b_id,
        team_a_name: (row.team_a as unknown as { name: string } | null)?.name || 'Unknown',
        team_b_name: (row.team_b as unknown as { name: string } | null)?.name || 'Unknown',
        winner_id: row.winner_id,
        tournament_id: row.tournament_id,
        tournament_name: (row.tournament as unknown as { name: string } | null)?.name || 'Unknown Tournament',
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
