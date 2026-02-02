import { NextRequest, NextResponse } from 'next/server'

import { findSimilarScenarios } from '@/lib/analytics/coaching-queries'
import type { ScenarioStats } from '@/lib/analytics/coaching-types'

export async function POST(request: NextRequest) {

  try {
    const body = await request.json()
    const {
      attacker_alive,
      defender_alive,
      spike_planted,
      map_name,
      limit = 50,
    } = body

    // Validate required fields
    if (attacker_alive === undefined || defender_alive === undefined || spike_planted === undefined) {
      return NextResponse.json(
        { error: 'attacker_alive, defender_alive, and spike_planted are required' },
        { status: 400 }
      )
    }

    // Validate ranges
    const atkAlive = Math.max(1, Math.min(5, Number(attacker_alive)))
    const defAlive = Math.max(0, Math.min(5, Number(defender_alive)))
    const spiked = Boolean(spike_planted)

    console.log(`[Scenarios API] Searching for ${atkAlive}v${defAlive}, spike=${spiked}, map=${map_name || 'any'}`)

    // Find similar scenarios
    const similarScenarios = await findSimilarScenarios(
      atkAlive,
      defAlive,
      spiked,
      map_name || undefined,
      limit
    )

    console.log(`[Scenarios API] Found ${similarScenarios.length} matching scenarios`)

    // Calculate statistics
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

    const stats: ScenarioStats = {
      total_matches: totalMatches,
      attacker_wins: attackerWins,
      attacker_win_rate: totalMatches > 0 ? attackerWins / totalMatches : 0,
      avg_similarity: similarScenarios.reduce((sum, s) => sum + s.similarity_score, 0) / (totalMatches || 1),
      by_map: byMap,
    }

    // Generate scenario type label
    let scenarioType = `${attacker_alive}v${defender_alive}`
    if (spike_planted) {
      scenarioType += '_postplant'
    }
    if (attacker_alive === 1) {
      scenarioType = `clutch_1v${defender_alive}`
    }

    // Generate insights
    const insights: string[] = []
    const winRate = stats.attacker_win_rate * 100

    if (winRate > 60) {
      insights.push(`Attackers heavily favored (${winRate.toFixed(0)}% win rate)`)
    } else if (winRate < 40) {
      insights.push(`Defenders heavily favored (${(100 - winRate).toFixed(0)}% win rate)`)
    } else {
      insights.push(`Relatively even scenario (${winRate.toFixed(0)}% attacker win rate)`)
    }

    if (spike_planted && defender_alive > attacker_alive) {
      insights.push('Post-plant with numbers disadvantage - time becomes critical')
    }

    if (attacker_alive === 1) {
      insights.push(`1v${defender_alive} clutches require high individual skill and good utility usage`)
    }

    // Confidence based on sample size
    let confidence: 'high' | 'medium' | 'low' = 'low'
    if (totalMatches >= 30) {
      confidence = 'high'
    } else if (totalMatches >= 10) {
      confidence = 'medium'
    }

    return NextResponse.json({
      query: {
        attacker_alive,
        defender_alive,
        spike_planted,
        map_name: map_name || 'any',
      },
      scenario_type: scenarioType,
      stats,
      insights,
      confidence,
      matches: similarScenarios.slice(0, 20), // Return top 20
    })
  } catch (error) {
    console.error('Error finding similar scenarios:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
