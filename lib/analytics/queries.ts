import type { Sql } from 'postgres'
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
  sql: Sql,
  playerId: string,
  tournamentId?: string,
): Promise<FirstDeathRow> {
  const result = tournamentId
    ? await sql<FirstDeathRow[]>`
      SELECT
        SUM(CASE WHEN r.winning_team_id != prs.team_id THEN 1 ELSE 0 END)::text as losses,
        COUNT(*)::text as total
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
        AND prs.first_death = TRUE
        AND prs.kills = 0
        AND prs.assists = 0
        AND s.tournament_id = ${tournamentId}
    `
    : await sql<FirstDeathRow[]>`
      SELECT
        SUM(CASE WHEN r.winning_team_id != prs.team_id THEN 1 ELSE 0 END)::text as losses,
        COUNT(*)::text as total
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
        AND prs.first_death = TRUE
        AND prs.kills = 0
        AND prs.assists = 0
    `

  return result[0] || { losses: "0", total: "0" }
}

/**
 * Query trading efficiency: how often player deaths are traded
 * PLAY-02: Trading Efficiency Metrics
 */
export async function queryTradingEfficiency(
  sql: Sql,
  playerId: string,
  tournamentId?: string,
): Promise<TradingRow> {
  const result = tournamentId
    ? await sql<TradingRow[]>`
      SELECT
        SUM(CASE WHEN prs.traded = TRUE THEN 1 ELSE 0 END)::text as traded,
        SUM(CASE WHEN prs.deaths > 0 THEN 1 ELSE 0 END)::text as total_deaths
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
        AND s.tournament_id = ${tournamentId}
    `
    : await sql<TradingRow[]>`
      SELECT
        SUM(CASE WHEN prs.traded = TRUE THEN 1 ELSE 0 END)::text as traded,
        SUM(CASE WHEN prs.deaths > 0 THEN 1 ELSE 0 END)::text as total_deaths
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
    `

  return result[0] || { traded: "0", total_deaths: "0" }
}

/**
 * Query opening duel performance: first kill and first death statistics
 * PLAY-03: Opening Duel Performance
 */
export async function queryOpeningDuels(
  sql: Sql,
  playerId: string,
  tournamentId?: string,
): Promise<OpeningDuelsRow> {
  const result = tournamentId
    ? await sql<OpeningDuelsRow[]>`
      SELECT
        SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::text as first_kills,
        SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::text as first_deaths,
        COUNT(*)::text as total_rounds
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
        AND s.tournament_id = ${tournamentId}
    `
    : await sql<OpeningDuelsRow[]>`
      SELECT
        SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::text as first_kills,
        SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::text as first_deaths,
        COUNT(*)::text as total_rounds
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
    `

  return result[0] || { first_kills: "0", first_deaths: "0", total_rounds: "0" }
}

/**
 * Query clutch performance: success rate in clutch situations
 * PLAY-04: Clutch Situation Analysis
 */
export async function queryClutchPerformance(
  sql: Sql,
  playerId: string,
  tournamentId?: string,
): Promise<ClutchRow> {
  const result = tournamentId
    ? await sql<ClutchRow[]>`
      SELECT
        SUM(CASE WHEN prs.clutch_won = TRUE THEN 1 ELSE 0 END)::text as clutches_won,
        COUNT(*)::text as clutch_situations
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
        AND prs.clutch_situation = TRUE
        AND s.tournament_id = ${tournamentId}
    `
    : await sql<ClutchRow[]>`
      SELECT
        SUM(CASE WHEN prs.clutch_won = TRUE THEN 1 ELSE 0 END)::text as clutches_won,
        COUNT(*)::text as clutch_situations
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
        AND prs.clutch_situation = TRUE
    `

  return result[0] || { clutches_won: "0", clutch_situations: "0" }
}

/**
 * Query agent performance: statistics grouped by agent
 * PLAY-05: Agent Performance Comparison
 */
