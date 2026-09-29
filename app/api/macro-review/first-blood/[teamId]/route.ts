import { NextRequest, NextResponse } from 'next/server'
import { firstBloodInsight } from '@/lib/analytics/macro-insights'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await firstBloodInsight(teamId, searchParams.get('tournament_id')))
  } catch (error) {
    console.error('Error fetching first blood:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
