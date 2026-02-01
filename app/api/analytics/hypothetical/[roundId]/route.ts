import { NextRequest, NextResponse } from 'next/server'
import { getPostgresPool } from '@/lib/supabase/server'
import {
  queryRoundContext,
  findSimilarScenarios,
} from '@/lib/analytics/coaching-queries'
import { generateHypotheticalAnalysis, isLLMAvailable } from '@/lib/llm/analyst'
import type { HypotheticalAnalysis, ScenarioStats } from '@/lib/analytics/coaching-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {
  const sql = getPostgresPool()

  try {
    const { roundId } = await params
    const { searchParams } = new URL(request.url)
    const teamFocus = searchParams.get('team_focus')
    const includeLLM = searchParams.get('include_llm') === 'true'

    // Get round context
    const roundContext = await queryRoundContext(sql, roundId)

    if (!roundContext) {
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      )
    }

    // Determine attacker/defender alive counts
    // In VALORANT, rounds 1-12 are first half, 13-24+ are second half
    // team_a attacks first half, team_b attacks second half
    const isFirstHalf = roundContext.round_number <= 12
    const teamAIsAttacker = isFirstHalf

    // Count alive players by team (deaths === 0 means player survived the round)
    const teamAPlayers = roundContext.player_states.filter(p => p.team_id === roundContext.team_a_id)
    const teamBPlayers = roundContext.player_states.filter(p => p.team_id === roundContext.team_b_id)

    // Count alive based on deaths field (0 = alive, 1 = dead in this round)
    const teamAAlive = teamAPlayers.filter(p => p.deaths === 0).length
    const teamBAlive = teamBPlayers.filter(p => p.deaths === 0).length

    // Fallback: if we have 0 alive for both teams but there are players, use total player count
    // This handles cases where death data might be missing
    const finalTeamAAlive = teamAAlive === 0 && teamAPlayers.length > 0 ? teamAPlayers.length : teamAAlive
    const finalTeamBAlive = teamBAlive === 0 && teamBPlayers.length > 0 ? teamBPlayers.length : teamBAlive

    const attackerAlive = teamAIsAttacker ? finalTeamAAlive : finalTeamBAlive
    const defenderAlive = teamAIsAttacker ? finalTeamBAlive : finalTeamAAlive

    // Clamp values to valid VALORANT ranges (1-5 players per team)
    const clampedAttackerAlive = Math.max(1, Math.min(5, attackerAlive))
    const clampedDefenderAlive = Math.max(0, Math.min(5, defenderAlive))

    // Find similar historical scenarios (use clamped values for better matching)
    const similarScenarios = await findSimilarScenarios(
      sql,
      clampedAttackerAlive,
      clampedDefenderAlive,
      roundContext.spike_planted,
      roundContext.map_name,
      50
    )

    // Calculate scenario statistics
    const attackerWins = similarScenarios.filter(s => s.attacker_won).length
    const totalMatches = similarScenarios.length

    // Group by map
    const byMap: Record<string, { wins: number; total: number; rate: number }> = {}
    for (const scenario of similarScenarios) {
      if (!byMap[scenario.map_name]) {
        byMap[scenario.map_name] = { wins: 0, total: 0, rate: 0 }
      }
      byMap[scenario.map_name].total++
      if (scenario.attacker_won) {
        byMap[scenario.map_name].wins++
      }
    }
    for (const map of Object.keys(byMap)) {
      byMap[map].rate = byMap[map].total > 0 ? byMap[map].wins / byMap[map].total : 0
    }

    const scenarioStats: ScenarioStats = {
      total_matches: totalMatches,
      attacker_wins: attackerWins,
      attacker_win_rate: totalMatches > 0 ? attackerWins / totalMatches : 0,
      avg_similarity: similarScenarios.reduce((sum, s) => sum + s.similarity_score, 0) / (totalMatches || 1),
      by_map: byMap,
    }

    // Determine scenario type (use clamped values for valid display)
    const displayAttacker = clampedAttackerAlive
    const displayDefender = clampedDefenderAlive
    let scenarioType = `${displayAttacker}v${displayDefender}`
    if (roundContext.spike_planted) {
      scenarioType += '_postplant'
    }
    if (displayAttacker === 1 && displayDefender >= 1) {
      scenarioType = `clutch_1v${displayDefender}`
    }

    // Generate insights
    const insights: string[] = []
    const winRate = scenarioStats.attacker_win_rate * 100

    // Always provide context about the scenario
    if (totalMatches === 0) {
      insights.push(`${displayAttacker}v${displayDefender} scenario on ${roundContext.map_name}`)
      insights.push('No historical data available for exact comparison - building scenario database')
      if (roundContext.spike_planted) {
        insights.push('Post-plant scenarios typically favor attackers when they have the numbers advantage')
      }
      if (displayAttacker > displayDefender) {
        insights.push('Player advantage typically increases win probability significantly')
      } else if (displayAttacker < displayDefender) {
        insights.push('Facing a numbers disadvantage - need to play for picks or time')
      }
    } else {
      if (roundContext.spike_planted) {
        if (winRate > 60) {
          insights.push(`Post-plant ${displayAttacker}v${displayDefender} favors attackers (${winRate.toFixed(0)}% historical win rate)`)
        } else if (winRate < 40) {
          insights.push(`Defenders historically win ${(100 - winRate).toFixed(0)}% of these retakes`)
        } else {
          insights.push(`This post-plant scenario is historically close (${winRate.toFixed(0)}% attacker win rate)`)
        }
      }

      if (displayAttacker === 1 && displayDefender >= 1) {
        insights.push(`1v${displayDefender} clutch situations are won ${winRate.toFixed(0)}% of the time by the clutcher`)
      }

      if (byMap[roundContext.map_name]) {
        const mapRate = byMap[roundContext.map_name].rate * 100
        insights.push(`On ${roundContext.map_name} specifically, attackers win ${mapRate.toFixed(0)}% of similar situations`)
      }
    }

    // Generate recommendation
    let recommendation: string | null = null
    if (teamFocus) {
      const isAttacker = (teamFocus === roundContext.team_a_id) === teamAIsAttacker
      if (isAttacker) {
        if (winRate > 50) {
          recommendation = 'Historical data favors your position. Play default and avoid over-aggression.'
        } else {
          recommendation = 'Odds against you. Consider creating chaos or forcing trades rather than playing standard.'
        }
      } else {
        if (winRate < 50) {
          recommendation = 'Historical data favors your defense. Play patient and force mistakes.'
        } else {
          recommendation = 'Attackers historically win this. Consider aggressive retake or information play.'
        }
      }
    }

    // Generate LLM analysis if requested
    let llmAnalysis: string | undefined
    if (includeLLM && isLLMAvailable()) {
      try {
        const llmResult = await generateHypotheticalAnalysis(
          displayAttacker,
          displayDefender,
          roundContext.spike_planted,
          roundContext.map_name,
          scenarioStats,
          similarScenarios
        )
        llmAnalysis = llmResult.analysis
      } catch {
        // LLM failed, continue without
      }
    }

    const analysis: HypotheticalAnalysis = {
      round_context: roundContext,
      scenario_type: scenarioType,
      historical_matches: similarScenarios.slice(0, 10), // Return top 10
      scenario_stats: scenarioStats,
      insights,
      recommendation,
    }

    return NextResponse.json({
      analysis,
      llm_analysis: llmAnalysis,
    })
  } catch (error) {
    console.error('Error generating hypothetical analysis:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