export async function queryAgentPerformance(
  sql: Sql,
  playerId: string,
  tournamentId?: string,
): Promise<AgentRow[]> {
  const result = tournamentId
    ? await sql<AgentRow[]>`
      SELECT
        prs.agent,
        COUNT(*)::text as rounds_played,
        SUM(prs.kills)::text as total_kills,
        SUM(prs.deaths)::text as total_deaths,
        SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::text as first_kills,
        SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::text as first_deaths,
        SUM(CASE WHEN r.winning_team_id = prs.team_id THEN 1 ELSE 0 END)::text as rounds_won
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
        AND s.tournament_id = ${tournamentId}
      GROUP BY prs.agent
      ORDER BY COUNT(*) DESC
    `
    : await sql<AgentRow[]>`
      SELECT
        prs.agent,
        COUNT(*)::text as rounds_played,
        SUM(prs.kills)::text as total_kills,
        SUM(prs.deaths)::text as total_deaths,
        SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::text as first_kills,
        SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::text as first_deaths,
        SUM(CASE WHEN r.winning_team_id = prs.team_id THEN 1 ELSE 0 END)::text as rounds_won
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
      GROUP BY prs.agent
      ORDER BY COUNT(*) DESC
    `

  return result
}

/**
 * Query multi-kill rounds: 2K, 3K, 4K, and ace frequency
 * PLAY-06: Multi-Kill Round Tracking
 */
export async function queryMultiKillRounds(
  sql: Sql,
  playerId: string,
  tournamentId?: string,
): Promise<MultiKillRow> {
  const result = tournamentId
    ? await sql<MultiKillRow[]>`
      SELECT
        SUM(CASE WHEN prs.kills >= 2 THEN 1 ELSE 0 END)::text as two_plus_kills,
        SUM(CASE WHEN prs.kills >= 3 THEN 1 ELSE 0 END)::text as three_plus_kills,
        SUM(CASE WHEN prs.kills >= 4 THEN 1 ELSE 0 END)::text as four_plus_kills,
        SUM(CASE WHEN prs.kills = 5 THEN 1 ELSE 0 END)::text as aces,
        COUNT(*)::text as total_rounds,
        SUM(prs.kills)::text as total_kills
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
        AND s.tournament_id = ${tournamentId}
    `
    : await sql<MultiKillRow[]>`
      SELECT
        SUM(CASE WHEN prs.kills >= 2 THEN 1 ELSE 0 END)::text as two_plus_kills,
        SUM(CASE WHEN prs.kills >= 3 THEN 1 ELSE 0 END)::text as three_plus_kills,
        SUM(CASE WHEN prs.kills >= 4 THEN 1 ELSE 0 END)::text as four_plus_kills,
        SUM(CASE WHEN prs.kills = 5 THEN 1 ELSE 0 END)::text as aces,
        COUNT(*)::text as total_rounds,
        SUM(prs.kills)::text as total_kills
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
    `

  return result[0] || {
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
  sql: Sql,
  playerId: string,
  tournamentId?: string,
): Promise<EcoRoundRow[]> {
  const result = tournamentId
    ? await sql<EcoRoundRow[]>`
      SELECT
        r.phase,
        COUNT(*)::text as rounds,
        SUM(prs.kills)::text as total_kills,
        SUM(prs.deaths)::text as total_deaths,
        SUM(CASE WHEN r.winning_team_id = prs.team_id THEN 1 ELSE 0 END)::text as rounds_won
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
        AND r.phase IS NOT NULL
        AND s.tournament_id = ${tournamentId}
      GROUP BY r.phase
      ORDER BY r.phase
    `
    : await sql<EcoRoundRow[]>`
      SELECT
        r.phase,
        COUNT(*)::text as rounds,
        SUM(prs.kills)::text as total_kills,
        SUM(prs.deaths)::text as total_deaths,
        SUM(CASE WHEN r.winning_team_id = prs.team_id THEN 1 ELSE 0 END)::text as rounds_won
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.player_id = ${playerId}
        AND r.phase IS NOT NULL
      GROUP BY r.phase
      ORDER BY r.phase
    `

  return result
}
