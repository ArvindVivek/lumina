import { NextRequest, NextResponse } from 'next/server'
import { openingDuelsInsight } from '@/lib/analytics/player-insights'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await openingDuelsInsight(playerId, searchParams.get('tournament_id')))
  } catch (error) {
    console.error('Error fetching opening duels:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
