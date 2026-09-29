import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/data'
import { listSeries } from '@/lib/data/queries'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '20') || 20, 1), 100)
    const series = listSeries(getDb(), {
      limit,
      tournamentId: searchParams.get('tournament_id'),
      teamId: searchParams.get('team_id'),
    })
    return NextResponse.json({ series })
  } catch (error) {
    console.error('Error fetching series:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
