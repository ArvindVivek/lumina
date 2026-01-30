import { NextRequest, NextResponse } from 'next/server'
import { createPostgresClient } from '@/lib/supabase/client'
import { matchClutchSituations } from '@/lib/analytics/scenario-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type {
  ScenarioResponse,
  ClutchQuery,
  ClutchData
} from '@/lib/analytics/scenario-types'

export async function POST(request: NextRequest) {
  const sql = createPostgresClient()

  try {
    const body = await request.json()

    // Validate required fields
    const { clutch_player_count, opponent_count } = body
    if (!clutch_player_count || !opponent_count) {
      return NextResponse.json(
        { error: 'Missing required fields: clutch_player_count, opponent_count' },
        { status: 400 }
      )
    }

    const params: ClutchQuery = {
      clutch_player_count: Number(clutch_player_count),
      opponent_count: Number(opponent_count),
      map_name: body.map_name,
      site: body.site,
    }

    // Match similar situations
    const matches = await matchClutchSituations(sql, params)

    // Calculate overall clutch win rate
    const clutchesWon = matches.filter(m => m.clutch_won).length
    const clutchWinRate = matches.length > 0 ? clutchesWon / matches.length : 0

    // Build top agents analysis
    const agentStats = new Map<string, { wins: number; total: number }>()
    matches.forEach(m => {
      const stats = agentStats.get(m.agent) || { wins: 0, total: 0 }
      stats.total++
      if (m.clutch_won) stats.wins++
      agentStats.set(m.agent, stats)
    })

    const topAgents = Array.from(agentStats.entries())
      .map(([agent, stats]) => ({
        agent,
        win_rate: stats.total > 0 ? stats.wins / stats.total : 0,
        count: stats.total
      }))
      .filter(a => a.count >= 3) // minimum sample
      .sort((a, b) => b.win_rate - a.win_rate)
      .slice(0, 3)

    // Create situation label
    const situationLabel = `${params.clutch_player_count}v${params.opponent_count}`

    // Build data object
    const data: ClutchData = {
      clutch_win_rate: clutchWinRate,
      clutches_won: clutchesWon,
      clutch_situations: matches.length,
      situation_label: situationLabel,
      top_agents: topAgents,
    }

    // Calculate confidence
    const confidence = calculateConfidence(matches.length, "clutch situations")

    // Build recommendation (only if confidence is not low)
    let recommendation: { decision: string; rationale: string } | null = null

    if (confidence.level !== 'low') {
      if (clutchWinRate > 0.30) {
        recommendation = {
          decision: 'engage',
          rationale: `Above average ${(clutchWinRate * 100).toFixed(0)}% clutch success rate in ${situationLabel} situations`
        }
        // Include top agent if significantly better
        if (topAgents.length > 0 && topAgents[0].win_rate > clutchWinRate + 0.15) {
          recommendation.rationale += ` - ${topAgents[0].agent} shows exceptional ${(topAgents[0].win_rate * 100).toFixed(0)}% win rate`
        }
      } else if (clutchWinRate < 0.15) {
        recommendation = {
          decision: 'save',
          rationale: `Difficult ${situationLabel} clutch situation with only ${(clutchWinRate * 100).toFixed(0)}% success rate - consider saving`
        }
      } else {
        recommendation = {
          decision: 'situational',
          rationale: `${situationLabel} clutch has ${(clutchWinRate * 100).toFixed(0)}% win rate - evaluate based on player skill and positioning`
        }
        if (topAgents.length > 0) {
          recommendation.rationale += `. ${topAgents[0].agent} performs best at ${(topAgents[0].win_rate * 100).toFixed(0)}%`
        }
      }
    }

    const response: ScenarioResponse<ClutchData> = {
      scenario_type: 'clutch',
      query: params,
      matches: matches.length,
      data,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error analyzing clutch scenario:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await sql.end()
  }
}
