import { NextRequest, NextResponse } from 'next/server'
import { createPostgresClient } from '@/lib/supabase/client'
import { queryRoundsForCriticalMoments } from '@/lib/analytics/macro-queries'
import { classifyRoundsAsCriticalMoments } from '@/lib/analytics/priority-classifier'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { MacroInsightResponse, CriticalMoment } from '@/lib/analytics/macro-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const sql = createPostgresClient()

  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')
    const gameId = searchParams.get('game_id')
    const priorityFilter = searchParams.get('priority')

    const rounds = await queryRoundsForCriticalMoments(
      sql,
      teamId,
      gameId || undefined,
      tournamentId || undefined
    )

    const criticalMoments = classifyRoundsAsCriticalMoments(rounds, teamId)

    // Optional priority filter
    const filtered = priorityFilter
      ? criticalMoments.filter(m => m.priority === priorityFilter.toUpperCase())
      : criticalMoments

    const highCount = criticalMoments.filter(m => m.priority === 'HIGH').length
    const mediumCount = criticalMoments.filter(m => m.priority === 'MEDIUM').length
    const lowCount = criticalMoments.filter(m => m.priority === 'LOW').length

    const confidence = calculateConfidence(rounds.length, "rounds")

    let insight = ""
    if (highCount > 0) {
      insight = `Found ${highCount} high-priority critical moments requiring immediate review.`
    } else if (mediumCount > 0) {
      insight = `Found ${mediumCount} medium-priority moments and ${lowCount} low-priority moments.`
    } else if (lowCount > 0) {
      insight = `Found ${lowCount} low-priority moments. No high-impact critical moments detected.`
    } else {
      insight = "No critical moments detected in analyzed rounds."
    }

    const recommendation = highCount > 0
      ? `Review ${highCount} high-priority moments for VOD analysis. Focus on pistol losses, eco wins, and close rounds.`
      : null

    const response: MacroInsightResponse<{
      moments: CriticalMoment[]
      counts: { high: number; medium: number; low: number }
    }> = {
      team_id: teamId,
      metric: "critical_moments",
      data: {
        moments: filtered,
        counts: { high: highCount, medium: mediumCount, low: lowCount },
      },
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching critical moments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await sql.end()
  }
}
