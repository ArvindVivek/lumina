-- Implement proper VALORANT ACS (Average Combat Score) formula
--
-- ACS = (damage + kill_points + multikill_bonus + non_damaging_assists*25) / rounds_played
--
-- Kill Points by enemies alive when kill happens:
--   5 enemies alive: 150 points
--   4 enemies alive: 130 points
--   3 enemies alive: 110 points
--   2 enemies alive: 90 points
--   1 enemy alive: 70 points
--
-- Multikill Bonus: +50 points for each additional kill in rapid succession
--
-- Non-damaging assists: 25 points each

-- =============================================================================
-- Helper Function: Calculate kill points based on enemies alive
-- =============================================================================
CREATE OR REPLACE FUNCTION mosaic.get_kill_points(enemies_alive INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE enemies_alive
    WHEN 5 THEN 150
    WHEN 4 THEN 130
    WHEN 3 THEN 110
    WHEN 2 THEN 90
    WHEN 1 THEN 70
    ELSE 100  -- fallback
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- Materialized View: Pre-calculated round ACS for performance
-- This calculates the combat score for each player in each round using:
-- - Damage dealt
-- - Kill points based on enemies remaining
-- - Multikill bonuses for kills within 3 seconds
-- - Assist points (25 per assist)
-- =============================================================================
DROP MATERIALIZED VIEW IF EXISTS mosaic.mv_round_acs CASCADE;

CREATE MATERIALIZED VIEW mosaic.mv_round_acs AS
WITH round_player_teams AS (
  -- Get which team each player is on in each round
  SELECT DISTINCT
    prs.round_id,
    prs.player_id,
    prs.team_id
  FROM public.player_round_stats prs
),
round_kills_ordered AS (
  -- Get all kills with their order within the round
  -- and join to get the killer's team
  SELECT
    ke.id AS kill_id,
    ke.round_id,
    ke.killer_id,
    ke.victim_id,
    ke.game_time_ms,
    rpt.team_id AS killer_team_id,
    ROW_NUMBER() OVER (
      PARTITION BY ke.round_id, rpt.team_id
      ORDER BY ke.game_time_ms
    ) AS team_kill_order
  FROM public.kill_events ke
  JOIN round_player_teams rpt ON ke.round_id = rpt.round_id AND ke.killer_id = rpt.player_id
  WHERE ke.killer_id IS NOT NULL
),
kill_points AS (
  -- Calculate kill points based on enemies remaining
  -- enemies_alive = 5 - (number of previous kills by this killer's team in this round)
  SELECT
    rko.round_id,
    rko.killer_id,
    rko.game_time_ms,
    -- Calculate enemies alive: starts at 5, decreases with each team kill
    CASE GREATEST(1, 5 - (rko.team_kill_order - 1)::INTEGER)
      WHEN 5 THEN 150
      WHEN 4 THEN 130
      WHEN 3 THEN 110
      WHEN 2 THEN 90
      ELSE 70
    END AS kill_pts,
    -- Check if this is a multikill (within 3s of previous kill by same player)
    CASE
      WHEN (rko.game_time_ms - LAG(rko.game_time_ms) OVER (
        PARTITION BY rko.round_id, rko.killer_id ORDER BY rko.game_time_ms
      )) <= 3000 THEN 50
      ELSE 0
    END AS multikill_bonus
  FROM round_kills_ordered rko
),
player_kill_points AS (
  -- Aggregate kill points per player per round
  SELECT
    round_id,
    killer_id AS player_id,
    SUM(kill_pts) AS total_kill_points,
    SUM(multikill_bonus) AS total_multikill_bonus
  FROM kill_points
  GROUP BY round_id, killer_id
),
player_assists AS (
  -- Count assists per player per round (25 points each)
  SELECT
    round_id,
    assister_id AS player_id,
    COUNT(*) * 25 AS assist_points
  FROM public.kill_assists
  GROUP BY round_id, assister_id
)
SELECT
  prs.round_id,
  prs.player_id,
  prs.team_id,
  g.series_id,
  -- Raw components
  COALESCE(prs.damage_dealt, 0) AS damage,
  COALESCE(pkp.total_kill_points, 0) AS kill_points,
  COALESCE(pkp.total_multikill_bonus, 0) AS multikill_bonus,
  COALESCE(pa.assist_points, 0) AS assist_points,
  -- Total ACS for this round
  (
    COALESCE(prs.damage_dealt, 0) +
    COALESCE(pkp.total_kill_points, 0) +
    COALESCE(pkp.total_multikill_bonus, 0) +
    COALESCE(pa.assist_points, 0)
  )::INTEGER AS round_acs
FROM public.player_round_stats prs
JOIN public.rounds r ON prs.round_id = r.id
JOIN public.games g ON r.game_id = g.id
LEFT JOIN player_kill_points pkp ON prs.round_id = pkp.round_id AND prs.player_id = pkp.player_id
LEFT JOIN player_assists pa ON prs.round_id = pa.round_id AND prs.player_id = pa.player_id;

CREATE INDEX idx_mv_round_acs_player ON mosaic.mv_round_acs (player_id, series_id);
CREATE INDEX idx_mv_round_acs_team ON mosaic.mv_round_acs (team_id, series_id);
CREATE INDEX idx_mv_round_acs_round ON mosaic.mv_round_acs (round_id);

-- =============================================================================
-- Update get_player_core_stats to use proper ACS
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
  WITH player_acs AS (
    SELECT
      ra.player_id,
      COUNT(*) AS rounds_played,
      SUM(ra.round_acs) AS total_combat_score,
      SUM(ra.damage) AS total_damage
    FROM mosaic.mv_round_acs ra
    WHERE ra.player_id = p_player_id
      AND ra.series_id = ANY(p_series_ids)
    GROUP BY ra.player_id
  ),
  player_kda AS (
    SELECT
      prs.player_id,
      SUM(prs.kills) AS total_kills,
      SUM(prs.deaths) AS total_deaths,
      -- KAST: Kills, Assists, Survived (deaths=0), or Traded
      COUNT(*) FILTER (
        WHERE prs.kills > 0
          OR prs.assists > 0
          OR prs.deaths = 0
          OR prs.traded = true
      ) AS kast_rounds,
      COUNT(*) AS total_rounds
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE prs.player_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY prs.player_id
  ),
  headshot_stats AS (
    SELECT
      ke.killer_id AS player_id,
      COUNT(*) FILTER (WHERE ke.headshot = true) AS headshot_kills,
      COUNT(*) AS total_kills_from_events
    FROM public.kill_events ke
    JOIN public.rounds r ON ke.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE ke.killer_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY ke.killer_id
  )
  SELECT
    pa.player_id,
    p.name AS player_name,
    pa.rounds_played,
    -- ACS: Average Combat Score (proper formula)
    ROUND(pa.total_combat_score::NUMERIC / NULLIF(pa.rounds_played, 0), 2) AS acs,
    -- K/D Ratio
    ROUND(pk.total_kills::NUMERIC / NULLIF(pk.total_deaths, 0), 2) AS kd_ratio,
    -- ADR: Average Damage per Round
    ROUND(pa.total_damage::NUMERIC / NULLIF(pa.rounds_played, 0), 2) AS adr,
    -- Headshot %
    ROUND(
      COALESCE(hs.headshot_kills, 0)::NUMERIC / NULLIF(hs.total_kills_from_events, 0) * 100,
      2
    ) AS headshot_pct,
    -- KAST %
    ROUND(pk.kast_rounds::NUMERIC / NULLIF(pk.total_rounds, 0) * 100, 2) AS kast_pct
  FROM player_acs pa
  JOIN public.players p ON pa.player_id = p.id
  LEFT JOIN player_kda pk ON pa.player_id = pk.player_id
  LEFT JOIN headshot_stats hs ON pa.player_id = hs.player_id;
END;
$$;

-- =============================================================================
-- Update get_player_agent_pool to use proper ACS
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
    WHERE prs.player_id = p_player_id
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
      COUNT(DISTINCT r.id) AS total_rounds
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE prs.player_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY prs.agent
  ),
  agent_acs AS (
    SELECT
      prs.agent,
      SUM(ra.round_acs) AS total_combat_score,
      COUNT(*) AS round_count
    FROM public.player_round_stats prs
    JOIN mosaic.mv_round_acs ra ON prs.round_id = ra.round_id AND prs.player_id = ra.player_id
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE prs.player_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY prs.agent
  )
  SELECT
    a.agent,
    a.games_played::BIGINT,
    a.rounds_played::BIGINT,
    -- Pick rate
    ROUND(
      a.games_played::NUMERIC / NULLIF((SELECT total_games FROM player_total_games), 0) * 100,
      2
    ) AS pick_rate,
    -- Win rate
    ROUND(a.rounds_won::NUMERIC / NULLIF(a.total_rounds, 0) * 100, 2) AS win_rate,
    -- Average ACS (proper formula)
    ROUND(
      aa.total_combat_score::NUMERIC / NULLIF(aa.round_count, 0),
      2
    ) AS avg_acs
  FROM agent_stats a
  LEFT JOIN agent_acs aa ON a.agent = aa.agent
  ORDER BY a.games_played DESC;
END;
$$;

-- =============================================================================
-- Update get_player_performance_trend to use proper ACS
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
      ra.series_id,
      s.start_time::TIMESTAMP WITH TIME ZONE AS series_date,
      ROUND(SUM(ra.round_acs)::NUMERIC / NULLIF(COUNT(*), 0), 2) AS acs
    FROM mosaic.mv_round_acs ra
    JOIN public.series s ON ra.series_id = s.id
    WHERE ra.player_id = p_player_id
      AND ra.series_id = ANY(p_series_ids)
    GROUP BY ra.series_id, s.start_time
    ORDER BY s.start_time
  )
  SELECT
    series_id,
    series_date,
    acs,
    -- 3-series moving average
    ROUND(
      AVG(acs) OVER (
        ORDER BY series_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
      ),
      2
    ) AS acs_moving_avg,
    -- Trend indicator
    CASE
      WHEN acs > LAG(acs) OVER (ORDER BY series_date) THEN 'improving'
      WHEN acs < LAG(acs) OVER (ORDER BY series_date) THEN 'declining'
      ELSE 'stable'
    END AS performance_trend
  FROM series_performance;
