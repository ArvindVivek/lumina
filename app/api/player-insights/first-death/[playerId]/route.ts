import { NextRequest, NextResponse } from 'next/server'

import { queryFirstDeathImpact } from '@/lib/analytics/queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { InsightResponse, FirstDeathData } from '@/lib/analytics/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {

  try {
    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    // Query first death impact data
    const row = await queryFirstDeathImpact(playerId, tournamentId || undefined)

    // Handle null/NaN values properly
    const total = parseInt(row.total) || 0
    const losses = parseInt(row.losses) || 0
    const lossRate = total > 0 ? losses / total : 0

    // Don't return a card if there's no data
    if (total === 0) {
      return NextResponse.json(null)
    }

    const data: FirstDeathData = {
      losses,
      total,
      loss_rate: lossRate,
    }

    const confidence = calculateConfidence(total, "rounds")

    let insight = ""
    let recommendation: string | null = null

    if (lossRate > 0.75) {
      insight = "Critical issue: Dying first without contributing leads to round losses."
      recommendation = "Focus on positioning and avoid unnecessary early engagements."
    } else if (lossRate > 0.5) {
      insight = "Moderate impact: First deaths correlate with round losses."
      recommendation = "Review positioning to minimize valueless first deaths."
    } else {
      insight = "Low impact: Team can often recover from player's first deaths."
      recommendation = null
    }

    const response: InsightResponse<FirstDeathData> = {
      player_id: playerId,
      metric: "first_death_impact",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching first death impact:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
