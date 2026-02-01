import { NextRequest, NextResponse } from 'next/server'
import { getPostgresPool } from '@/lib/supabase/server'
import { queryClutchPerformance } from '@/lib/analytics/queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { InsightResponse, ClutchData } from '@/lib/analytics/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const sql = getPostgresPool()

  try {
    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    // Query clutch performance data
    const row = await queryClutchPerformance(sql, playerId, tournamentId || undefined)

    // Handle null/NaN values properly
    const clutchSituations = parseInt(row.clutch_situations) || 0
    const clutchesWon = parseInt(row.clutches_won) || 0
    const clutchRate = clutchSituations > 0 ? clutchesWon / clutchSituations : 0

    // Don't return a card if there's no clutch data
    if (clutchSituations === 0) {
      return NextResponse.json(null)
    }

    const data: ClutchData = {
      clutches_won: clutchesWon,
      clutch_situations: clutchSituations,
      clutch_rate: clutchRate,
    }

    const confidence = calculateConfidence(clutchSituations, "clutch situations")

    let insight = ""
    let recommendation: string | null = null

    if (clutchRate > 0.4) {
      insight = "Exceptional clutch player with high win rate."
      recommendation = null
    } else if (clutchRate > 0.25) {
      insight = "Above average clutch performance."
      recommendation = null
    } else if (clutchRate > 0.15) {
      insight = "Average clutch performance."
      recommendation = "Practice 1vX scenarios in deathmatch or custom games."
    } else {
      insight = "Struggles in clutch situations."
      recommendation = "Focus on positioning, utility usage, and staying calm under pressure."
    }

    const response: InsightResponse<ClutchData> = {
      player_id: playerId,
      metric: "clutch_performance",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching clutch performance:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