$$;

-- =============================================================================
-- Update get_team_players_summary to use proper ACS
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
  WITH player_acs AS (
    SELECT
      ra.player_id,
      SUM(ra.round_acs) AS total_combat_score,
      COUNT(*) AS rounds_played
    FROM mosaic.mv_round_acs ra
    WHERE ra.team_id = p_team_id
      AND ra.series_id = ANY(p_series_ids)
    GROUP BY ra.player_id
  ),
  player_stats AS (
    SELECT
      prs.player_id,
      p.name AS player_name,
      COUNT(DISTINCT prs.round_id) AS rounds_played,
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
    WHERE prs.team_id = p_team_id
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
      WHERE prs.team_id = p_team_id
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
      'acs', ROUND(pa.total_combat_score::NUMERIC / NULLIF(pa.rounds_played, 0), 2),
      'kd_ratio', ps.kd_ratio,
      'kast_pct', ps.kast_pct,
      'top_agents', COALESCE(ta.agents, '[]'::jsonb)
    )
    ORDER BY (pa.total_combat_score::NUMERIC / NULLIF(pa.rounds_played, 0)) DESC
  )
  INTO result
  FROM player_stats ps
  JOIN player_acs pa ON ps.player_id = pa.player_id
  LEFT JOIN top_agents ta ON ps.player_id = ta.player_id;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- =============================================================================
