-- Migration: Materialized views for pre-computed analytics
-- Purpose: Pre-compute expensive aggregations for instant query response
-- Performance target: <10 second aggregation queries for 20-match datasets

-- Set search path for views
SET search_path TO mosaic, public;

-- 1. mv_player_core_stats - Pre-computed player statistics
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
  ROUND(pr.total_damage::NUMERIC / NULLIF(pr.rounds_played, 0), 2) AS acs,
  ROUND(pr.total_kills::NUMERIC / NULLIF(pr.total_deaths, 0), 2) AS kd_ratio,
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

-- 2. mv_player_agent_pool - Player agent usage and performance
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
  ROUND(SUM(prs.damage_dealt)::NUMERIC / NULLIF(COUNT(DISTINCT prs.round_id), 0), 2) AS avg_acs
FROM public.player_round_stats prs
JOIN public.players p ON prs.player_id = p.id
JOIN public.rounds r ON prs.round_id = r.id
JOIN public.games g ON r.game_id = g.id
GROUP BY prs.player_id, p.name, prs.agent, g.series_id;

-- 3. mv_team_map_stats - Team performance by map
CREATE MATERIALIZED VIEW mosaic.mv_team_map_stats AS
WITH team_games AS (
  SELECT
    CASE WHEN s.team_a_id = t.id THEN t.id ELSE t.id END AS team_id,
    t.name AS team_name,
    g.id AS game_id,
    g.map_name,
    s.id AS series_id,
    g.winner_id = t.id AS won,
    CASE
      WHEN s.team_a_id = t.id THEN g.team_a_score
      ELSE g.team_b_score
    END AS rounds_won,
    CASE
      WHEN s.team_a_id = t.id THEN g.team_b_score
      ELSE g.team_a_score
    END AS rounds_lost
  FROM public.games g
  JOIN public.series s ON g.series_id = s.id
  JOIN public.teams t ON t.id = s.team_a_id OR t.id = s.team_b_id
)
SELECT
  team_id,
  team_name,
  map_name,
  series_id,
  COUNT(*) AS games_played,
  COUNT(*) FILTER (WHERE won) AS wins,
  COUNT(*) FILTER (WHERE NOT won) AS losses,
  ROUND(COUNT(*) FILTER (WHERE won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS win_rate,
  ROUND(AVG(rounds_won), 2) AS avg_rounds_won,
  ROUND(AVG(rounds_lost), 2) AS avg_rounds_lost
FROM team_games
GROUP BY team_id, team_name, map_name, series_id;

-- 4. mv_team_compositions - Team composition frequencies
CREATE MATERIALIZED VIEW mosaic.mv_team_compositions AS
WITH game_comps AS (
  SELECT
    prs.team_id,
    g.id AS game_id,
    g.map_name,
    g.series_id,
    g.winner_id = prs.team_id AS won,
    jsonb_agg(DISTINCT prs.agent ORDER BY prs.agent) AS composition
  FROM public.player_round_stats prs
  JOIN public.rounds r ON prs.round_id = r.id
  JOIN public.games g ON r.game_id = g.id
  WHERE r.round_number = 0  -- Starting composition
  GROUP BY prs.team_id, g.id, g.map_name, g.series_id, g.winner_id
)
SELECT
  team_id,
  series_id,
  composition,
  COUNT(*) AS games_played,
  COUNT(*) FILTER (WHERE won) AS wins,
  ROUND(COUNT(*) FILTER (WHERE won)::NUMERIC / NULLIF(COUNT(*), 0) * 100, 2) AS win_rate,
  ARRAY_AGG(DISTINCT map_name) AS maps_used
FROM game_comps
GROUP BY team_id, series_id, composition;

-- 5. refresh_analytics_views() - Function to refresh all views
CREATE OR REPLACE FUNCTION mosaic.refresh_analytics_views()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  duration_ms BIGINT;
BEGIN
  start_time := clock_timestamp();

  -- Refresh all materialized views concurrently
  REFRESH MATERIALIZED VIEW CONCURRENTLY mosaic.mv_player_core_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mosaic.mv_player_agent_pool;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mosaic.mv_team_map_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mosaic.mv_team_compositions;

  end_time := clock_timestamp();
  duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;

  RETURN jsonb_build_object(
    'refreshed_at', NOW(),
    'duration_ms', duration_ms,
    'views_refreshed', ARRAY[
      'mosaic.mv_player_core_stats',
      'mosaic.mv_player_agent_pool',
      'mosaic.mv_team_map_stats',
      'mosaic.mv_team_compositions'
    ]
  );
END;
$$;

GRANT EXECUTE ON FUNCTION mosaic.refresh_analytics_views() TO authenticated, anon;
