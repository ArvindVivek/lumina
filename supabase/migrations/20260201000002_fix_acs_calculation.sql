-- Fix ACS (Average Combat Score) calculation
-- Issue: ACS was being calculated as damage_dealt / rounds_played (which is ADR, not ACS)
-- Fix: Use VALORANT's approximate ACS formula:
--      ACS = (kills * 150 + damage_dealt + assists * 25 + first_bloods * 50) / rounds_played
--
-- Note: VALORANT's exact ACS formula includes multi-kill bonuses and other factors,
-- but this approximation is much closer than just using damage/round

-- =============================================================================
-- Function 1: Fix get_player_core_stats
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
      -- Count first bloods
      COUNT(*) FILTER (WHERE prs.first_kill = true) AS first_bloods,
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
    -- ACS: Average Combat Score (VALORANT approximate formula)
    -- kills * 150 + damage + assists * 25 + first_bloods * 50
    ROUND(
      (pr.total_kills::NUMERIC * 150 + pr.total_damage::NUMERIC + pr.total_assists::NUMERIC * 25 + pr.first_bloods::NUMERIC * 50) /
      NULLIF(pr.rounds_played, 0),
      2
    ) AS acs,
    -- K/D Ratio
    ROUND(pr.total_kills::NUMERIC / NULLIF(pr.total_deaths, 0), 2) AS kd_ratio,
    -- ADR: Average Damage per Round (this is what was incorrectly labeled as ACS before)
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

-- =============================================================================
-- Function 2: Fix get_player_agent_pool
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
      SUM(prs.kills) AS total_kills,
      SUM(prs.assists) AS total_assists,
      SUM(prs.damage_dealt) AS total_damage,
      COUNT(*) FILTER (WHERE prs.first_kill = true) AS first_bloods
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
    -- Average ACS on this agent (using correct formula)
    ROUND(
      (a.total_kills::NUMERIC * 150 + a.total_damage::NUMERIC + a.total_assists::NUMERIC * 25 + a.first_bloods::NUMERIC * 50) /
      NULLIF(a.rounds_played, 0),
      2
    ) AS avg_acs
  FROM agent_stats a
  ORDER BY a.games_played DESC;
END;
$$;

