import { NextRequest, NextResponse } from 'next/server'

import { queryOpeningDuelsByPlayer } from '@/lib/analytics/macro-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { MacroInsightResponse, PlayerOpeningDuelsData } from '@/lib/analytics/macro-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {

  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    const rows = await queryOpeningDuelsByPlayer(teamId, tournamentId || undefined)

    const players: PlayerOpeningDuelsData[] = rows.map(row => {
      const firstKills = parseInt(row.first_kills)
      const firstDeaths = parseInt(row.first_deaths)
      const totalRounds = parseInt(row.total_rounds)
      const openingDuelRate = totalRounds > 0 ? (firstKills + firstDeaths) / totalRounds : 0
      const successRate = (firstKills + firstDeaths) > 0 ? firstKills / (firstKills + firstDeaths) : 0

      return {
        player_id: row.player_id,
        player_name: row.player_id, // TODO: Join with players table for actual name
        first_kills: firstKills,
        first_deaths: firstDeaths,
        opening_duel_rate: openingDuelRate,
        success_rate: successRate,
      }
    })

    const totalRounds = players.length > 0 ? parseInt(rows[0].total_rounds) : 0
    const confidence = calculateConfidence(totalRounds, "rounds")

    let insight = ""
    if (players.length > 0) {
      const bestPlayer = players.reduce((prev, curr) =>
        curr.success_rate > prev.success_rate ? curr : prev
      )
      const worstPlayer = players.reduce((prev, curr) =>
        curr.success_rate < prev.success_rate ? curr : prev
      )

      insight = `Best opening duelist: ${bestPlayer.player_name} (${(bestPlayer.success_rate * 100).toFixed(1)}% success). Needs improvement: ${worstPlayer.player_name} (${(worstPlayer.success_rate * 100).toFixed(1)}%).`
    } else {
      insight = "No opening duel data available."
    }

    const response: MacroInsightResponse<{ players: PlayerOpeningDuelsData[] }> = {
      team_id: teamId,
      metric: "opening_duels_by_player",
      data: { players },
      insight,
      recommendation: null, // Player-specific, no team-level recommendation
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching opening duels:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
