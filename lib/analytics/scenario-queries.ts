import type { Sql } from 'postgres'
import { getPostgresPool } from '@/lib/supabase/server'
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
  const sql = getPostgresPool()
  const {
    defender_economy: defenderEconomy,
    defender_alive: defenderAlive,
    attacker_alive: attackerAlive,
    time_remaining_ms: timeRemaining = 45000,
    map_name: mapName,
  } = params

  const result = await sql<SaveRetakeMatch[]>`
    WITH normalized_distances AS (
      SELECT
        si.round_id,
        si.game_id,
        si.map_name,
        si.defender_economy,
        si.defender_alive,
        si.attacker_alive,
        si.time_remaining_ms,
        si.attacker_won,
        -- Normalized distance calculations (0-1 range)
        ABS(si.defender_economy - ${defenderEconomy}) / 25000.0 as economy_dist,
        ABS(si.defender_alive - ${defenderAlive}) / 5.0 as defender_alive_dist,
        ABS(si.attacker_alive - ${attackerAlive}) / 5.0 as attacker_alive_dist,
        ABS(si.time_remaining_ms - ${timeRemaining}) / 45000.0 as time_dist
      FROM public.scenario_index si
      WHERE si.spike_planted = TRUE
        ${mapName ? sql`AND si.map_name = ${mapName}` : sql``}
    ),
    weighted_similarity AS (
      SELECT
        round_id,
        game_id,
        map_name,
        defender_economy,
        defender_alive,
        attacker_alive,
        time_remaining_ms,
        attacker_won,
        -- Weighted distance: economy(0.35) + defender_alive(0.30) + attacker_alive(0.25) + time(0.10)
        (economy_dist * 0.35 + defender_alive_dist * 0.30 + attacker_alive_dist * 0.25 + time_dist * 0.10) as similarity_distance
      FROM normalized_distances
    )
    SELECT
      round_id,
      game_id,
      map_name,
      defender_economy,
      defender_alive,
      attacker_alive,
      time_remaining_ms,
      NOT attacker_won as defender_won,
      (1 - similarity_distance) as similarity_score
    FROM weighted_similarity
    WHERE similarity_distance < 0.25
    ORDER BY similarity_distance ASC
    LIMIT 50
  `

  return result
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
  const sql = getPostgresPool()
  const {
    team_economy: teamEconomy,
    opponent_economy: opponentEconomy,
    map_name: mapName,
  } = params

  // Classify query economy
  let economyCategory: 'eco' | 'force_buy' | 'full_buy'
  if (teamEconomy < 10000) {
    economyCategory = 'eco'
  } else if (teamEconomy < 20000) {
    economyCategory = 'force_buy'
  } else {
    economyCategory = 'full_buy'
  }

  const result = await sql<ForceEcoMatch[]>`
    SELECT
      r.id as round_id,
      r.round_number,
      g.map_name,
      r.team_a_loadout_value as team_economy,
      r.team_b_loadout_value as opponent_economy,
      CASE
        WHEN r.team_a_loadout_value < 10000 THEN 'eco'
        WHEN r.team_a_loadout_value < 20000 THEN 'force_buy'
        ELSE 'full_buy'
      END as economy_category,
      CASE
        WHEN r.team_b_loadout_value < 10000 THEN 'eco'
        WHEN r.team_b_loadout_value < 20000 THEN 'force_buy'
        ELSE 'full_buy'
      END as opponent_category,
      CASE
        WHEN r.winning_team_id = s.team_a_id THEN TRUE
        ELSE FALSE
      END as team_won
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE CASE
        WHEN r.team_a_loadout_value < 10000 THEN 'eco'
        WHEN r.team_a_loadout_value < 20000 THEN 'force_buy'
        ELSE 'full_buy'
      END = ${economyCategory}
      AND ABS(r.team_b_loadout_value - ${opponentEconomy}) < 5000
      ${mapName ? sql`AND g.map_name = ${mapName}` : sql``}
    ORDER BY ABS(r.team_a_loadout_value - ${teamEconomy})
    LIMIT 100
  `

  return result
}

/**
 * Match clutch situations (1vX) with agent breakdown.
 * SCEN-04: Clutch Situation Analysis
 */
export async function matchClutchSituations(
  params: ClutchQuery
): Promise<ClutchMatch[]> {
  const sql = getPostgresPool()
  const {
    opponent_count: opponentCount,
    map_name: mapName,
    site,
  } = params

  const result = await sql<ClutchMatch[]>`
    WITH clutch_with_context AS (
      SELECT
        prs.round_id,
        prs.player_id,
        prs.team_id,
        prs.agent,
        prs.clutch_won,
        r.round_number,
        r.team_a_alive,
        r.team_b_alive,
        g.map_name,
        s.team_a_id,
        s.team_b_id
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.clutch_situation = TRUE
    )
    SELECT
      cwc.round_id,
      cwc.player_id,
      cwc.agent,
      cwc.clutch_won,
      cwc.round_number,
      cwc.map_name,
      se.site
    FROM clutch_with_context cwc
    LEFT JOIN public.spike_events se ON se.round_id = cwc.round_id AND se.event_type = 'plant'
    WHERE CASE
        WHEN cwc.team_id = cwc.team_a_id THEN cwc.team_b_alive
        ELSE cwc.team_a_alive
      END = ${opponentCount}
      ${mapName ? sql`AND cwc.map_name = ${mapName}` : sql``}
      ${site ? sql`AND se.site = ${site}` : sql``}
    ORDER BY cwc.round_number DESC
    LIMIT 100
  `

  return result
}
