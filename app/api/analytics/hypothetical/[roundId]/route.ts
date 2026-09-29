import { NextRequest, NextResponse } from 'next/server'

import {
  queryRoundContext,
  findSimilarScenarios,
} from '@/lib/analytics/coaching-queries'
import { generateHypotheticalAnalysis } from '@/lib/llm/analyst'
import { checkAiLimit } from '@/lib/llm/limits'
import type { HypotheticalAnalysis, ScenarioStats } from '@/lib/analytics/coaching-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {

  try {
    const { roundId } = await params
    const { searchParams } = new URL(request.url)
    const teamFocus = searchParams.get('team_focus')
    const includeLLM = searchParams.get('include_llm') === 'true'

    // Get round context
    const roundContext = await queryRoundContext(roundId)

    if (!roundContext) {
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      )
    }

    // Sides come from the logged attack/defense. Planted rounds use the alive counts at the plant;
    // others use the players still alive when the round ended.
    const attackerTeamId = roundContext.attacker_team_id ?? roundContext.team_a_id
    const aliveAtEnd = (team: string) =>
      roundContext.player_states.filter(p => p.team_id === team && p.deaths === 0).length
    const defenderTeamId = attackerTeamId === roundContext.team_a_id ? roundContext.team_b_id : roundContext.team_a_id
    const clampedAttackerAlive = Math.max(1, Math.min(5, roundContext.alive_at_plant?.attackers ?? aliveAtEnd(attackerTeamId)))
    const clampedDefenderAlive = Math.max(0, Math.min(5, roundContext.alive_at_plant?.defenders ?? aliveAtEnd(defenderTeamId)))
    const teamAIsAttacker = attackerTeamId === roundContext.team_a_id

    // Find similar historical scenarios (use clamped values for better matching)
    const similarScenarios = await findSimilarScenarios(
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

    // AI write-up only when asked for, rate-limited, with a written fallback.
    let llmAnalysis: string | undefined
    if (includeLLM) {
      const limited = checkAiLimit(request)
      if (limited) return limited
      const llmResult = await generateHypotheticalAnalysis(
        displayAttacker,
        displayDefender,
        roundContext.spike_planted,
        roundContext.map_name,
        scenarioStats,
        similarScenarios
      )
      llmAnalysis = llmResult.analysis
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
