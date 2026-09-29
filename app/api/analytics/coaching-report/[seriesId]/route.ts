import { NextRequest, NextResponse } from 'next/server'
import { buildCoachingReport } from '@/lib/analytics/coaching-report'
import { generateMatchReview } from '@/lib/llm/analyst'
import { checkAiLimit } from '@/lib/llm/limits'
import type { CoachingReportResponse } from '@/lib/analytics/coaching-types'

export const maxDuration = 30

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const startTime = Date.now()
  try {
    const { seriesId } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('team_focus')
    if (!teamId) {
      return NextResponse.json({ error: 'team_focus query parameter is required' }, { status: 400 })
    }

    const built = await buildCoachingReport(seriesId, teamId)
    if (!built) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 })
    }

    const response: CoachingReportResponse & { llm_analysis?: string; llm_source?: 'ai' | 'fallback' } = {
      report: built.report,
      meta: {
        rounds_analyzed: built.summary.total_rounds,
        players_analyzed: built.openingDuels.length,
        processing_time_ms: Date.now() - startTime,
      },
    }

    // AI write-up only when asked for (a button), rate-limited, with a written fallback.
    if (searchParams.get('include_llm') === 'true') {
      const limited = checkAiLimit(request)
      if (limited) return limited
      const ai = await generateMatchReview(built.summary, built.mapMetrics, built.openingDuels, built.antiStratSignals, built.forcedMistakes)
      response.llm_analysis = ai.analysis
      response.llm_source = ai.source
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error generating coaching report:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
