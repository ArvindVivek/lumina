import { createServerClient } from '@/lib/supabase/server'
import {
  PistolAnalysisRow,
  FirstBloodConversionRow,
  TradeDisciplineRow,
  OpeningDuelsByPlayerRow,
  EconomyManagementRow,
  TimingPatternRow,
  UltimateEconomyRow,
  RoundBreakdownRow,
} from './macro-types'
import { RoundDataForClassification } from './priority-classifier'

/**
 * Query pistol round analysis: pistol round win rates and bonus round conversion
 * MACRO-01: Pistol Analysis
 */
export async function queryPistolAnalysis(
  teamId: string,
  tournamentId?: string,
  mapName?: string,
): Promise<PistolAnalysisRow> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_pistol_analysis', {
    p_team_id: teamId,
    p_tournament_id: tournamentId || null,
    p_map_name: mapName || null,
  })

  if (error) {
    console.error('Error querying pistol analysis:', error)
    return {
      pistol_rounds: "0",
      pistol_wins: "0",
      bonus_wins: "0",
      total_bonus_rounds: "0",
      pistol_win_rate: "0.00"
    }
  }

  return data?.[0] || {
    pistol_rounds: "0",
    pistol_wins: "0",
    bonus_wins: "0",
    total_bonus_rounds: "0",
    pistol_win_rate: "0.00"
  }
}

/**
 * Query first blood conversion: win rate when team gets first blood
 * MACRO-02: First Blood Conversion
 */
export async function queryFirstBloodConversion(
  teamId: string,
  tournamentId?: string,
): Promise<FirstBloodConversionRow> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_first_blood_conversion', {
    p_team_id: teamId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying first blood conversion:', error)
    return {
      first_bloods: "0",
      first_blood_wins: "0",
      first_blood_conversion_rate: "0.00"
    }
  }

  return data?.[0] || {
    first_bloods: "0",
    first_blood_wins: "0",
    first_blood_conversion_rate: "0.00"
  }
}

/**
 * Query trade discipline: team's trading efficiency when losing players
 * MACRO-03: Trade Discipline
 */
export async function queryTradeDiscipline(
  teamId: string,
  tournamentId?: string,
): Promise<TradeDisciplineRow> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_trade_discipline', {
    p_team_id: teamId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying trade discipline:', error)
    return {
      total_deaths: "0",
      traded_deaths: "0",
      first_deaths: "0",
      first_deaths_traded: "0",
      overall_trade_rate: "0.00",
      first_death_trade_rate: "0.00"
    }
  }

  return data?.[0] || {
    total_deaths: "0",
    traded_deaths: "0",
    first_deaths: "0",
    first_deaths_traded: "0",
    overall_trade_rate: "0.00",
    first_death_trade_rate: "0.00"
  }
}

/**
 * Query opening duels by player: per-player first kill/death statistics
 * MACRO-04: Opening Duels by Player
 */
export async function queryOpeningDuelsByPlayer(
  teamId: string,
  tournamentId?: string,
): Promise<OpeningDuelsByPlayerRow[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_opening_duels_by_player', {
    p_team_id: teamId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying opening duels by player:', error)
    return []
  }

  return data || []
}

/**
 * Query economy management: win rates by buy type (full/force/eco)
 * MACRO-05: Economy Management
 */
export async function queryEconomyManagement(
  teamId: string,
  tournamentId?: string,
): Promise<EconomyManagementRow[]> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_economy_management', {
    p_team_id: teamId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying economy management:', error)
    return []
  }

  return data || []
}

/**
 * Query timing patterns: average round duration and first kill timing
 * MACRO-06: Timing Patterns
 */
export async function queryTimingPatterns(
  teamId: string,
  tournamentId?: string,
): Promise<TimingPatternRow> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_timing_patterns', {
    p_team_id: teamId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying timing patterns:', error)
    return {
      avg_round_duration_ms: "0",
      avg_first_kill_time_ms: "0",
      rounds_analyzed: "0"
    }
  }

  return data?.[0] || {
    avg_round_duration_ms: "0",
    avg_first_kill_time_ms: "0",
    rounds_analyzed: "0"
  }
}

/**
 * Query ultimate economy: ultimate usage efficiency and availability win rates
 * MACRO-07: Ultimate Economy
 */
export async function queryUltimateEconomy(
  teamId: string,
  tournamentId?: string,
): Promise<UltimateEconomyRow> {
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_ultimate_economy', {
    p_team_id: teamId,
    p_tournament_id: tournamentId || null,
  })

  if (error) {
    console.error('Error querying ultimate economy:', error)
    return {
      total_rounds: "0",
      ultimates_used: "0",
      usage_rate: "0.000",
      rounds_with_ult_available: "0",
      ult_availability_win_rate: "0.000"
    }
  }

  return data?.[0] || {
    total_rounds: "0",
    ultimates_used: "0",
    usage_rate: "0.000",
    rounds_with_ult_available: "0",
    ult_availability_win_rate: "0.000"
  }
}

/**
 * Query round breakdown: chronological round data for game review
 * REVW-01: Round Breakdown
 */
