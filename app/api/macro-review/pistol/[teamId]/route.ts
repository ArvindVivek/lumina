import { NextRequest, NextResponse } from 'next/server'
import { createPostgresClient } from '@/lib/supabase/client'
import { queryPistolAnalysis } from '@/lib/analytics/macro-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { MacroInsightResponse, PistolAnalysisData } from '@/lib/analytics/macro-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const sql = createPostgresClient()

  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    const row = await queryPistolAnalysis(sql, teamId, tournamentId || undefined)

    const pistolRounds = parseInt(row.pistol_rounds)
    const pistolWins = parseInt(row.pistol_wins)
    const bonusWins = parseInt(row.bonus_wins)
    const bonusRounds = parseInt(row.total_bonus_rounds)
    const pistolWinRate = parseFloat(row.pistol_win_rate) / 100
    const conversionRate = bonusRounds > 0 ? bonusWins / bonusRounds : 0

    const data: PistolAnalysisData = {
      pistol_rounds: pistolRounds,
      pistol_wins: pistolWins,
      pistol_win_rate: pistolWinRate,
      bonus_wins: bonusWins,
      bonus_rounds: bonusRounds,
      conversion_rate: conversionRate,
    }

    const confidence = calculateConfidence(pistolRounds, "rounds")

    let insight = ""
    let recommendation: string | null = null

    if (pistolWinRate > 0.6) {
      insight = "Strong pistol round performance sets up early momentum."
      recommendation = null
    } else if (pistolWinRate < 0.4) {
      insight = "Pistol rounds need improvement. Early losses hurt economy and momentum."
      recommendation = "Focus on team composition and positioning for pistol rounds. Review default setups and ensure coordinated execution."
    } else {
      insight = "Average pistol round performance with room for improvement."
      recommendation = "Review winning pistol rounds to identify successful patterns."
    }

    const response: MacroInsightResponse<PistolAnalysisData> = {
      team_id: teamId,
      metric: "pistol_round_analysis",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching pistol analysis:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await sql.end()
  }
}
