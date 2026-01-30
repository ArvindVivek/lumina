import { NextRequest, NextResponse } from 'next/server'
import { createPostgresClient } from '@/lib/supabase/client'
import { queryEcoRoundPerformance } from '@/lib/analytics/queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { InsightResponse, EcoRoundData, PhaseStats } from '@/lib/analytics/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const sql = createPostgresClient()

  try {
    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    // Query eco round performance data
    const rows = await queryEcoRoundPerformance(sql, playerId, tournamentId || undefined)

    const phases: Record<string, PhaseStats> = {}
    let totalRounds = 0

    rows.forEach(row => {
      const rounds = parseInt(row.rounds)
      const totalKills = parseInt(row.total_kills)
      const totalDeaths = parseInt(row.total_deaths)
      const roundsWon = parseInt(row.rounds_won)

      totalRounds += rounds

      const kdRatio = totalDeaths > 0 ? totalKills / totalDeaths : totalKills
      const winRate = rounds > 0 ? roundsWon / rounds : 0

      phases[row.phase] = {
        rounds,
        kd_ratio: kdRatio,
        win_rate: winRate,
      }
    })

    const data: EcoRoundData = {
      phases,
      total_rounds: totalRounds,
    }

    const confidence = calculateConfidence(totalRounds, "rounds")

    let insight = ""
    let recommendation: string | null = null

    const phaseEntries = Object.entries(phases)
    if (phaseEntries.length === 0) {
      insight = "No phase data available."
      recommendation = null
    } else {
      const bestPhase = phaseEntries.reduce((a, b) => a[1].win_rate > b[1].win_rate ? a : b)
      const worstPhase = phaseEntries.reduce((a, b) => a[1].win_rate < b[1].win_rate ? a : b)

      insight = `Best in ${bestPhase[0]} (${(bestPhase[1].win_rate * 100).toFixed(1)}% WR), struggles in ${worstPhase[0]} (${(worstPhase[1].win_rate * 100).toFixed(1)}% WR).`

      if (worstPhase[1].win_rate < 0.4) {
        recommendation = `Focus on improving ${worstPhase[0]} round strategy and economy management.`
      } else {
        recommendation = null
      }
    }

    const response: InsightResponse<EcoRoundData> = {
      player_id: playerId,
      metric: "eco_round_performance",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching eco round performance:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await sql.end()
  }
}