-- Update materialized views with proper ACS
-- =============================================================================
DROP MATERIALIZED VIEW IF EXISTS mosaic.mv_player_core_stats CASCADE;

CREATE MATERIALIZED VIEW mosaic.mv_player_core_stats AS
WITH player_acs AS (
  SELECT
    ra.player_id,
    ra.team_id,
    ra.series_id,
    COUNT(*) AS rounds_played,
    SUM(ra.round_acs) AS total_combat_score,
    SUM(ra.damage) AS total_damage
  FROM mosaic.mv_round_acs ra
  GROUP BY ra.player_id, ra.team_id, ra.series_id
),
player_kda AS (
  SELECT
    prs.player_id,
    g.series_id,
    SUM(prs.kills) AS total_kills,
    SUM(prs.deaths) AS total_deaths,
    SUM(prs.assists) AS total_assists,
    COUNT(*) FILTER (
      WHERE prs.kills > 0 OR prs.assists > 0 OR prs.deaths = 0 OR prs.traded = true
    ) AS kast_rounds,
    COUNT(*) AS total_rounds
  FROM public.player_round_stats prs
  JOIN public.rounds r ON prs.round_id = r.id
  JOIN public.games g ON r.game_id = g.id
  GROUP BY prs.player_id, g.series_id
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
  pa.player_id,
  p.name AS player_name,
  pa.team_id,
  pa.series_id,
  pa.rounds_played,
  -- ACS using proper formula
  ROUND(pa.total_combat_score::NUMERIC / NULLIF(pa.rounds_played, 0), 2) AS acs,
  ROUND(pk.total_kills::NUMERIC / NULLIF(pk.total_deaths, 0), 2) AS kd_ratio,
  ROUND(pa.total_damage::NUMERIC / NULLIF(pa.rounds_played, 0), 2) AS adr,
  ROUND(
    COALESCE(hs.headshot_kills, 0)::NUMERIC / NULLIF(COALESCE(hs.total_kills_with_data, 0), 0) * 100,
    2
  ) AS headshot_pct,
  ROUND(pk.kast_rounds::NUMERIC / NULLIF(pk.total_rounds, 0) * 100, 2) AS kast_pct,
  pk.total_kills,
  pk.total_deaths,
  pk.total_assists
FROM player_acs pa
JOIN public.players p ON pa.player_id = p.id
LEFT JOIN player_kda pk ON pa.player_id = pk.player_id AND pa.series_id = pk.series_id
LEFT JOIN headshots hs ON pa.player_id = hs.player_id AND pa.series_id = hs.series_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_player_core_stats_idx ON mosaic.mv_player_core_stats (player_id, series_id);

-- Recreate agent pool view
DROP MATERIALIZED VIEW IF EXISTS mosaic.mv_player_agent_pool CASCADE;

CREATE MATERIALIZED VIEW mosaic.mv_player_agent_pool AS
WITH agent_rounds AS (
  SELECT
    prs.player_id,
    p.name AS player_name,
    prs.agent,
    g.series_id,
    prs.round_id,
    prs.team_id,
    g.id AS game_id
  FROM public.player_round_stats prs
  JOIN public.players p ON prs.player_id = p.id
  JOIN public.rounds r ON prs.round_id = r.id
  JOIN public.games g ON r.game_id = g.id
),
agent_acs AS (
  SELECT
    ar.player_id,
    ar.agent,
    ar.series_id,
    SUM(ra.round_acs) AS total_combat_score,
    COUNT(*) AS round_count
  FROM agent_rounds ar
  JOIN mosaic.mv_round_acs ra ON ar.round_id = ra.round_id AND ar.player_id = ra.player_id
  GROUP BY ar.player_id, ar.agent, ar.series_id
)
SELECT
  ar.player_id,
  ar.player_name,
  ar.agent,
  ar.series_id,
  COUNT(DISTINCT ar.game_id) AS games_played,
  COUNT(DISTINCT ar.round_id) AS rounds_played,
  ROUND(
    COUNT(DISTINCT r.id) FILTER (WHERE r.winning_team_id = ar.team_id)::NUMERIC /
    NULLIF(COUNT(DISTINCT r.id), 0) * 100,
    2
  ) AS win_rate,
  -- ACS using proper formula
  ROUND(
    aa.total_combat_score::NUMERIC / NULLIF(aa.round_count, 0),
    2
  ) AS avg_acs
FROM agent_rounds ar
JOIN public.rounds r ON ar.round_id = r.id
LEFT JOIN agent_acs aa ON ar.player_id = aa.player_id AND ar.agent = aa.agent AND ar.series_id = aa.series_id
GROUP BY ar.player_id, ar.player_name, ar.agent, ar.series_id, aa.total_combat_score, aa.round_count;

CREATE UNIQUE INDEX IF NOT EXISTS mv_player_agent_pool_idx ON mosaic.mv_player_agent_pool (player_id, agent, series_id);

-- Grant permissions
GRANT SELECT ON mosaic.mv_round_acs TO authenticated, anon;
GRANT SELECT ON mosaic.mv_player_core_stats TO authenticated, anon;
GRANT SELECT ON mosaic.mv_player_agent_pool TO authenticated, anon;
