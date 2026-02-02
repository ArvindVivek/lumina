import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const supabase = createServerClient()

  try {
    const { seriesId } = await params

    const { data: result, error } = await supabase
      .from('series')
      .select(`
        id,
        tournament_id,
        start_time,
        format,
        team_a_id,
        team_b_id,
        winner_id,
        processed,
        team_a:teams!series_team_a_id_fkey(name),
        team_b:teams!series_team_b_id_fkey(name),
        tournament:tournaments(name)
      `)
      .eq('id', seriesId)
      .single()

    if (error || !result) {
      return NextResponse.json(
        { error: 'Series not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: result.id,
      tournament_id: result.tournament_id,
      start_time: result.start_time,
      format: result.format,
      team_a_id: result.team_a_id,
      team_b_id: result.team_b_id,
      team_a_name: (result.team_a as unknown as { name: string } | null)?.name || 'Unknown',
      team_b_name: (result.team_b as unknown as { name: string } | null)?.name || 'Unknown',
      winner_id: result.winner_id,
      processed: result.processed,
      tournament_name: (result.tournament as unknown as { name: string } | null)?.name || 'Unknown Tournament',
    })
  } catch (error) {
    console.error('Error fetching series:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
