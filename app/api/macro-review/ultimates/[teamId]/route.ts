import { NextRequest, NextResponse } from 'next/server'
import { createPostgresClient } from '@/lib/supabase/client'
import { queryUltimateEconomy } from '@/lib/analytics/macro-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { MacroInsightResponse, UltimateEconomyData } from '@/lib/analytics/macro-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const sql = createPostgresClient()

  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    const row = await queryUltimateEconomy(sql, teamId, tournamentId || undefined)

    const totalRounds = parseInt(row.total_rounds)
    const ultimatesUsed = parseInt(row.ultimates_used)
    const usageRate = parseFloat(row.usage_rate)
    const roundsWithUltAvailable = parseInt(row.rounds_with_ult_available)
    const ultAvailabilityWinRate = parseFloat(row.ult_availability_win_rate)

    const data: UltimateEconomyData = {
      total_rounds: totalRounds,
      ultimates_used: ultimatesUsed,
      usage_rate: usageRate,
      rounds_with_ult_available: roundsWithUltAvailable,
      ult_availability_win_rate: ultAvailabilityWinRate,
    }

    const confidence = calculateConfidence(roundsWithUltAvailable, "rounds")

    let insight = ""
    let recommendation: string | null = null

    if (usageRate > 0.8) {
      insight = "Efficient ultimate usage. Team uses ultimates when available."
      recommendation = null
    } else if (usageRate < 0.5) {
      insight = "Low ultimate usage rate. Ultimates being held or not charged effectively."
      recommendation = "Use ultimates when available in crucial rounds. Holding ultimates too long loses potential impact."
    } else {
      insight = "Average ultimate usage with room for optimization."
      recommendation = "Review ultimate economy. Ensure high-impact ultimates are used in key rounds."
    }

    if (ultAvailabilityWinRate > 0.6) {
      insight += ` Strong win rate (${(ultAvailabilityWinRate * 100).toFixed(1)}%) when ultimates are available.`
    } else if (ultAvailabilityWinRate < 0.4) {
      insight += ` Low win rate (${(ultAvailabilityWinRate * 100).toFixed(1)}%) despite ultimate availability suggests poor usage timing.`
    }

    const response: MacroInsightResponse<UltimateEconomyData> = {
      team_id: teamId,
      metric: "ultimate_economy",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching ultimate economy:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await sql.end()
  }
}
