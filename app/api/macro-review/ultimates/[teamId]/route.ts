import { NextRequest, NextResponse } from 'next/server'
import { ultimatesInsight } from '@/lib/analytics/macro-insights'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    return NextResponse.json(await ultimatesInsight(teamId, searchParams.get('tournament_id')))
  } catch (error) {
    console.error('Error fetching ultimates:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
