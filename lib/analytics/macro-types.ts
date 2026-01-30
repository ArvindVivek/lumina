import type { ConfidenceScore } from './types'

/**
 * Base response structure for all macro (team-level) insight endpoints.
 * Generic T represents the specific data type for each insight.
 */
export interface MacroInsightResponse<T> {
  team_id: string
  metric: string
  data: T
  insight: string
  recommendation: string | null
  confidence: ConfidenceScore
}

// Pistol Analysis (MACRO-01)
export interface PistolAnalysisData {
  pistol_rounds: number
  pistol_wins: number
  pistol_win_rate: number
  bonus_wins: number
  bonus_rounds: number
  conversion_rate: number
}

export interface PistolAnalysisRow {
  pistol_rounds: string
  pistol_wins: string
  bonus_wins: string
  total_bonus_rounds: string
  pistol_win_rate: string
}

// First Blood Conversion (MACRO-02)
export interface FirstBloodConversionData {
  first_bloods: number
  first_blood_wins: number
  conversion_rate: number
}

export interface FirstBloodConversionRow {
  first_bloods: string
  first_blood_wins: string
  first_blood_conversion_rate: string
}

// Trade Discipline (MACRO-03)
export interface TradeDisciplineData {
  total_deaths: number
  traded_deaths: number
  first_deaths: number
  first_deaths_traded: number
  overall_trade_rate: number
  first_death_trade_rate: number
}

export interface TradeDisciplineRow {
  total_deaths: string
  traded_deaths: string
  first_deaths: string
  first_deaths_traded: string
  overall_trade_rate: string
  first_death_trade_rate: string
}

// Opening Duels by Player (MACRO-04)
export interface PlayerOpeningDuelsData {
  player_id: string
  player_name: string
  first_kills: number
  first_deaths: number
  opening_duel_rate: number
  success_rate: number
}

export interface OpeningDuelsByPlayerRow {
  player_id: string
  first_kills: string
  first_deaths: string
  total_rounds: string
}

// Economy Management (MACRO-05)
export interface EconomyDecisionData {
  economy_decision: string
  rounds: number
  wins: number
  win_rate: number
  avg_loadout_value: number
}

export interface EconomyManagementData {
  decisions: EconomyDecisionData[]
  total_rounds: number
}

export interface EconomyManagementRow {
  economy_decision: string
  rounds: string
  wins: string
  win_rate: string
  avg_loadout_value: string
}

// Timing Patterns (MACRO-06)
export interface TimingPatternData {
  avg_round_duration_ms: number
  avg_first_kill_time_ms: number
  rounds_analyzed: number
}

export interface TimingPatternRow {
  avg_round_duration_ms: string
  avg_first_kill_time_ms: string
  rounds_analyzed: string
}

// Ultimate Economy (MACRO-07)
export interface UltimateEconomyData {
  total_rounds: number
  ultimates_used: number
  usage_rate: number
  rounds_with_ult_available: number
  ult_availability_win_rate: number
}

export interface UltimateEconomyRow {
  total_rounds: string
  ultimates_used: string
  usage_rate: string
  rounds_with_ult_available: string
  ult_availability_win_rate: string
}

// Critical Moments (MACRO-08, REVW-02)
export interface CriticalMomentFactors {
  round_impact: number
  pattern_deviation: number
  economic_consequence: number
}

export interface CriticalMoment {
  round_id: string
  round_number: number
  game_id: string
  moment_type: string
  description: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  score: number
  factors: CriticalMomentFactors
}

// Round Breakdown (REVW-01)
export interface RoundBreakdownData {
  round_id: string
  round_number: number
  game_id: string
  map_name: string
  winning_team_id: string
  first_blood_team_id: string | null
  spike_planted: boolean
  spike_defused: boolean
  team_loadout_value: number
  opponent_loadout_value: number
  duration_ms: number
}

export interface RoundBreakdownRow {
  round_id: string
  round_number: string
  game_id: string
  map_name: string
  winning_team_id: string
  first_blood_team_id: string | null
  spike_planted: string
  spike_defused: string
  team_loadout_value: string
  opponent_loadout_value: string
  duration_ms: string
}
