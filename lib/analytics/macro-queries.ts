import type { Sql } from 'postgres'
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
  sql: Sql,
  teamId: string,
  tournamentId?: string,
  mapName?: string,
): Promise<PistolAnalysisRow> {
  const result = tournamentId
    ? await sql<PistolAnalysisRow[]>`
      WITH pistol_rounds AS (
        SELECT
          r.id,
          r.round_number,
          r.winning_team_id,
          g.map_name,
          CASE
            WHEN r.round_number IN (1, 13) THEN 'pistol'
            WHEN r.round_number IN (2, 14) THEN 'bonus'
          END as round_type
        FROM public.rounds r
        JOIN public.games g ON r.game_id = g.id
        JOIN public.series s ON g.series_id = s.id
        WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId})
          AND s.tournament_id = ${tournamentId}
          ${mapName ? sql`AND g.map_name = ${mapName}` : sql``}
      )
      SELECT
        COUNT(*) FILTER (WHERE round_type = 'pistol')::text as pistol_rounds,
        COUNT(*) FILTER (WHERE round_type = 'pistol' AND winning_team_id = ${teamId})::text as pistol_wins,
        COUNT(*) FILTER (WHERE round_type = 'bonus' AND winning_team_id = ${teamId})::text as bonus_wins,
        COUNT(*) FILTER (WHERE round_type = 'bonus')::text as total_bonus_rounds,
        ROUND(
          CASE
            WHEN COUNT(*) FILTER (WHERE round_type = 'pistol') > 0
            THEN (COUNT(*) FILTER (WHERE round_type = 'pistol' AND winning_team_id = ${teamId})::numeric /
                  COUNT(*) FILTER (WHERE round_type = 'pistol')::numeric * 100)
            ELSE 0
          END, 2
        )::text as pistol_win_rate
      FROM pistol_rounds
    `
    : await sql<PistolAnalysisRow[]>`
      WITH pistol_rounds AS (
        SELECT
          r.id,
          r.round_number,
          r.winning_team_id,
          g.map_name,
          CASE
            WHEN r.round_number IN (1, 13) THEN 'pistol'
            WHEN r.round_number IN (2, 14) THEN 'bonus'
          END as round_type
        FROM public.rounds r
        JOIN public.games g ON r.game_id = g.id
        JOIN public.series s ON g.series_id = s.id
        WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId})
          ${mapName ? sql`AND g.map_name = ${mapName}` : sql``}
      )
      SELECT
        COUNT(*) FILTER (WHERE round_type = 'pistol')::text as pistol_rounds,
        COUNT(*) FILTER (WHERE round_type = 'pistol' AND winning_team_id = ${teamId})::text as pistol_wins,
        COUNT(*) FILTER (WHERE round_type = 'bonus' AND winning_team_id = ${teamId})::text as bonus_wins,
        COUNT(*) FILTER (WHERE round_type = 'bonus')::text as total_bonus_rounds,
        ROUND(
          CASE
            WHEN COUNT(*) FILTER (WHERE round_type = 'pistol') > 0
            THEN (COUNT(*) FILTER (WHERE round_type = 'pistol' AND winning_team_id = ${teamId})::numeric /
                  COUNT(*) FILTER (WHERE round_type = 'pistol')::numeric * 100)
            ELSE 0
          END, 2
        )::text as pistol_win_rate
      FROM pistol_rounds
    `

  return result[0] || {
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
  sql: Sql,
  teamId: string,
  tournamentId?: string,
): Promise<FirstBloodConversionRow> {
  const result = tournamentId
    ? await sql<FirstBloodConversionRow[]>`
      WITH first_blood_rounds AS (
        SELECT
          r.id,
          r.winning_team_id,
          prs.team_id as first_blood_team_id
        FROM public.rounds r
        JOIN public.player_round_stats prs ON prs.round_id = r.id AND prs.first_kill = TRUE
        JOIN public.games g ON r.game_id = g.id
        JOIN public.series s ON g.series_id = s.id
        WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId})
          AND s.tournament_id = ${tournamentId}
      )
      SELECT
        COUNT(*) FILTER (WHERE first_blood_team_id = ${teamId})::text as first_bloods,
        COUNT(*) FILTER (WHERE first_blood_team_id = ${teamId} AND winning_team_id = ${teamId})::text as first_blood_wins,
        ROUND(
          CASE
            WHEN COUNT(*) FILTER (WHERE first_blood_team_id = ${teamId}) > 0
            THEN (COUNT(*) FILTER (WHERE first_blood_team_id = ${teamId} AND winning_team_id = ${teamId})::numeric /
                  COUNT(*) FILTER (WHERE first_blood_team_id = ${teamId})::numeric * 100)
            ELSE 0
          END, 2
        )::text as first_blood_conversion_rate
      FROM first_blood_rounds
    `
    : await sql<FirstBloodConversionRow[]>`
      WITH first_blood_rounds AS (
        SELECT
          r.id,
          r.winning_team_id,
          prs.team_id as first_blood_team_id
        FROM public.rounds r
        JOIN public.player_round_stats prs ON prs.round_id = r.id AND prs.first_kill = TRUE
        JOIN public.games g ON r.game_id = g.id
        JOIN public.series s ON g.series_id = s.id
        WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId})
      )
      SELECT
        COUNT(*) FILTER (WHERE first_blood_team_id = ${teamId})::text as first_bloods,
        COUNT(*) FILTER (WHERE first_blood_team_id = ${teamId} AND winning_team_id = ${teamId})::text as first_blood_wins,
        ROUND(
          CASE
            WHEN COUNT(*) FILTER (WHERE first_blood_team_id = ${teamId}) > 0
            THEN (COUNT(*) FILTER (WHERE first_blood_team_id = ${teamId} AND winning_team_id = ${teamId})::numeric /
                  COUNT(*) FILTER (WHERE first_blood_team_id = ${teamId})::numeric * 100)
            ELSE 0
          END, 2
        )::text as first_blood_conversion_rate
      FROM first_blood_rounds
    `

  return result[0] || {
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
  sql: Sql,
  teamId: string,
  tournamentId?: string,
): Promise<TradeDisciplineRow> {
  const result = tournamentId
    ? await sql<TradeDisciplineRow[]>`
      WITH team_deaths AS (
        SELECT
          prs.round_id,
          prs.player_id,
          prs.team_id,
          prs.deaths,
          prs.traded,
          prs.first_death
        FROM public.player_round_stats prs
        JOIN public.rounds r ON prs.round_id = r.id
        JOIN public.games g ON r.game_id = g.id
        JOIN public.series s ON g.series_id = s.id
        WHERE prs.team_id = ${teamId}
          AND prs.deaths > 0
          AND s.tournament_id = ${tournamentId}
      )
      SELECT
        COUNT(*)::text as total_deaths,
        COUNT(*) FILTER (WHERE traded = TRUE)::text as traded_deaths,
        COUNT(*) FILTER (WHERE first_death = TRUE)::text as first_deaths,
        COUNT(*) FILTER (WHERE first_death = TRUE AND traded = TRUE)::text as first_deaths_traded,
        ROUND(
          CASE
            WHEN COUNT(*) > 0
            THEN (COUNT(*) FILTER (WHERE traded = TRUE)::numeric / COUNT(*)::numeric * 100)
            ELSE 0
          END, 2
        )::text as overall_trade_rate,
        ROUND(
          CASE
            WHEN COUNT(*) FILTER (WHERE first_death = TRUE) > 0
            THEN (COUNT(*) FILTER (WHERE first_death = TRUE AND traded = TRUE)::numeric /
                  COUNT(*) FILTER (WHERE first_death = TRUE)::numeric * 100)
            ELSE 0
          END, 2
        )::text as first_death_trade_rate
      FROM team_deaths
    `
    : await sql<TradeDisciplineRow[]>`
      WITH team_deaths AS (
        SELECT
          prs.round_id,
          prs.player_id,
          prs.team_id,
          prs.deaths,
          prs.traded,
          prs.first_death
        FROM public.player_round_stats prs
        JOIN public.rounds r ON prs.round_id = r.id
        JOIN public.games g ON r.game_id = g.id
        JOIN public.series s ON g.series_id = s.id
        WHERE prs.team_id = ${teamId}
          AND prs.deaths > 0
      )
      SELECT
        COUNT(*)::text as total_deaths,
        COUNT(*) FILTER (WHERE traded = TRUE)::text as traded_deaths,
        COUNT(*) FILTER (WHERE first_death = TRUE)::text as first_deaths,
        COUNT(*) FILTER (WHERE first_death = TRUE AND traded = TRUE)::text as first_deaths_traded,
        ROUND(
          CASE
            WHEN COUNT(*) > 0
            THEN (COUNT(*) FILTER (WHERE traded = TRUE)::numeric / COUNT(*)::numeric * 100)
            ELSE 0
          END, 2
        )::text as overall_trade_rate,
        ROUND(
          CASE
            WHEN COUNT(*) FILTER (WHERE first_death = TRUE) > 0
            THEN (COUNT(*) FILTER (WHERE first_death = TRUE AND traded = TRUE)::numeric /
                  COUNT(*) FILTER (WHERE first_death = TRUE)::numeric * 100)
            ELSE 0
          END, 2
        )::text as first_death_trade_rate
      FROM team_deaths
    `

  return result[0] || {
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
  sql: Sql,
  teamId: string,
  tournamentId?: string,
): Promise<OpeningDuelsByPlayerRow[]> {
  const result = tournamentId
    ? await sql<OpeningDuelsByPlayerRow[]>`
      SELECT
        prs.player_id,
        SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::text as first_kills,
        SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::text as first_deaths,
        COUNT(*)::text as total_rounds
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.team_id = ${teamId}
        AND s.tournament_id = ${tournamentId}
      GROUP BY prs.player_id
      ORDER BY SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END) DESC
    `
    : await sql<OpeningDuelsByPlayerRow[]>`
      SELECT
        prs.player_id,
        SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::text as first_kills,
        SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::text as first_deaths,
        COUNT(*)::text as total_rounds
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.team_id = ${teamId}
      GROUP BY prs.player_id
      ORDER BY SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END) DESC
    `

  return result
}

/**
 * Query economy management: win rates by buy type (full/force/eco)
 * MACRO-05: Economy Management
 */
export async function queryEconomyManagement(
  sql: Sql,
  teamId: string,
  tournamentId?: string,
): Promise<EconomyManagementRow[]> {
  const result = tournamentId
    ? await sql<EconomyManagementRow[]>`
      WITH round_economy AS (
        SELECT
          r.id,
          r.round_number,
          r.winning_team_id,
          CASE
            WHEN s.team_a_id = ${teamId} THEN r.team_a_loadout_value
            ELSE r.team_b_loadout_value
          END as team_loadout_value,
          CASE
            WHEN (CASE WHEN s.team_a_id = ${teamId} THEN r.team_a_loadout_value ELSE r.team_b_loadout_value END) >= 20000 THEN 'full_buy'
            WHEN (CASE WHEN s.team_a_id = ${teamId} THEN r.team_a_loadout_value ELSE r.team_b_loadout_value END) >= 10000 THEN 'force_buy'
            ELSE 'eco'
          END as economy_decision
        FROM public.rounds r
        JOIN public.games g ON r.game_id = g.id
        JOIN public.series s ON g.series_id = s.id
        WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId})
          AND s.tournament_id = ${tournamentId}
      )
      SELECT
        economy_decision,
        COUNT(*)::text as rounds,
        COUNT(*) FILTER (WHERE winning_team_id = ${teamId})::text as wins,
        ROUND(
          COUNT(*) FILTER (WHERE winning_team_id = ${teamId})::numeric /
          NULLIF(COUNT(*), 0),
          3
        )::text as win_rate,
        AVG(team_loadout_value)::text as avg_loadout_value
      FROM round_economy
      GROUP BY economy_decision
      ORDER BY economy_decision
    `
    : await sql<EconomyManagementRow[]>`
      WITH round_economy AS (
        SELECT
          r.id,
          r.round_number,
          r.winning_team_id,
          CASE
            WHEN s.team_a_id = ${teamId} THEN r.team_a_loadout_value
            ELSE r.team_b_loadout_value
          END as team_loadout_value,
          CASE
            WHEN (CASE WHEN s.team_a_id = ${teamId} THEN r.team_a_loadout_value ELSE r.team_b_loadout_value END) >= 20000 THEN 'full_buy'
            WHEN (CASE WHEN s.team_a_id = ${teamId} THEN r.team_a_loadout_value ELSE r.team_b_loadout_value END) >= 10000 THEN 'force_buy'
            ELSE 'eco'
          END as economy_decision
        FROM public.rounds r
        JOIN public.games g ON r.game_id = g.id
        JOIN public.series s ON g.series_id = s.id
        WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId})
      )
      SELECT
        economy_decision,
        COUNT(*)::text as rounds,
        COUNT(*) FILTER (WHERE winning_team_id = ${teamId})::text as wins,
        ROUND(
          COUNT(*) FILTER (WHERE winning_team_id = ${teamId})::numeric /
          NULLIF(COUNT(*), 0),
          3
        )::text as win_rate,
        AVG(team_loadout_value)::text as avg_loadout_value
      FROM round_economy
      GROUP BY economy_decision
      ORDER BY economy_decision
    `

  return result
}

/**
 * Query timing patterns: average round duration and first kill timing
 * MACRO-06: Timing Patterns
 */
export async function queryTimingPatterns(
  sql: Sql,
  teamId: string,
  tournamentId?: string,
): Promise<TimingPatternRow> {
  const result = tournamentId
    ? await sql<TimingPatternRow[]>`
      SELECT
        AVG(r.duration_ms)::text as avg_round_duration_ms,
        (SELECT AVG(ke.game_time_ms)::text
         FROM public.kill_events ke
         WHERE ke.is_first_kill = TRUE
           AND ke.round_id IN (
             SELECT r2.id FROM public.rounds r2
             JOIN public.games g2 ON r2.game_id = g2.id
             JOIN public.series s2 ON g2.series_id = s2.id
             WHERE (s2.team_a_id = ${teamId} OR s2.team_b_id = ${teamId})
               AND s2.tournament_id = ${tournamentId}
           )
        ) as avg_first_kill_time_ms,
        COUNT(*)::text as rounds_analyzed
      FROM public.rounds r
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId})
        AND s.tournament_id = ${tournamentId}
    `
    : await sql<TimingPatternRow[]>`
      SELECT
        AVG(r.duration_ms)::text as avg_round_duration_ms,
        (SELECT AVG(ke.game_time_ms)::text
         FROM public.kill_events ke
         WHERE ke.is_first_kill = TRUE
           AND ke.round_id IN (
             SELECT r2.id FROM public.rounds r2
             JOIN public.games g2 ON r2.game_id = g2.id
             JOIN public.series s2 ON g2.series_id = s2.id
             WHERE (s2.team_a_id = ${teamId} OR s2.team_b_id = ${teamId})
           )
        ) as avg_first_kill_time_ms,
        COUNT(*)::text as rounds_analyzed
      FROM public.rounds r
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId})
    `

  return result[0] || {
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
  sql: Sql,
  teamId: string,
  tournamentId?: string,
): Promise<UltimateEconomyRow> {
  const result = tournamentId
    ? await sql<UltimateEconomyRow[]>`
      SELECT
        COUNT(*)::text as total_rounds,
        SUM(CASE WHEN prs.ultimate_used = TRUE THEN 1 ELSE 0 END)::text as ultimates_used,
        ROUND(
          SUM(CASE WHEN prs.ultimate_used = TRUE THEN 1 ELSE 0 END)::numeric /
          NULLIF(COUNT(*), 0),
          3
        )::text as usage_rate,
        SUM(CASE WHEN prs.ultimate_points >= 7 THEN 1 ELSE 0 END)::text as rounds_with_ult_available,
        ROUND(
          SUM(CASE WHEN prs.ultimate_points >= 7 AND r.winning_team_id = prs.team_id THEN 1 ELSE 0 END)::numeric /
          NULLIF(SUM(CASE WHEN prs.ultimate_points >= 7 THEN 1 ELSE 0 END), 0),
          3
        )::text as ult_availability_win_rate
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.team_id = ${teamId}
        AND s.tournament_id = ${tournamentId}
    `
    : await sql<UltimateEconomyRow[]>`
      SELECT
        COUNT(*)::text as total_rounds,
        SUM(CASE WHEN prs.ultimate_used = TRUE THEN 1 ELSE 0 END)::text as ultimates_used,
        ROUND(
          SUM(CASE WHEN prs.ultimate_used = TRUE THEN 1 ELSE 0 END)::numeric /
          NULLIF(COUNT(*), 0),
          3
        )::text as usage_rate,
        SUM(CASE WHEN prs.ultimate_points >= 7 THEN 1 ELSE 0 END)::text as rounds_with_ult_available,
        ROUND(
          SUM(CASE WHEN prs.ultimate_points >= 7 AND r.winning_team_id = prs.team_id THEN 1 ELSE 0 END)::numeric /
          NULLIF(SUM(CASE WHEN prs.ultimate_points >= 7 THEN 1 ELSE 0 END), 0),
          3
        )::text as ult_availability_win_rate
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.team_id = ${teamId}
    `

  return result[0] || {
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
  sql: Sql,
  teamId: string,
  gameId?: string,
  tournamentId?: string,
): Promise<RoundBreakdownRow[]> {
  const result = await sql<RoundBreakdownRow[]>`
    SELECT
      r.id as round_id,
      r.round_number::text,
      r.game_id,
      g.map_name,
      r.winning_team_id,
      r.spike_planted::text,
      r.spike_defused::text,
      r.team_a_alive::text,
      r.team_b_alive::text,
      CASE
        WHEN s.team_a_id = ${teamId} THEN r.team_a_loadout_value
        ELSE r.team_b_loadout_value
      END::text as team_loadout_value,
      CASE
        WHEN s.team_a_id = ${teamId} THEN r.team_b_loadout_value
        ELSE r.team_a_loadout_value
      END::text as opponent_loadout_value,
      r.duration_ms::text,
      (SELECT prs.team_id FROM public.player_round_stats prs
       WHERE prs.round_id = r.id AND prs.first_kill = TRUE LIMIT 1) as first_blood_team_id
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId})
      ${gameId ? sql`AND r.game_id = ${gameId}` : sql``}
      ${tournamentId ? sql`AND s.tournament_id = ${tournamentId}` : sql``}
    ORDER BY g.sequence_number, r.round_number
  `

  return result
}

/**
 * Query rounds for critical moment classification
 * MACRO-08, REVW-02: Critical Moments
 */
export async function queryRoundsForCriticalMoments(
  sql: Sql,
  teamId: string,
  gameId?: string,
  tournamentId?: string,
): Promise<RoundDataForClassification[]> {
  const result = await sql<RoundDataForClassification[]>`
    SELECT
      r.id as round_id,
      r.round_number,
      r.game_id,
      r.winning_team_id,
      r.team_a_alive,
      r.team_b_alive,
      CASE
        WHEN s.team_a_id = ${teamId} THEN r.team_a_loadout_value
        ELSE r.team_b_loadout_value
      END as team_loadout_value,
      r.spike_planted,
      COALESCE(
        (SELECT prs.traded FROM public.player_round_stats prs
         WHERE prs.round_id = r.id AND prs.first_death = TRUE AND prs.team_id = ${teamId}
         LIMIT 1),
        true
      ) as first_death_traded,
      (r.round_number IN (1, 13)) as is_pistol_round,
      (CASE
        WHEN s.team_a_id = ${teamId} THEN r.team_a_loadout_value < 10000
        ELSE r.team_b_loadout_value < 10000
      END) as is_eco_round
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId})
      ${gameId ? sql`AND r.game_id = ${gameId}` : sql``}
      ${tournamentId ? sql`AND s.tournament_id = ${tournamentId}` : sql``}
    ORDER BY g.sequence_number, r.round_number
  `

  return result
}
