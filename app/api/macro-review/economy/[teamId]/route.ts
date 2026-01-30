import { NextRequest, NextResponse } from 'next/server'
import { createPostgresClient } from '@/lib/supabase/client'
import { queryEconomyManagement } from '@/lib/analytics/macro-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { MacroInsightResponse, EconomyManagementData, EconomyDecisionData } from '@/lib/analytics/macro-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const sql = createPostgresClient()

  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    const rows = await queryEconomyManagement(sql, teamId, tournamentId || undefined)

    const decisions: EconomyDecisionData[] = rows.map(row => ({
      economy_decision: row.economy_decision,
      rounds: parseInt(row.rounds),
      wins: parseInt(row.wins),
      win_rate: parseFloat(row.win_rate),
      avg_loadout_value: parseFloat(row.avg_loadout_value),
    }))

    const totalRounds = decisions.reduce((sum, d) => sum + d.rounds, 0)

    const data: EconomyManagementData = {
      decisions,
      total_rounds: totalRounds,
    }

    const confidence = calculateConfidence(totalRounds, "rounds")

    let insight = ""
    let recommendation: string | null = null

    const ecoDecision = decisions.find(d => d.economy_decision === 'eco')
    const fullBuyDecision = decisions.find(d => d.economy_decision === 'full_buy')

    if (ecoDecision && fullBuyDecision) {
      const ecoWinRate = ecoDecision.win_rate
      const fullBuyWinRate = fullBuyDecision.win_rate

      if (fullBuyWinRate < 0.4) {
        insight = "Low full-buy win rate suggests mechanical or tactical issues."
        recommendation = "Review full-buy rounds for strategic errors. Consider agent composition and site execution."
      } else if (ecoWinRate > 0.25) {
        insight = "Decent eco round win rate shows good aggression in disadvantaged situations."
        recommendation = null
      } else if (ecoWinRate < 0.1) {
        insight = "Very low eco round win rate. Eco rounds offer little resistance."
        recommendation = "Review eco round strategies. Consider forcing fights in favorable positions rather than saving."
      } else {
        insight = "Economy management shows expected patterns across buy types."
        recommendation = null
      }
    } else {
      insight = "Economy data available across buy types."
      recommendation = null
    }

    const response: MacroInsightResponse<EconomyManagementData> = {
      team_id: teamId,
      metric: "economy_management",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching economy management:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await sql.end()
  }
}
