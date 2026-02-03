import { createServerClient } from '@/lib/supabase/server'
import {
  FirstDeathRow,
  TradingRow,
  OpeningDuelsRow,
  ClutchRow,
  AgentRow,
  MultiKillRow,
  EcoRoundRow,
} from './types'

/**
 * Query first death impact: rounds lost when player dies first without contributing
 * PLAY-01: First Death Impact Analysis
 */
export async function queryFirstDeathImpact(
  playerId: string,
  tournamentId?: string,
): Promise<FirstDeathRow> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_first_death_impact', {
    p_player_id: playerId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying first death impact:', error)
    return { losses: "0", total: "0" }
  }

  return data?.[0] || { losses: "0", total: "0" }
}

/**
 * Query trading efficiency: how often player deaths are traded
 * PLAY-02: Trading Efficiency Metrics
 */
export async function queryTradingEfficiency(
  playerId: string,
  tournamentId?: string,
): Promise<TradingRow> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_trading_efficiency', {
    p_player_id: playerId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying trading efficiency:', error)
    return { traded: "0", total_deaths: "0" }
  }

  return data?.[0] || { traded: "0", total_deaths: "0" }
}

/**
 * Query opening duel performance: first kill and first death statistics
 * PLAY-03: Opening Duel Performance
 */
export async function queryOpeningDuels(
  playerId: string,
  tournamentId?: string,
): Promise<OpeningDuelsRow> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_opening_duels', {
    p_player_id: playerId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying opening duels:', error)
    return { first_kills: "0", first_deaths: "0", total_rounds: "0" }
  }

  return data?.[0] || { first_kills: "0", first_deaths: "0", total_rounds: "0" }
}

/**
 * Query clutch performance: success rate in clutch situations
 * PLAY-04: Clutch Situation Analysis
 */
export async function queryClutchPerformance(
  playerId: string,
  tournamentId?: string,
): Promise<ClutchRow> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_clutch_performance', {
    p_player_id: playerId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying clutch performance:', error)
    return { clutches_won: "0", clutch_situations: "0" }
  }

  return data?.[0] || { clutches_won: "0", clutch_situations: "0" }
}

/**
 * Query agent performance: statistics grouped by agent
 * PLAY-05: Agent Performance Comparison
 */
export async function queryAgentPerformance(
  playerId: string,
  tournamentId?: string,
): Promise<AgentRow[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_agent_performance', {
    p_player_id: playerId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying agent performance:', error)
    return []
  }

  return data || []
}

/**
 * Query multi-kill rounds: 2K, 3K, 4K, and ace frequency
 * PLAY-06: Multi-Kill Round Tracking
 */
export async function queryMultiKillRounds(
  playerId: string,
  tournamentId?: string,
): Promise<MultiKillRow> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_multi_kill_rounds', {
    p_player_id: playerId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying multi-kill rounds:', error)
    return {
      two_plus_kills: "0",
      three_plus_kills: "0",
      four_plus_kills: "0",
      aces: "0",
      total_rounds: "0",
      total_kills: "0"
    }
  }

  return data?.[0] || {
    two_plus_kills: "0",
    three_plus_kills: "0",
    four_plus_kills: "0",
    aces: "0",
    total_rounds: "0",
    total_kills: "0"
  }
}

/**
 * Query eco round performance by phase: stats grouped by round phase
 * PLAY-07: Eco Round Performance by Phase
 */
export async function queryEcoRoundPerformance(
  playerId: string,
  tournamentId?: string,
): Promise<EcoRoundRow[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_eco_round_performance', {
    p_player_id: playerId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying eco round performance:', error)
    return []
  }

  return data || []
}
