import { NextRequest, NextResponse } from 'next/server'
import { createPostgresClient } from '@/lib/supabase/client'
import { queryTimingPatterns } from '@/lib/analytics/macro-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { MacroInsightResponse, TimingPatternData } from '@/lib/analytics/macro-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const sql = createPostgresClient()

  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    const row = await queryTimingPatterns(sql, teamId, tournamentId || undefined)

    const avgRoundDurationMs = parseFloat(row.avg_round_duration_ms)
    const avgFirstKillTimeMs = parseFloat(row.avg_first_kill_time_ms)
    const roundsAnalyzed = parseInt(row.rounds_analyzed)

    const data: TimingPatternData = {
      avg_round_duration_ms: avgRoundDurationMs,
      avg_first_kill_time_ms: avgFirstKillTimeMs,
      rounds_analyzed: roundsAnalyzed,
    }

    const confidence = calculateConfidence(roundsAnalyzed, "rounds")

    let insight = ""
    let recommendation: string | null = null

    const avgRoundDurationSeconds = avgRoundDurationMs / 1000
    const avgFirstKillSeconds = avgFirstKillTimeMs / 1000

    if (avgRoundDurationSeconds < 90) {
      insight = "Fast round execution. Team engages early and decisively."
      recommendation = null
    } else if (avgRoundDurationSeconds > 120) {
      insight = "Slow round execution. Team takes a long time to engage or close rounds."
      recommendation = "Review round timings. Consider more decisive site executions or faster rotations."
    } else {
      insight = "Average round timing shows standard execution patterns."
      recommendation = null
    }

    if (avgFirstKillSeconds < 20) {
      insight += ` First kills happen very early (${avgFirstKillSeconds.toFixed(1)}s).`
    } else if (avgFirstKillSeconds > 40) {
      insight += ` First kills happen late (${avgFirstKillSeconds.toFixed(1)}s), suggesting passive play.`
    }

    const response: MacroInsightResponse<TimingPatternData> = {
      team_id: teamId,
      metric: "timing_patterns",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching timing patterns:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await sql.end()
  }
}
