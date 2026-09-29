import { NextRequest, NextResponse } from 'next/server'
import { clutchInsight } from '@/lib/analytics/player-insights'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await clutchInsight(playerId, searchParams.get('tournament_id')))
  } catch (error) {
    console.error('Error fetching clutch:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
