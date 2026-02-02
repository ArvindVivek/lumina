import { NextRequest, NextResponse } from 'next/server'

import { queryRoundContext } from '@/lib/analytics/coaching-queries'
import {
  matchSaveRetakeSituations,
  calculateSaveRetakeEV,
} from '@/lib/analytics/scenario-queries'
import { generateRoundDecisionAnalysis, isLLMAvailable } from '@/lib/llm/analyst'
import type { SaveRetakeQuery } from '@/lib/analytics/scenario-types'

/**
 * Round Decision Analysis API
 * Analyzes whether save or retake would have been the better decision for a specific round
 *
 * Example questions this can answer:
 * - "On round 9 we attempted a 3v5 retake on C-site and lost. Would it have been better to save?"
 * - "Should we have saved our weapons in that 2v4 post-plant situation?"
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roundId: string }> }
) {

  try {
    const { roundId } = await params
    const { searchParams } = new URL(request.url)
    const teamFocus = searchParams.get('team_focus')
    const includeLLM = searchParams.get('include_llm') === 'true'

    // Get full round context
    const roundContext = await queryRoundContext(roundId)

    if (!roundContext) {
      return NextResponse.json(
        { error: 'Round not found' },
        { status: 404 }
      )
    }

    // Determine if this was a post-plant scenario
    if (!roundContext.spike_planted) {
      return NextResponse.json({
        round_id: roundId,
        scenario_type: 'pre_plant',
        applicable: false,
        message: 'Save/retake analysis only applies to post-plant scenarios',
        round_context: {
          round_number: roundContext.round_number,
          map_name: roundContext.map_name,
          spike_planted: false,
        },
      })
    }

    // Determine which team was defending (retaking)
    // In VALORANT: team_a attacks first half (rounds 1-12), team_b attacks second half
    const isFirstHalf = roundContext.round_number <= 12
    const attackerTeamId = isFirstHalf ? roundContext.team_a_id : roundContext.team_b_id
    const defenderTeamId = isFirstHalf ? roundContext.team_b_id : roundContext.team_a_id

    // Count players alive at end of round
    const attackerPlayers = roundContext.player_states.filter(p => p.team_id === attackerTeamId)
    const defenderPlayers = roundContext.player_states.filter(p => p.team_id === defenderTeamId)

    // Calculate alive counts (deaths === 0 means survived)
    const attackerAlive = attackerPlayers.filter(p => p.deaths === 0).length || 1
    const defenderAlive = defenderPlayers.filter(p => p.deaths === 0).length || 1

    // Calculate defender economy (loadout value)
    const defenderEconomy = defenderPlayers.reduce((sum, p) => sum + (p.loadout_value || 0), 0)
    const avgDefenderLoadout = defenderEconomy / (defenderPlayers.length || 1)

    // Determine the focused team (for analysis perspective)
    const focusedTeamId = teamFocus || defenderTeamId
    const isAnalyzingDefender = focusedTeamId === defenderTeamId

    // Get spike site from spike events (may be null if no plant event data)
    const plantEvent = roundContext.spike_events.find(e => e.event_type === 'plant')
    const spikeSite = plantEvent?.site || null

    // Build save/retake query parameters
    const saveRetakeQuery: SaveRetakeQuery = {
      defender_economy: Math.round(defenderEconomy),
      defender_alive: Math.min(5, Math.max(1, defenderAlive)),
      attacker_alive: Math.min(5, Math.max(1, attackerAlive)),
      time_remaining_ms: 45000, // Assume mid-round default
      map_name: roundContext.map_name,
    }

    // Find similar historical scenarios
    const matches = await matchSaveRetakeSituations(saveRetakeQuery)

    // Calculate EV analysis
    const evAnalysis = calculateSaveRetakeEV(matches, Math.round(avgDefenderLoadout * 0.8))

    // Determine what actually happened
    const defenderWonRound = roundContext.winning_team_id === defenderTeamId
    const actualDecision = 'retake' // They attempted to retake (since we have round data)
    const wasOptimal = (evAnalysis.recommended_decision === 'retake' && defenderWonRound) ||
                       (evAnalysis.recommended_decision === 'save' && !defenderWonRound)

    // Build insights
    const insights: string[] = []
    // Clean scenario description - only include site if known
    const scenarioDesc = `${defenderAlive}v${attackerAlive} retake`

    if (matches.length === 0) {
      insights.push(`${scenarioDesc} on ${roundContext.map_name}${spikeSite ? ` (${spikeSite.toUpperCase()}-site)` : ''}`)
      insights.push('Limited historical data for this exact scenario')
    } else {
      const winRate = matches.filter(m => m.defender_won).length / matches.length
      insights.push(`${scenarioDesc} has ${(winRate * 100).toFixed(0)}% historical success rate`)

      if (evAnalysis.recommended_decision === 'save') {
        insights.push(`Saving would preserve ~${evAnalysis.save.guaranteed_retention} economy for next round`)
        insights.push(`Expected value advantage: +${evAnalysis.ev_difference} by saving`)
      } else {
        insights.push(`Retake EV: ${evAnalysis.retake.expected_value} (${(evAnalysis.retake.win_probability * 100).toFixed(0)}% win probability)`)
        insights.push(`Expected value advantage: +${evAnalysis.ev_difference} by retaking`)
      }
    }

    // What actually happened
    if (defenderWonRound) {
      insights.push(`Result: Retake successful - defenders won the round`)
    } else {
      insights.push(`Result: Retake failed - attackers won the round`)
    }

    // Hindsight analysis
    if (!wasOptimal && matches.length > 0) {
      if (evAnalysis.recommended_decision === 'save' && !defenderWonRound) {
        insights.push(`In hindsight: Saving weapons would have been the statistically better choice`)
      }
    }

    // Generate LLM analysis if requested
    let llmAnalysis: string | undefined
    if (includeLLM && isLLMAvailable()) {
      try {
        const llmResult = await generateRoundDecisionAnalysis(
          roundContext,
          evAnalysis,
          matches.length,
          defenderAlive,
          attackerAlive,
          spikeSite,
          defenderWonRound
        )
        llmAnalysis = llmResult.analysis
      } catch {
        // LLM failed, continue without
      }
    }

    return NextResponse.json({
      round_id: roundId,
      scenario_type: 'save_retake',
      applicable: true,
      round_context: {
        round_number: roundContext.round_number,
        map_name: roundContext.map_name,
        spike_planted: true,
        spike_site: spikeSite,
        defender_alive: defenderAlive,
        attacker_alive: attackerAlive,
        defender_economy: Math.round(defenderEconomy),
        outcome: defenderWonRound ? 'defender_win' : 'attacker_win',
      },
      analysis: {
        scenario_description: scenarioDesc,
        historical_matches: matches.length,
        ev_analysis: evAnalysis,
        actual_decision: actualDecision,
        actual_outcome: defenderWonRound ? 'success' : 'failure',
        was_optimal: wasOptimal,
        recommendation: evAnalysis.recommended_decision,
      },
      insights,
      llm_analysis: llmAnalysis,
    })
  } catch (error) {
    console.error('Error analyzing round decision:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