export async function queryRoundBreakdown(
  teamId: string,
  gameId?: string,
  tournamentId?: string,
): Promise<RoundBreakdownRow[]> {
  const supabase = createServerClient()

  // Get games for this series/tournament first to get series info
  let gamesQuery = supabase
    .from('games')
    .select(`
      id,
      map_name,
      sequence_number,
      series!inner(team_a_id, team_b_id, tournament_id)
    `)

  if (gameId) {
    gamesQuery = gamesQuery.eq('id', gameId)
  }

  if (tournamentId) {
    gamesQuery = gamesQuery.eq('series.tournament_id', tournamentId)
  }

  const { data: games, error: gamesError } = await gamesQuery

  if (gamesError || !games || games.length === 0) {
    console.error('Error querying games:', gamesError)
    return []
  }

  // Get series info from first game
  const firstGame = games[0]
  const series = Array.isArray(firstGame.series) ? firstGame.series[0] : firstGame.series
  const isTeamA = series?.team_a_id === teamId

  // Get rounds for these games
  const gameIds = games.map(g => g.id)
  const { data: rounds, error: roundsError } = await supabase
    .from('rounds')
    .select(`
      id,
      round_number,
      game_id,
      winning_team_id,
      spike_planted,
      spike_defused,
      team_a_alive,
      team_b_alive,
      team_a_loadout_value,
      team_b_loadout_value,
      duration_ms
    `)
    .in('game_id', gameIds)
    .order('game_id')
    .order('round_number')

  if (roundsError || !rounds) {
    console.error('Error querying rounds:', roundsError)
    return []
  }

  // Get first blood info for each round
  const roundIds = rounds.map(r => r.id)
  const { data: firstBloods } = await supabase
    .from('player_round_stats')
    .select('round_id, team_id')
    .in('round_id', roundIds)
    .eq('first_kill', true)

  const firstBloodMap = new Map(
    firstBloods?.map(fb => [fb.round_id, fb.team_id]) || []
  )

  // Create game map for lookups
  const gameMap = new Map(games.map(g => [g.id, g]))

  // Transform results
  return rounds.map(row => {
    const game = gameMap.get(row.game_id) as typeof games[0] | undefined
    const teamLoadoutValue = isTeamA ? row.team_a_loadout_value : row.team_b_loadout_value
    const opponentLoadoutValue = isTeamA ? row.team_b_loadout_value : row.team_a_loadout_value

    return {
      round_id: row.id,
      round_number: String(row.round_number),
      game_id: row.game_id,
      map_name: game?.map_name || '',
      winning_team_id: row.winning_team_id,
      spike_planted: String(row.spike_planted),
      spike_defused: String(row.spike_defused),
      team_a_alive: String(row.team_a_alive),
      team_b_alive: String(row.team_b_alive),
      team_loadout_value: String(teamLoadoutValue),
      opponent_loadout_value: String(opponentLoadoutValue),
      duration_ms: String(row.duration_ms),
      first_blood_team_id: firstBloodMap.get(row.id) || null,
    }
  })
}

/**
 * Query rounds for critical moment classification
 * MACRO-08, REVW-02: Critical Moments
 */
export async function queryRoundsForCriticalMoments(
  teamId: string,
  gameId?: string,
  tournamentId?: string,
): Promise<RoundDataForClassification[]> {
  const supabase = createServerClient()

  // Get games for this series/tournament first to get series info
  let gamesQuery = supabase
    .from('games')
    .select(`
      id,
      sequence_number,
      series!inner(team_a_id, team_b_id, tournament_id)
    `)

  if (gameId) {
    gamesQuery = gamesQuery.eq('id', gameId)
  }

  if (tournamentId) {
    gamesQuery = gamesQuery.eq('series.tournament_id', tournamentId)
  }

  const { data: games, error: gamesError } = await gamesQuery

  if (gamesError || !games || games.length === 0) {
    console.error('Error querying games:', gamesError)
    return []
  }

  // Get series info from first game
  const firstGame = games[0]
  const series = Array.isArray(firstGame.series) ? firstGame.series[0] : firstGame.series
  const isTeamA = series?.team_a_id === teamId

  // Get rounds for these games
  const gameIds = games.map(g => g.id)
  const { data: rounds, error: roundsError } = await supabase
    .from('rounds')
    .select(`
      id,
      round_number,
      game_id,
      winning_team_id,
      team_a_alive,
      team_b_alive,
      team_a_loadout_value,
      team_b_loadout_value,
      spike_planted
    `)
    .in('game_id', gameIds)
    .order('game_id')
    .order('round_number')

  if (roundsError || !rounds) {
    console.error('Error querying rounds:', roundsError)
    return []
  }

  // Get first death traded info
  const roundIds = rounds.map(r => r.id)
  const { data: firstDeaths } = await supabase
    .from('player_round_stats')
    .select('round_id, traded')
    .in('round_id', roundIds)
    .eq('first_death', true)
    .eq('team_id', teamId)

  const firstDeathMap = new Map(
    firstDeaths?.map(fd => [fd.round_id, fd.traded]) || []
  )

  return rounds.map(row => {
    const teamLoadoutValue = isTeamA ? row.team_a_loadout_value : row.team_b_loadout_value

    return {
      round_id: row.id,
      round_number: row.round_number,
      game_id: row.game_id,
      winning_team_id: row.winning_team_id,
      team_a_alive: row.team_a_alive,
      team_b_alive: row.team_b_alive,
      team_loadout_value: teamLoadoutValue,
      spike_planted: row.spike_planted,
      first_death_traded: firstDeathMap.get(row.id) ?? true,
      is_pistol_round: row.round_number === 1 || row.round_number === 13,
      is_eco_round: teamLoadoutValue < 10000,
    }
  })
}
