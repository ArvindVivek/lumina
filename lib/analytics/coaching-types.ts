import type { ConfidenceScore } from './types'

/**
 * Comprehensive Coaching Report Types
 * Based on ValVision's coaching report structure
 */

// Series Summary
export interface SeriesSummary {
  series_id: string
  team_id: string
  team_name: string
  opponent_id: string
  opponent_name: string
  result: 'win' | 'loss'
  score: string // e.g., "2-1"
  total_rounds: number
  total_maps: number
  maps: MapSummary[]
  key_strength: string
  key_weakness: string
}

export interface MapSummary {
  game_id: string
  map_name: string
  team_score: number
  opponent_score: number
  result: 'win' | 'loss'
}

// Key Metrics by Map
export interface MapMetrics {
  game_id: string
  map_name: string
  score: string
  fb_win_rate: number
  fb_conversion_rate: number
  trade_rate: number
  untraded_deaths: number
  post_plant_win_rate: number
}

// Opening Duels Per Player
export interface PlayerOpeningDuels {
  player_id: string
  player_name: string
  first_kills: number
  first_deaths: number
  net: number
  fk_conversion_rate: number
  fd_loss_rate: number
  total_rounds: number
}

// Anti-Strat Signal
export interface AntiStratSignal {
  signal: string
  severity: 'critical' | 'moderate' | 'minor'
  detail: string
  implication: string
  occurrences: number
}

// Forced Mistake
export interface ForcedMistake {
  mistake: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  detail: string
  fix: string
  rounds_impacted: number
}

// VOD Review Note
export interface VODReviewNote {
  game_id: string
  round_id: string
  game_number: number
  map_name: string
  round_number: number
  reason: string
  fb_time_ms: number | null
  review_priority: 'critical' | 'high' | 'medium' | 'low'
}

// Action Plan
export interface ActionPlan {
  immediate: ActionItem[]
  medium_term: ActionItem[]
}

export interface ActionItem {
  action: string
  context: string
  priority: 'high' | 'medium' | 'low'
}

// Full Coaching Report
export interface CoachingReport {
  generated_at: string
  series_id: string
  team_focus: string
  summary: SeriesSummary
  key_metrics: MapMetrics[]
  opening_duels: PlayerOpeningDuels[]
  anti_strat_signals: AntiStratSignal[]
  forced_mistakes: ForcedMistake[]
  vod_review_notes: VODReviewNote[]
  action_plan: ActionPlan
  confidence: ConfidenceScore
}

// API Response type
export interface CoachingReportResponse {
  report: CoachingReport
  meta: {
    rounds_analyzed: number
    players_analyzed: number
    processing_time_ms: number
  }
}

// Round Context for Hypothetical Analysis
export interface RoundContext {
  round_id: string
  game_id: string
  map_name: string
  round_number: number
  team_a_id: string
  team_b_id: string
  team_a_score: number
  team_b_score: number
  winning_team_id: string
  winning_condition: string
  spike_planted: boolean
  spike_defused: boolean
  duration_ms: number
  phase: string
  kill_timeline: KillEvent[]
  player_states: PlayerState[]
  spike_events: SpikeEvent[]
  first_blood: FirstBlood | null
}

export interface KillEvent {
  game_time_ms: number
  killer_id: string
  killer_name: string
  killer_agent: string
  victim_id: string
  victim_name: string
  victim_agent: string
  weapon: string
  headshot: boolean
  is_trade: boolean
  is_first_kill: boolean
}

export interface PlayerState {
  player_id: string
  player_name: string
  team_id: string
  agent: string
  kills: number
  deaths: number
  assists: number
  first_kill: boolean
  first_death: boolean
  traded: boolean
  clutch_situation: boolean
  clutch_won: boolean
  loadout_value: number
}

export interface SpikeEvent {
  game_time_ms: number
  event_type: 'plant' | 'defuse_start' | 'defuse' | 'explode'
  player_id: string
  player_name: string
  site: string
}

export interface FirstBlood {
  player_id: string
  player_name: string
  team_id: string
  time_ms: number
  weapon: string
}

// Scenario Match
export interface ScenarioMatch {
  round_id: string
  game_id: string
  map_name: string
  round_number: number
  attacker_alive: number
  defender_alive: number
  spike_planted: boolean
  attacker_won: boolean
  similarity_score: number
}

export interface ScenarioStats {
  total_matches: number
  attacker_wins: number
  attacker_win_rate: number
  avg_similarity: number
  by_map: Record<string, { wins: number; total: number; rate: number }>
}

// Hypothetical Analysis Result
export interface HypotheticalAnalysis {
  round_context: RoundContext
  scenario_type: string
  historical_matches: ScenarioMatch[]
  scenario_stats: ScenarioStats
  insights: string[]
  recommendation: string | null
}

// VOD Priority for Round Breakdown
export type VODPriority = 'critical' | 'high' | 'medium' | 'low' | 'skip'

export interface RoundForReview {
  round_id: string
  game_id: string
  map_name: string
  round_number: number
  side: 'attack' | 'defense'
  result: 'win' | 'loss'
  score_before: string
  score_after: string
  first_blood: {
    player_id: string
    player_name: string
    team_id: string
    time_ms: number
  } | null
  untraded_deaths: number
  spike_planted: boolean
  winning_condition: string
  notable_events: NotableEvent[]
  review_priority: VODPriority
  priority_reason: string
}

export interface NotableEvent {
  type: 'multi_kill' | 'clutch_won' | 'clutch_lost' | 'ace' | 'thrifty'
  player_id: string
  player_name: string
  detail: string
}

export interface RoundBreakdownResponse {
  series_id: string
  team_id: string
  games: GameBreakdown[]
  priority_rounds: RoundForReview[]
  notable_players: {
    player_id: string
    player_name: string
    multi_kills: number
    clutches_won: number
    clutches_lost: number
  }[]
  confidence: ConfidenceScore
}

export interface GameBreakdown {
  game_id: string
  map_name: string
  sequence_number: number
  team_score: number
  opponent_score: number
  result: 'win' | 'loss'
  rounds: RoundForReview[]
}
