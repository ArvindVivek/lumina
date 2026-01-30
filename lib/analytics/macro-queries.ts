import type { Sql } from 'postgres'
import {
  PistolAnalysisRow,
  FirstBloodConversionRow,
  TradeDisciplineRow,
} from './macro-types'

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
