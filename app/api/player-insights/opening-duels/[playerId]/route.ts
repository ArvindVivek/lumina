import { NextRequest, NextResponse } from 'next/server'

import { queryOpeningDuels } from '@/lib/analytics/queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { InsightResponse, OpeningDuelsData } from '@/lib/analytics/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {

  try {
    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    // Query opening duels data
    const row = await queryOpeningDuels(playerId, tournamentId || undefined)

    // Handle null/NaN values properly
    const totalRounds = parseInt(row.total_rounds) || 0
    const firstKills = parseInt(row.first_kills) || 0
    const firstDeaths = parseInt(row.first_deaths) || 0
    const openingDuels = firstKills + firstDeaths
    const openingDuelRate = totalRounds > 0 ? openingDuels / totalRounds : 0
    const successRate = openingDuels > 0 ? firstKills / openingDuels : 0

    // Don't return a card if there's no data
    if (totalRounds === 0) {
      return NextResponse.json(null)
    }

    const data: OpeningDuelsData = {
      first_kills: firstKills,
      first_deaths: firstDeaths,
      total_rounds: totalRounds,
      opening_duel_rate: openingDuelRate,
      success_rate: successRate,
    }

    const confidence = calculateConfidence(openingDuels, "opening duels")

    let insight = ""
    let recommendation: string | null = null

    if (successRate > 0.6) {
      insight = "Dominant opening duelist with high success rate."
      recommendation = null
    } else if (successRate > 0.5) {
      insight = "Solid opening duel performance."
      recommendation = null
    } else if (successRate > 0.4) {
      insight = "Below average opening duel success."
      recommendation = "Practice crosshair placement and pre-aiming common angles."
    } else {
      insight = "Struggles in opening duels."
      recommendation = "Consider adjusting role or reviewing VODs to improve aim and positioning."
    }

    const response: InsightResponse<OpeningDuelsData> = {
      player_id: playerId,
      metric: "opening_duels",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching opening duels:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
