-- Migration: Player Analytics Database Functions
-- Description: PostgreSQL functions for player performance metrics, agent pools,
--              first blood statistics, clutch performance, and performance trends

-- Create mosaic schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS mosaic;

-- Set search path for functions
SET search_path TO mosaic, public;

-- =============================================================================
-- Function 1: get_player_core_stats
-- Returns core player metrics: ACS, K/D, HS%, KAST
-- =============================================================================
CREATE OR REPLACE FUNCTION mosaic.get_player_core_stats(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  player_id TEXT,
  player_name TEXT,
  rounds_played BIGINT,
  acs NUMERIC(7,2),
  kd_ratio NUMERIC(5,2),
  adr NUMERIC(7,2),
  headshot_pct NUMERIC(5,2),
  kast_pct NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH player_rounds AS (
    SELECT
      prs.player_id,
      p.name AS player_name,
      COUNT(DISTINCT prs.round_id) AS rounds_played,
      SUM(prs.kills) AS total_kills,
      SUM(prs.deaths) AS total_deaths,
      SUM(prs.assists) AS total_assists,
      SUM(prs.damage_dealt) AS total_damage,
      -- KAST: Kills, Assists, Survived (deaths=0), or Traded
      COUNT(*) FILTER (
        WHERE prs.kills > 0
          OR prs.assists > 0
          OR prs.deaths = 0
          OR prs.traded = true
      ) AS kast_rounds
    FROM public.player_round_stats prs
    JOIN public.players p ON prs.player_id = p.id
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY prs.player_id, p.name
  ),
  headshot_stats AS (
    SELECT
      ke.killer_id AS player_id,
      COUNT(*) FILTER (WHERE ke.headshot = true) AS headshot_kills,
      COUNT(*) AS total_kills_from_events
    FROM public.kill_events ke
    JOIN public.rounds r ON ke.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      ke.killer_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY ke.killer_id
  )
  SELECT
    pr.player_id,
    pr.player_name,
    pr.rounds_played,
    -- ACS: Average Combat Score (damage per round)
    ROUND(pr.total_damage::NUMERIC / NULLIF(pr.rounds_played, 0), 2) AS acs,
    -- K/D Ratio
    ROUND(pr.total_kills::NUMERIC / NULLIF(pr.total_deaths, 0), 2) AS kd_ratio,
    -- ADR: Average Damage per Round
    ROUND(pr.total_damage::NUMERIC / NULLIF(pr.rounds_played, 0), 2) AS adr,
    -- Headshot %
    ROUND(
      COALESCE(hs.headshot_kills, 0)::NUMERIC / NULLIF(hs.total_kills_from_events, 0) * 100,
      2
    ) AS headshot_pct,
    -- KAST %
    ROUND(
      pr.kast_rounds::NUMERIC / NULLIF(pr.rounds_played, 0) * 100,
      2
    ) AS kast_pct
  FROM player_rounds pr
  LEFT JOIN headshot_stats hs ON pr.player_id = hs.player_id;
END;
$$;

GRANT EXECUTE ON FUNCTION mosaic.get_player_core_stats(TEXT, TEXT[]) TO authenticated, anon;

-- =============================================================================
-- Function 2: get_player_agent_pool
-- Returns agent pick rates and win rates
-- =============================================================================
CREATE OR REPLACE FUNCTION mosaic.get_player_agent_pool(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  agent TEXT,
  games_played BIGINT,
  rounds_played BIGINT,
  pick_rate NUMERIC(5,2),
  win_rate NUMERIC(5,2),
  avg_acs NUMERIC(7,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH player_total_games AS (
    SELECT COUNT(DISTINCT g.id) AS total_games
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
  ),
  agent_stats AS (
    SELECT
      prs.agent,
      COUNT(DISTINCT g.id) AS games_played,
      COUNT(DISTINCT prs.round_id) AS rounds_played,
      COUNT(DISTINCT r.id) FILTER (
        WHERE r.winning_team_id = prs.team_id
      ) AS rounds_won,
      COUNT(DISTINCT r.id) AS total_rounds,
      SUM(prs.damage_dealt) AS total_damage
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY prs.agent
  )
  SELECT
    a.agent,
    a.games_played::BIGINT,
    a.rounds_played::BIGINT,
    -- Pick rate: % of player's games on this agent
    ROUND(
      a.games_played::NUMERIC / NULLIF((SELECT total_games FROM player_total_games), 0) * 100,
      2
    ) AS pick_rate,
    -- Win rate: Round win rate on this agent
    ROUND(
      a.rounds_won::NUMERIC / NULLIF(a.total_rounds, 0) * 100,
      2
    ) AS win_rate,
    -- Average ACS on this agent
    ROUND(
      a.total_damage::NUMERIC / NULLIF(a.rounds_played, 0),
      2
    ) AS avg_acs
  FROM agent_stats a
  ORDER BY a.games_played DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION mosaic.get_player_agent_pool(TEXT, TEXT[]) TO authenticated, anon;

-- =============================================================================
-- Function 3: get_player_first_blood_stats
-- Returns first kill/death statistics
-- =============================================================================
CREATE OR REPLACE FUNCTION mosaic.get_player_first_blood_stats(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  first_kill_attempts BIGINT,
  first_kills BIGINT,
  first_deaths BIGINT,
  fk_rate NUMERIC(5,2),
  fd_rate NUMERIC(5,2),
  fk_fd_diff NUMERIC(6,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH first_blood_stats AS (
    SELECT
      COUNT(DISTINCT prs.round_id) AS total_rounds,
      COUNT(DISTINCT prs.round_id) FILTER (
        WHERE prs.first_kill = true OR prs.first_death = true
      ) AS first_kill_attempts,
      COUNT(DISTINCT prs.round_id) FILTER (
        WHERE prs.first_kill = true
      ) AS first_kills,
      COUNT(DISTINCT prs.round_id) FILTER (
        WHERE prs.first_death = true
      ) AS first_deaths
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
  )
  SELECT
    fb.first_kill_attempts::BIGINT,
    fb.first_kills::BIGINT,
    fb.first_deaths::BIGINT,
    -- First kill rate: first kills / attempts * 100
    ROUND(
      fb.first_kills::NUMERIC / NULLIF(fb.first_kill_attempts, 0) * 100,
      2
    ) AS fk_rate,
    -- First death rate: first deaths / total rounds * 100
    ROUND(
      fb.first_deaths::NUMERIC / NULLIF(fb.total_rounds, 0) * 100,
      2
    ) AS fd_rate,
    -- FK/FD differential
    ROUND(
      (fb.first_kills::NUMERIC / NULLIF(fb.first_kill_attempts, 0) * 100) -
      (fb.first_deaths::NUMERIC / NULLIF(fb.total_rounds, 0) * 100),
      2
    ) AS fk_fd_diff
  FROM first_blood_stats fb;
END;
$$;

GRANT EXECUTE ON FUNCTION mosaic.get_player_first_blood_stats(TEXT, TEXT[]) TO authenticated, anon;

-- =============================================================================
-- Function 4: get_player_clutch_stats
-- Returns clutch situation statistics
-- =============================================================================
CREATE OR REPLACE FUNCTION mosaic.get_player_clutch_stats(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  clutch_situations BIGINT,
  clutch_wins BIGINT,
  clutch_win_rate NUMERIC(5,2),
  clutch_1v1_wins BIGINT,
  clutch_1v2_wins BIGINT,
  clutch_1v3_plus_wins BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH clutch_data AS (
    SELECT
      COUNT(*) FILTER (
        WHERE prs.clutch_situation = true
      ) AS clutch_situations,
      COUNT(*) FILTER (
        WHERE prs.clutch_situation = true AND prs.clutch_won = true
      ) AS clutch_wins
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
  )
  SELECT
    cd.clutch_situations::BIGINT,
    cd.clutch_wins::BIGINT,
    -- Clutch win rate
    ROUND(
      cd.clutch_wins::NUMERIC / NULLIF(cd.clutch_situations, 0) * 100,
      2
    ) AS clutch_win_rate,
    -- Note: Lumina schema doesn't track clutch opponent count (1v1, 1v2, etc.)
    -- Returning NULL for these fields - would need rounds.team_X_alive to calculate
    NULL::BIGINT AS clutch_1v1_wins,
    NULL::BIGINT AS clutch_1v2_wins,
    NULL::BIGINT AS clutch_1v3_plus_wins
  FROM clutch_data cd;
END;
$$;

GRANT EXECUTE ON FUNCTION mosaic.get_player_clutch_stats(TEXT, TEXT[]) TO authenticated, anon;

-- =============================================================================
-- Function 5: get_player_performance_trend
-- Returns time-series ACS with moving average and trend indicator
-- =============================================================================
CREATE OR REPLACE FUNCTION mosaic.get_player_performance_trend(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  series_id TEXT,
  series_date TIMESTAMP WITH TIME ZONE,
  acs NUMERIC(7,2),
  acs_moving_avg NUMERIC(7,2),
  performance_trend TEXT
)
LANGUAGE sql
AS $$
  WITH series_performance AS (
    SELECT
      s.id AS series_id,
      s.start_time::TIMESTAMP WITH TIME ZONE AS series_date,
      ROUND(
        SUM(prs.damage_dealt)::NUMERIC /
        NULLIF(COUNT(DISTINCT prs.round_id), 0),
        2
      ) AS acs
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE
      prs.player_id = p_player_id
      AND s.id = ANY(p_series_ids)
    GROUP BY s.id, s.start_time
    ORDER BY s.start_time
  )
  SELECT
    series_id,
    series_date,
    acs,
    -- 3-series moving average using window function
    ROUND(
      AVG(acs) OVER (
        ORDER BY series_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
      ),
      2
    ) AS acs_moving_avg,
    -- Trend indicator using lag() to compare to previous series
    CASE
      WHEN acs > LAG(acs) OVER (ORDER BY series_date) THEN 'improving'
      WHEN acs < LAG(acs) OVER (ORDER BY series_date) THEN 'declining'
      ELSE 'stable'
    END AS performance_trend
  FROM series_performance;
$$;

GRANT EXECUTE ON FUNCTION mosaic.get_player_performance_trend(TEXT, TEXT[]) TO authenticated, anon;

-- =============================================================================
-- Function 6: get_team_players_summary
-- Returns JSONB summary of all players on a team
-- =============================================================================
CREATE OR REPLACE FUNCTION mosaic.get_team_players_summary(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH player_stats AS (
    SELECT
      prs.player_id,
      p.name AS player_name,
      COUNT(DISTINCT prs.round_id) AS rounds_played,
      ROUND(
        SUM(prs.damage_dealt)::NUMERIC / NULLIF(COUNT(DISTINCT prs.round_id), 0),
        2
      ) AS acs,
      ROUND(
        SUM(prs.kills)::NUMERIC / NULLIF(SUM(prs.deaths), 0),
        2
      ) AS kd_ratio,
      ROUND(
        COUNT(*) FILTER (
          WHERE prs.kills > 0 OR prs.assists > 0 OR prs.deaths = 0 OR prs.traded = true
        )::NUMERIC / NULLIF(COUNT(*), 0) * 100,
        2
      ) AS kast_pct
    FROM public.player_round_stats prs
    JOIN public.players p ON prs.player_id = p.id
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.team_id = p_team_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY prs.player_id, p.name
  ),
  top_agents AS (
    SELECT
      prs.player_id,
      jsonb_agg(prs.agent ORDER BY game_count DESC) AS agents
    FROM (
      SELECT
        prs.player_id,
        prs.agent,
        COUNT(DISTINCT g.id) AS game_count,
        ROW_NUMBER() OVER (PARTITION BY prs.player_id ORDER BY COUNT(DISTINCT g.id) DESC) AS rn
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      WHERE
        prs.team_id = p_team_id
        AND g.series_id = ANY(p_series_ids)
      GROUP BY prs.player_id, prs.agent
    ) prs
    WHERE rn <= 3
    GROUP BY prs.player_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'player_id', ps.player_id,
      'player_name', ps.player_name,
      'acs', ps.acs,
      'kd_ratio', ps.kd_ratio,
      'kast_pct', ps.kast_pct,
      'top_agents', COALESCE(ta.agents, '[]'::jsonb)
    )
    ORDER BY ps.acs DESC
  )
  INTO result
  FROM player_stats ps
  LEFT JOIN top_agents ta ON ps.player_id = ta.player_id;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION mosaic.get_team_players_summary(TEXT, TEXT[]) TO authenticated, anon;

-- =============================================================================
-- Comments for future reference
-- =============================================================================
COMMENT ON FUNCTION mosaic.get_player_core_stats IS 'Computes player core metrics (ACS, K/D, HS%, KAST) from public.player_round_stats and public.kill_events';
COMMENT ON FUNCTION mosaic.get_player_agent_pool IS 'Computes player agent pick rates and win rates per agent';
COMMENT ON FUNCTION mosaic.get_player_first_blood_stats IS 'Computes first kill/death statistics from public.player_round_stats flags';
COMMENT ON FUNCTION mosaic.get_player_clutch_stats IS 'Computes clutch situation statistics (clutch_situation and clutch_won flags)';
COMMENT ON FUNCTION mosaic.get_player_performance_trend IS 'Computes time-series ACS with 3-series moving average and trend indicator';
COMMENT ON FUNCTION mosaic.get_team_players_summary IS 'Returns JSONB summary of all players on a team with core stats and top agents';
