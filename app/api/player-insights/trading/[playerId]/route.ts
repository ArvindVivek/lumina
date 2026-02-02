import { NextRequest, NextResponse } from 'next/server'

import { queryTradingEfficiency } from '@/lib/analytics/queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { InsightResponse, TradingData } from '@/lib/analytics/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {

  try {
    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    // Query trading efficiency data
    const row = await queryTradingEfficiency(playerId, tournamentId || undefined)

    // Handle null/NaN values properly
    const totalDeaths = parseInt(row.total_deaths) || 0
    const traded = parseInt(row.traded) || 0
    const tradeRate = totalDeaths > 0 ? traded / totalDeaths : 0

    // Don't return a card if there's no data
    if (totalDeaths === 0) {
      return NextResponse.json(null)
    }

    const data: TradingData = {
      traded,
      total_deaths: totalDeaths,
      trade_rate: tradeRate,
    }

    const confidence = calculateConfidence(totalDeaths, "deaths")

    let insight = ""
    let recommendation: string | null = null

    if (tradeRate < 0.3) {
      insight = "Low trade rate: Deaths often go unpunished."
      recommendation = "Play closer to teammates to enable trade opportunities."
    } else if (tradeRate < 0.5) {
      insight = "Below average trade rate: Room for improvement."
      recommendation = "Coordinate timing with teammates for better trading."
    } else if (tradeRate < 0.7) {
      insight = "Good trade rate: Deaths are often traded."
      recommendation = null
    } else {
      insight = "Excellent trade rate: Team consistently trades deaths."
      recommendation = null
    }

    const response: InsightResponse<TradingData> = {
      player_id: playerId,
      metric: "trading_efficiency",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching trading efficiency:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
