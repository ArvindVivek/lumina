import { NextRequest, NextResponse } from 'next/server'
import { createPostgresClient } from '@/lib/supabase/client'
import { queryAgentPerformance } from '@/lib/analytics/queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { InsightResponse, AgentData, AgentStats } from '@/lib/analytics/types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const sql = createPostgresClient()

  try {
    const { playerId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    // Query agent performance data
    const rows = await queryAgentPerformance(sql, playerId, tournamentId || undefined)

    let totalRounds = 0
    const agents: AgentStats[] = rows.map(row => {
      const roundsPlayed = parseInt(row.rounds_played)
      const totalKills = parseInt(row.total_kills)
      const totalDeaths = parseInt(row.total_deaths)
      const firstKills = parseInt(row.first_kills)
      const firstDeaths = parseInt(row.first_deaths)
      const roundsWon = parseInt(row.rounds_won)

      totalRounds += roundsPlayed

      const kdRatio = totalDeaths > 0 ? totalKills / totalDeaths : totalKills
      const killsPerRound = roundsPlayed > 0 ? totalKills / roundsPlayed : 0
      const firstKillRate = roundsPlayed > 0 ? firstKills / roundsPlayed : 0
      const firstDeathRate = roundsPlayed > 0 ? firstDeaths / roundsPlayed : 0
      const winRate = roundsPlayed > 0 ? roundsWon / roundsPlayed : 0

      const confidence = calculateConfidence(roundsPlayed, "rounds")

      return {
        agent: row.agent,
        rounds_played: roundsPlayed,
        kd_ratio: kdRatio,
        kills_per_round: killsPerRound,
        first_kill_rate: firstKillRate,
        first_death_rate: firstDeathRate,
        win_rate: winRate,
        confidence: confidence.level,
      }
    })

    const data: AgentData = {
      agents,
      total_rounds: totalRounds,
    }

    const confidence = calculateConfidence(totalRounds, "rounds")

    let insight = ""
    let recommendation: string | null = null

    if (agents.length === 0) {
      insight = "No agent data available."
      recommendation = null
    } else if (agents.length === 1) {
      insight = `One-trick on ${agents[0].agent} with ${(agents[0].win_rate * 100).toFixed(1)}% win rate.`
      recommendation = agents[0].win_rate < 0.45 ? "Consider expanding agent pool or improving mechanics." : null
    } else {
      const bestAgent = agents.reduce((a, b) => a.win_rate > b.win_rate ? a : b)
      insight = `Best performance on ${bestAgent.agent} with ${(bestAgent.win_rate * 100).toFixed(1)}% win rate.`
      recommendation = `Consider prioritizing ${bestAgent.agent} in competitive matches.`
    }

    const response: InsightResponse<AgentData> = {
      player_id: playerId,
      metric: "agent_performance",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching agent performance:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  } finally {
    await sql.end()
  }
}
