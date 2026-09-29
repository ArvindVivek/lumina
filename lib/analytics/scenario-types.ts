import type { ConfidenceScore } from './types'

/**
 * Scenario type discriminator union.
 */
export type ScenarioType = 'save_retake' | 'force_eco' | 'clutch'

/**
 * Base response structure for all scenario analysis endpoints.
 * Generic T represents the specific data type for each scenario.
 */
export interface ScenarioResponse<T> {
  scenario_type: ScenarioType
  query: unknown
  matches: number
  data: T
  recommendation: {
    decision: string
    rationale: string
    ev_advantage?: number
  } | null
  confidence: ConfidenceScore
}

// ============================================================================
// Save/Retake Scenario Types (SCEN-01, SCEN-02)
// ============================================================================

/**
 * Query parameters for save/retake decision analysis.
 */
export interface SaveRetakeQuery {
  defender_economy: number
  defender_alive: number // 1-5
  attacker_alive: number // 1-5
  time_remaining_ms?: number // Default 45000
  map_name?: string
}

/**
 * Raw database result for a historical save/retake situation.
 */
export interface SaveRetakeMatch {
  round_id: string
  game_id: string
  map_name: string
  defender_economy: number
  defender_alive: number
  attacker_alive: number
  time_remaining_ms: number
  defender_won: boolean
  similarity_score: number
}

/**
 * Expected value analysis for save vs retake decision.
 */
export interface SaveRetakeEV {
  retake: {
    expected_value: number
    win_probability: number
  }
  save: {
    expected_value: number
    guaranteed_retention: number
  }
  recommended_decision: 'retake' | 'save'
  ev_difference: number
}

/**
 * Aggregated data for save/retake scenario analysis.
 */
export interface SaveRetakeData {
  retake_win_rate: number
  save_rounds_analyzed: number
  ev_analysis: SaveRetakeEV
  avg_weapon_value: number
}

// ============================================================================
// Force/Eco Buy Scenario Types (SCEN-03)
// ============================================================================

/**
 * Query parameters for force buy vs eco decision analysis.
 */
export interface ForceEcoQuery {
  team_economy: number
  opponent_economy: number
  round_number?: number
  map_name?: string
}

/**
 * Raw database result for a historical force/eco situation.
 */
export interface ForceEcoMatch {
  round_id: string
  round_number: number
  map_name: string
  team_economy: number
  opponent_economy: number
  economy_category: 'eco' | 'force_buy' | 'full_buy'
  opponent_category: 'eco' | 'force_buy' | 'full_buy'
  team_won: boolean
}

/**
 * Aggregated data for force/eco scenario analysis.
 */
export interface ForceEcoData {
  force_win_rate: number
  eco_win_rate: number
  full_buy_win_rate: number
  economy_category: 'eco' | 'force_buy' | 'full_buy'
  opponent_category: 'eco' | 'force_buy' | 'full_buy'
  rounds_analyzed: number
}

// ============================================================================
// Clutch Scenario Types (SCEN-04)
// ============================================================================

/**
 * Query parameters for clutch situation analysis.
 */
export interface ClutchQuery {
  clutch_player_count: number // Typically 1-2
  opponent_count: number // 1-5
  map_name?: string
  site?: string // A/B/C
}

/**
 * Raw database result for a historical clutch situation.
 */
export interface ClutchMatch {
  round_id: string
  player_id: string
  agent: string
  clutch_won: boolean
  round_number: number
  map_name: string
  site: string | null
}

/**
 * Aggregated data for clutch scenario analysis.
 */
export interface ClutchData {
  clutch_win_rate: number
  clutches_won: number
  clutch_situations: number
  situation_label: string // e.g., "1v2", "1v3"
  top_agents: {
    agent: string
    win_rate: number
    count: number
  }[]
}
