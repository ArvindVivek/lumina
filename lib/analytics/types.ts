/**
 * Confidence score interface for statistical significance.
 */
export interface ConfidenceScore {
  level: "low" | "medium" | "high"
  sample_size: number
  description: string
}

/**
 * Base response structure for all insight endpoints.
 * Generic T represents the specific data type for each insight.
 */
export interface InsightResponse<T> {
  player_id: string
  metric: string
  data: T
  insight: string
  recommendation: string | null
  confidence: ConfidenceScore
}

// First Death Impact (PLAY-01)
export interface FirstDeathData {
  losses: number
  total: number
  loss_rate: number
}

export interface FirstDeathRow {
  losses: string
  total: string
}

// Trading Efficiency (PLAY-02)
export interface TradingData {
  traded: number
  total_deaths: number
  trade_rate: number
}

export interface TradingRow {
  traded: string
  total_deaths: string
}

// Opening Duels (PLAY-03)
export interface OpeningDuelsData {
  first_kills: number
  first_deaths: number
  total_rounds: number
  opening_duel_rate: number
  success_rate: number
}

export interface OpeningDuelsRow {
  first_kills: string
  first_deaths: string
  total_rounds: string
}

// Clutch Performance (PLAY-04)
export interface ClutchData {
  clutches_won: number
  clutch_situations: number
  clutch_rate: number
}

export interface ClutchRow {
  clutches_won: string
  clutch_situations: string
}

// Agent Performance (PLAY-05)
export interface AgentStats {
  agent: string
  rounds_played: number
  kd_ratio: number
  kills_per_round: number
  first_kill_rate: number
  first_death_rate: number
  win_rate: number
  confidence: string
}

export interface AgentData {
  agents: AgentStats[]
  total_rounds: number
}

export interface AgentRow {
  agent: string
  rounds_played: string
  total_kills: string
  total_deaths: string
  first_kills: string
  first_deaths: string
  rounds_won: string
}

// Multi-Kill Rounds (PLAY-06)
export interface MultiKillData {
  two_plus_kills: number
  three_plus_kills: number
  four_plus_kills: number
  aces: number
  total_rounds: number
  kills_per_round: number
}

export interface MultiKillRow {
  two_plus_kills: string
  three_plus_kills: string
  four_plus_kills: string
  aces: string
  total_rounds: string
  total_kills: string
}

// Eco Round Performance (PLAY-07)
export interface PhaseStats {
  rounds: number
  kd_ratio: number
  win_rate: number
}

export interface EcoRoundData {
  phases: Record<string, PhaseStats>
  total_rounds: number
}

export interface EcoRoundRow {
  phase: string
  rounds: string
  total_kills: string
  total_deaths: string
  rounds_won: string
}
