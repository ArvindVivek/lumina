import { NextRequest, NextResponse } from 'next/server'

import { queryRoundBreakdown } from '@/lib/analytics/macro-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { MacroInsightResponse, RoundBreakdownData } from '@/lib/analytics/macro-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {

  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')
    const gameId = searchParams.get('game_id')

    const rows = await queryRoundBreakdown(
      teamId,
      gameId || undefined,
      tournamentId || undefined
    )

    const rounds = rows.map(row => {
      const teamLoadoutValue = parseInt(row.team_loadout_value)
      const isWin = row.winning_team_id === teamId
      const economyType = teamLoadoutValue >= 20000
        ? 'full_buy'
        : teamLoadoutValue >= 10000
        ? 'force_buy'
        : 'eco'

      const roundData: RoundBreakdownData & {
        is_win: boolean
        economy_type: string
        team_a_alive: number
        team_b_alive: number
      } = {
        round_id: row.round_id,
        round_number: parseInt(row.round_number),
        game_id: row.game_id,
        map_name: row.map_name,
        winning_team_id: row.winning_team_id,
        first_blood_team_id: row.first_blood_team_id,
        spike_planted: row.spike_planted === 'true' || row.spike_planted === 't',
        spike_defused: row.spike_defused === 'true' || row.spike_defused === 't',
        team_loadout_value: teamLoadoutValue,
        opponent_loadout_value: parseInt(row.opponent_loadout_value),
        duration_ms: parseInt(row.duration_ms),
        is_win: isWin,
        economy_type: economyType,
        team_a_alive: parseInt(row.team_a_alive),
        team_b_alive: parseInt(row.team_b_alive),
      }

      return roundData
    })

    const totalRounds = rounds.length
    const wins = rounds.filter(r => r.is_win).length
    const winRate = totalRounds > 0 ? (wins / totalRounds) * 100 : 0

    const confidence = calculateConfidence(totalRounds, "rounds")

    const insight = `Win rate: ${winRate.toFixed(1)}% across ${totalRounds} rounds`
    const recommendation = null // This is raw data for display, no recommendations

    const response: MacroInsightResponse<{
      rounds: (RoundBreakdownData & { is_win: boolean; economy_type: string })[]
      total_rounds: number
      wins: number
    }> = {
      team_id: teamId,
      metric: "round_breakdown",
      data: {
        rounds,
        total_rounds: totalRounds,
        wins,
      },
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching round breakdown:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
