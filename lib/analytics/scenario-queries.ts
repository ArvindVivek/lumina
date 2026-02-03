import { createServerClient } from '@/lib/supabase/server'
import {
  SaveRetakeQuery,
  SaveRetakeMatch,
  SaveRetakeEV,
  ForceEcoQuery,
  ForceEcoMatch,
  ClutchQuery,
  ClutchMatch,
} from './scenario-types'

// VALORANT economy constants
const ROUND_WIN_BONUS = 3000
const ECONOMY_SAVE_BONUS = 1900

/**
 * Match historically similar save/retake situations using weighted k-NN.
 * SCEN-01: Save/Retake Similarity Matching
 */
export async function matchSaveRetakeSituations(
  params: SaveRetakeQuery
): Promise<SaveRetakeMatch[]> {
  const supabase = createServerClient()
  const {
    defender_economy: defenderEconomy,
    defender_alive: defenderAlive,
    attacker_alive: attackerAlive,
    time_remaining_ms: timeRemaining = 45000,
    map_name: mapName,
  } = params

  const { data, error } = await supabase.rpc('match_save_retake_situations', {
    p_defender_economy: defenderEconomy,
    p_defender_alive: defenderAlive,
    p_attacker_alive: attackerAlive,
    p_time_remaining_ms: timeRemaining,
    p_map_name: mapName || null,
  })

  if (error) {
    console.error('Error matching save/retake situations:', error)
    return []
  }

  return data || []
}

/**
 * Calculate expected value for save vs retake decision.
 * SCEN-02: Save/Retake EV Analysis
 */
export function calculateSaveRetakeEV(
  matches: SaveRetakeMatch[],
  avgWeaponValue: number
): SaveRetakeEV {
  const totalMatches = matches.length
  const wins = matches.filter(m => m.defender_won).length
  const retakeWinProb = totalMatches > 0 ? wins / totalMatches : 0

  // Retake EV: (win_prob * win_bonus) - (loss_prob * weapon_value)
  const retakeEV = (retakeWinProb * ROUND_WIN_BONUS) - ((1 - retakeWinProb) * avgWeaponValue)

  // Save EV: weapon_value + save_bonus
  const saveEV = avgWeaponValue + ECONOMY_SAVE_BONUS

  const evDifference = Math.abs(retakeEV - saveEV)
  const recommendedDecision = retakeEV > saveEV ? 'retake' : 'save'

  return {
    retake: {
      expected_value: Math.round(retakeEV),
      win_probability: retakeWinProb,
    },
    save: {
      expected_value: Math.round(saveEV),
      guaranteed_retention: avgWeaponValue,
    },
    recommended_decision: recommendedDecision,
    ev_difference: Math.round(evDifference),
  }
}

/**
 * Match force/eco situations by economy category.
 * SCEN-03: Force/Eco Decision Analysis
 */
export async function matchForceEcoSituations(
  params: ForceEcoQuery
): Promise<ForceEcoMatch[]> {
  const supabase = createServerClient()
  const {
    team_economy: teamEconomy,
    opponent_economy: opponentEconomy,
    map_name: mapName,
  } = params

  const { data, error } = await supabase.rpc('match_force_eco_situations', {
    p_team_economy: teamEconomy,
    p_opponent_economy: opponentEconomy,
    p_map_name: mapName || null,
  })

  if (error) {
    console.error('Error matching force/eco situations:', error)
    return []
  }

  return data || []
}

/**
 * Match clutch situations (1vX) with agent breakdown.
 * SCEN-04: Clutch Situation Analysis
 */
export async function matchClutchSituations(
  params: ClutchQuery
): Promise<ClutchMatch[]> {
  const supabase = createServerClient()
  const {
    opponent_count: opponentCount,
    map_name: mapName,
    site,
  } = params

  const { data, error } = await supabase.rpc('match_clutch_situations', {
    p_opponent_count: opponentCount,
    p_map_name: mapName || null,
    p_site: site || null,
  })

  if (error) {
    console.error('Error matching clutch situations:', error)
    return []
  }

  return data || []
}
