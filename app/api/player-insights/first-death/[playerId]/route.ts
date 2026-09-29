import { NextRequest, NextResponse } from 'next/server'
import { firstDeathInsight } from '@/lib/analytics/player-insights'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  try {
    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await firstDeathInsight(playerId, searchParams.get('tournament_id')))
  } catch (error) {
    console.error('Error fetching first death:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
