import { NextRequest, NextResponse } from 'next/server'
import { createPostgresClient } from '@/lib/supabase/client'
import { queryMultiKillRounds } from '@/lib/analytics/queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { InsightResponse, MultiKillData } from '@/lib/analytics/types'

export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  const sql = createPostgresClient()

  try {
    const { playerId } = params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    // Query multi-kill rounds data
    const row = await queryMultiKillRounds(sql, playerId, tournamentId || undefined)

    const totalRounds = parseInt(row.total_rounds)
    const totalKills = parseInt(row.total_kills)
    const twoPlusKills = parseInt(row.two_plus_kills)
    const threePlusKills = parseInt(row.three_plus_kills)
    const fourPlusKills = parseInt(row.four_plus_kills)
    const aces = parseInt(row.aces)
    const killsPerRound = totalRounds > 0 ? totalKills / totalRounds : 0

    const data: MultiKillData = {
      two_plus_kills: twoPlusKills,
      three_plus_kills: threePlusKills,
      four_plus_kills: fourPlusKills,
      aces,
      total_rounds: totalRounds,
      kills_per_round: killsPerRound,
    }

    const confidence = calculateConfidence(totalRounds, "rounds")

    let insight = ""
    let recommendation: string | null = null

    const multiKillRate = totalRounds > 0 ? twoPlusKills / totalRounds : 0

    if (aces > 0) {
      insight = `Delivered ${aces} ace${aces > 1 ? 's' : ''} with ${(multiKillRate * 100).toFixed(1)}% multi-kill rate.`
      recommendation = null
    } else if (multiKillRate > 0.4) {
      insight = "High impact player with frequent multi-kills."
      recommendation = null
    } else if (multiKillRate > 0.25) {
      insight = "Solid multi-kill frequency."
      recommendation = null
    } else {
      insight = "Low multi-kill frequency."
      recommendation = "Focus on positioning to secure multiple kills per round."
    }

    const response: InsightResponse<MultiKillData> = {
      player_id: playerId,
      metric: "multi_kill",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching multi-kill rounds:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await sql.end()
  }
}
