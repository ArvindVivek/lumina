import { NextRequest, NextResponse } from 'next/server'
import { getPostgresPool } from '@/lib/supabase/server'
import { queryTradeDiscipline } from '@/lib/analytics/macro-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { MacroInsightResponse, TradeDisciplineData } from '@/lib/analytics/macro-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const sql = getPostgresPool()

  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    const row = await queryTradeDiscipline(sql, teamId, tournamentId || undefined)

    const totalDeaths = parseInt(row.total_deaths)
    const tradedDeaths = parseInt(row.traded_deaths)
    const firstDeaths = parseInt(row.first_deaths)
    const firstDeathsTraded = parseInt(row.first_deaths_traded)
    const overallTradeRate = parseFloat(row.overall_trade_rate) / 100
    const firstDeathTradeRate = parseFloat(row.first_death_trade_rate) / 100

    const data: TradeDisciplineData = {
      total_deaths: totalDeaths,
      traded_deaths: tradedDeaths,
      first_deaths: firstDeaths,
      first_deaths_traded: firstDeathsTraded,
      overall_trade_rate: overallTradeRate,
      first_death_trade_rate: firstDeathTradeRate,
    }

    const confidence = calculateConfidence(firstDeaths, "rounds")

    let insight = ""
    let recommendation: string | null = null

    if (firstDeathTradeRate > 0.7) {
      insight = "Good trading discipline. Team consistently trades out deaths."
      recommendation = null
    } else if (firstDeathTradeRate < 0.5) {
      insight = "Poor trading discipline. Deaths going untraded, losing man advantage."
      recommendation = "Practice crossfire setups and trade positioning. Review VODs to identify when players are dying isolated."
    } else {
      insight = "Average trading discipline with room for improvement."
      recommendation = "Focus on maintaining crossfire angles and ensuring teammates are positioned to trade."
    }

    const response: MacroInsightResponse<TradeDisciplineData> = {
      team_id: teamId,
      metric: "trade_discipline",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching trade discipline:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
