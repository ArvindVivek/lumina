import { NextRequest, NextResponse } from 'next/server'
import { inRange } from '@/lib/analytics/validate'

import {
  matchSaveRetakeSituations,
  calculateSaveRetakeEV
} from '@/lib/analytics/scenario-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type {
  ScenarioResponse,
  SaveRetakeQuery,
  SaveRetakeData
} from '@/lib/analytics/scenario-types'

export async function POST(request: NextRequest) {

  try {
    const body = await request.json().catch(() => ({}))

    // Validate required fields
    const { defender_economy, defender_alive, attacker_alive } = body
    if (!inRange(defender_economy, 0, 60000) || !inRange(defender_alive, 1, 5) || !inRange(attacker_alive, 1, 5)) {
      return NextResponse.json(
        { error: 'Missing required fields: defender_economy, defender_alive, attacker_alive' },
        { status: 400 }
      )
    }

    const params: SaveRetakeQuery = {
      defender_economy: Number(defender_economy),
      defender_alive: Number(defender_alive),
      attacker_alive: Number(attacker_alive),
      time_remaining_ms: body.time_remaining_ms || 45000,
      map_name: body.map_name,
    }

    // Match similar situations
    const matches = await matchSaveRetakeSituations(params)

    // Calculate retake win rate
    const retakeWins = matches.filter(m => m.defender_won).length
    const retakeWinRate = matches.length > 0 ? retakeWins / matches.length : 0

    // Estimate average weapon value as 80% of loadout
    const avgWeaponValue = Math.round(params.defender_economy * 0.8)

    // Calculate expected value
    const evAnalysis = calculateSaveRetakeEV(matches, avgWeaponValue)

    // Build data object
    const data: SaveRetakeData = {
      retake_win_rate: retakeWinRate,
      save_rounds_analyzed: matches.length,
      ev_analysis: evAnalysis,
      avg_weapon_value: avgWeaponValue,
    }

    // Calculate confidence
    const confidence = calculateConfidence(matches.length, "similar situations")

    // Build recommendation (only if confidence is not low)
    const recommendation = confidence.level === 'low' ? null : {
      decision: evAnalysis.recommended_decision,
      rationale: evAnalysis.recommended_decision === 'retake'
        ? `Retaking has ${(retakeWinRate * 100).toFixed(0)}% win rate with +${evAnalysis.ev_difference} expected value`
        : `Saving preserves ${evAnalysis.save.guaranteed_retention} economy for next round with +${evAnalysis.ev_difference} expected value`,
      ev_advantage: evAnalysis.ev_difference
    }

    const response: ScenarioResponse<SaveRetakeData> = {
      scenario_type: 'save_retake',
      query: params,
      matches: matches.length,
      data,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error analyzing save/retake scenario:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