-- =============================================================================
-- Function 3: Fix get_player_performance_trend
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
      -- ACS using correct formula
      ROUND(
        (SUM(prs.kills)::NUMERIC * 150 + SUM(prs.damage_dealt)::NUMERIC + SUM(prs.assists)::NUMERIC * 25 +
         COUNT(*) FILTER (WHERE prs.first_kill = true)::NUMERIC * 50) /
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

-- =============================================================================
-- Function 4: Fix get_team_players_summary
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
      -- ACS using correct formula
      ROUND(
        (SUM(prs.kills)::NUMERIC * 150 + SUM(prs.damage_dealt)::NUMERIC + SUM(prs.assists)::NUMERIC * 25 +
         COUNT(*) FILTER (WHERE prs.first_kill = true)::NUMERIC * 50) /
        NULLIF(COUNT(DISTINCT prs.round_id), 0),
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

-- =============================================================================
-- Refresh materialized views with correct ACS formula
-- =============================================================================

-- Drop and recreate mv_player_core_stats with correct ACS
DROP MATERIALIZED VIEW IF EXISTS mosaic.mv_player_core_stats CASCADE;

CREATE MATERIALIZED VIEW mosaic.mv_player_core_stats AS
WITH player_rounds AS (
  SELECT
    prs.player_id,
    p.name AS player_name,
    prs.team_id,
    g.series_id,
    COUNT(DISTINCT prs.round_id) AS rounds_played,
    SUM(prs.kills) AS total_kills,
    SUM(prs.deaths) AS total_deaths,
    SUM(prs.assists) AS total_assists,
    SUM(prs.damage_dealt) AS total_damage,
    COUNT(*) FILTER (WHERE prs.first_kill = true) AS first_bloods,
    -- KAST rounds: Kill, Assist, Survived, or Traded
    COUNT(*) FILTER (
      WHERE prs.kills > 0 OR prs.assists > 0 OR prs.deaths = 0 OR prs.traded = true
    ) AS kast_rounds
  FROM public.player_round_stats prs
  JOIN public.players p ON prs.player_id = p.id
  JOIN public.rounds r ON prs.round_id = r.id
  JOIN public.games g ON r.game_id = g.id
  GROUP BY prs.player_id, p.name, prs.team_id, g.series_id
),
headshots AS (
  SELECT
    ke.killer_id AS player_id,
    g.series_id,
    COUNT(*) FILTER (WHERE ke.headshot = true) AS headshot_kills,
    COUNT(*) AS total_kills_with_data
  FROM public.kill_events ke
  JOIN public.rounds r ON ke.round_id = r.id
  JOIN public.games g ON r.game_id = g.id
  WHERE ke.killer_id IS NOT NULL
  GROUP BY ke.killer_id, g.series_id
)
SELECT
  pr.player_id,
  pr.player_name,
  pr.team_id,
  pr.series_id,
  pr.rounds_played,
  -- ACS using correct VALORANT formula
  ROUND(
    (pr.total_kills::NUMERIC * 150 + pr.total_damage::NUMERIC + pr.total_assists::NUMERIC * 25 + pr.first_bloods::NUMERIC * 50) /
    NULLIF(pr.rounds_played, 0),
    2
  ) AS acs,
  ROUND(pr.total_kills::NUMERIC / NULLIF(pr.total_deaths, 0), 2) AS kd_ratio,
  -- ADR is separate from ACS
  ROUND(pr.total_damage::NUMERIC / NULLIF(pr.rounds_played, 0), 2) AS adr,
  ROUND(
    COALESCE(hs.headshot_kills, 0)::NUMERIC / NULLIF(COALESCE(hs.total_kills_with_data, 0), 0) * 100,
    2
  ) AS headshot_pct,
  ROUND(pr.kast_rounds::NUMERIC / NULLIF(pr.rounds_played, 0) * 100, 2) AS kast_pct,
  pr.total_kills,
  pr.total_deaths,
  pr.total_assists
FROM player_rounds pr
LEFT JOIN headshots hs ON pr.player_id = hs.player_id AND pr.series_id = hs.series_id;

-- Drop and recreate mv_player_agent_pool with correct ACS
DROP MATERIALIZED VIEW IF EXISTS mosaic.mv_player_agent_pool CASCADE;

CREATE MATERIALIZED VIEW mosaic.mv_player_agent_pool AS
SELECT
  prs.player_id,
  p.name AS player_name,
  prs.agent,
  g.series_id,
  COUNT(DISTINCT g.id) AS games_played,
  COUNT(DISTINCT prs.round_id) AS rounds_played,
  ROUND(
    COUNT(DISTINCT r.id) FILTER (WHERE r.winning_team_id = prs.team_id)::NUMERIC /
    NULLIF(COUNT(DISTINCT r.id), 0) * 100,
    2
  ) AS win_rate,
  -- ACS using correct formula
  ROUND(
    (SUM(prs.kills)::NUMERIC * 150 + SUM(prs.damage_dealt)::NUMERIC + SUM(prs.assists)::NUMERIC * 25 +
     COUNT(*) FILTER (WHERE prs.first_kill = true)::NUMERIC * 50) /
    NULLIF(COUNT(DISTINCT prs.round_id), 0),
    2
  ) AS avg_acs
FROM public.player_round_stats prs
JOIN public.players p ON prs.player_id = p.id
JOIN public.rounds r ON prs.round_id = r.id
JOIN public.games g ON r.game_id = g.id
GROUP BY prs.player_id, p.name, prs.agent, g.series_id;

-- Create indexes for the materialized views
CREATE UNIQUE INDEX IF NOT EXISTS mv_player_core_stats_idx ON mosaic.mv_player_core_stats (player_id, series_id);
CREATE UNIQUE INDEX IF NOT EXISTS mv_player_agent_pool_idx ON mosaic.mv_player_agent_pool (player_id, agent, series_id);

-- Grant permissions
GRANT SELECT ON mosaic.mv_player_core_stats TO authenticated, anon;
GRANT SELECT ON mosaic.mv_player_agent_pool TO authenticated, anon;
