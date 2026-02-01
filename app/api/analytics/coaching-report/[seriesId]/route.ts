import { NextRequest, NextResponse } from 'next/server'
import { getPostgresPool } from '@/lib/supabase/server'
import {
  querySeriesSummary,
  queryMapMetrics,
  queryPlayerOpeningDuels,
  queryRoundsForReview,
  detectAntiStratSignals,
  detectForcedMistakes,
} from '@/lib/analytics/coaching-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import { generateMatchReview, isLLMAvailable } from '@/lib/llm/analyst'
import type { CoachingReport, CoachingReportResponse, ActionPlan, VODReviewNote } from '@/lib/analytics/coaching-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const sql = getPostgresPool()
  const startTime = Date.now()

  try {
    const { seriesId } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('team_focus')

    if (!teamId) {
      return NextResponse.json(
        { error: 'team_focus query parameter is required' },
        { status: 400 }
      )
    }

    // Fetch all data in parallel
    const [
      summary,
      mapMetrics,
      openingDuels,
      roundsForReview,
      antiStratSignals,
      forcedMistakes,
    ] = await Promise.all([
      querySeriesSummary(sql, seriesId, teamId),
      queryMapMetrics(sql, seriesId, teamId),
      queryPlayerOpeningDuels(sql, seriesId, teamId),
      queryRoundsForReview(sql, seriesId, teamId),
      detectAntiStratSignals(sql, seriesId, teamId),
      detectForcedMistakes(sql, seriesId, teamId),
    ])

    if (!summary) {
      return NextResponse.json(
        { error: 'Series not found' },
        { status: 404 }
      )
    }

    // Analyze strengths and weaknesses
    const avgFBConversion = mapMetrics.reduce((sum, m) => sum + m.fb_conversion_rate, 0) / mapMetrics.length
    const avgTradeRate = mapMetrics.reduce((sum, m) => sum + m.trade_rate, 0) / mapMetrics.length
    const totalUntraded = mapMetrics.reduce((sum, m) => sum + m.untraded_deaths, 0)

    // Set key insights
    if (avgFBConversion > 0.65) {
      summary.key_strength = 'Strong first blood conversion, capitalizing on early picks'
    } else if (avgTradeRate > 0.5) {
      summary.key_strength = 'Good trading discipline, maintaining numbers advantage'
    } else {
      summary.key_strength = openingDuels[0]
        ? `${openingDuels[0].player_name} winning opening duels (+${openingDuels[0].net})`
        : 'Competitive performance across all metrics'
    }

    if (totalUntraded > 15) {
      summary.key_weakness = `High untraded deaths (${totalUntraded}) - positioning issues`
    } else if (avgFBConversion < 0.55) {
      summary.key_weakness = 'Struggling to convert first blood into round wins'
    } else if (forcedMistakes.length > 0) {
      summary.key_weakness = forcedMistakes[0].mistake
    } else {
      summary.key_weakness = 'No critical weaknesses identified'
    }

    // Build VOD review notes (top 20 priority rounds)
    const priorityRounds = roundsForReview
      .filter(r => r.review_priority !== 'skip')
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, skip: 4 }
        return priorityOrder[a.review_priority] - priorityOrder[b.review_priority]
      })
      .slice(0, 20)

    const vodReviewNotes: VODReviewNote[] = priorityRounds.map(r => ({
      game_number: 1, // Would need game sequence mapping
      map_name: r.map_name,
      round_number: r.round_number,
      reason: r.priority_reason,
      fb_time_ms: r.first_blood?.time_ms || null,
      review_priority: r.review_priority as 'critical' | 'high' | 'medium' | 'low',
    }))

    // Build action plan
    const actionPlan: ActionPlan = {
      immediate: [],
      medium_term: [],
    }

    // Immediate actions from forced mistakes
    for (const mistake of forcedMistakes) {
      actionPlan.immediate.push({
        action: mistake.fix,
        context: mistake.detail,
        priority: mistake.severity === 'critical' ? 'high' : 'medium',
      })
    }

    // Add anti-strat defense
    for (const signal of antiStratSignals) {
      actionPlan.medium_term.push({
        action: signal.implication,
        context: signal.signal,
        priority: signal.severity === 'critical' ? 'high' : 'medium',
      })
    }

    // Generate LLM analysis if available
    let llmAnalysis: string | undefined
    if (isLLMAvailable() && searchParams.get('include_llm') === 'true') {
      try {
        const llmResult = await generateMatchReview(
          summary,
          mapMetrics,
          openingDuels,
          antiStratSignals,
          forcedMistakes
        )
        llmAnalysis = llmResult.analysis
      } catch {
        // LLM analysis failed, continue without it
      }
    }

    const confidence = calculateConfidence(summary.total_rounds, 'rounds')

    const report: CoachingReport = {
      generated_at: new Date().toISOString(),
      series_id: seriesId,
      team_focus: teamId,
      summary,
      key_metrics: mapMetrics,
      opening_duels: openingDuels,
      anti_strat_signals: antiStratSignals,
      forced_mistakes: forcedMistakes,
      vod_review_notes: vodReviewNotes,
      action_plan: actionPlan,
      confidence,
    }

    const response: CoachingReportResponse & { llm_analysis?: string } = {
      report,
      meta: {
        rounds_analyzed: summary.total_rounds,
        players_analyzed: openingDuels.length,
        processing_time_ms: Date.now() - startTime,
      },
    }

    if (llmAnalysis) {
      response.llm_analysis = llmAnalysis
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error generating coaching report:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
