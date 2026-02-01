-- Fix composition functions round_number filter bug
-- Issue: All 5 composition functions filter to r.round_number = 0 (pistol round only)
-- Fix: Remove unnecessary filter since DISTINCT agent already prevents duplicates
-- Affected functions: get_team_compositions, get_composition_win_rates_by_map,
--                     get_meta_adaptation_timeline, get_role_distribution,
--                     get_map_composition_preferences

SET search_path TO mosaic, public;

-- Drop existing functions first to avoid signature conflicts
DROP FUNCTION IF EXISTS mosaic.get_team_compositions(TEXT, TEXT[]);
DROP FUNCTION IF EXISTS mosaic.get_composition_win_rates_by_map(TEXT, TEXT[]);
DROP FUNCTION IF EXISTS mosaic.get_meta_adaptation_timeline(TEXT, TEXT[]);
DROP FUNCTION IF EXISTS mosaic.get_role_distribution(TEXT, TEXT[]);
DROP FUNCTION IF EXISTS mosaic.get_map_composition_preferences(TEXT, TEXT[]);

-- Fix 1: get_team_compositions
CREATE OR REPLACE FUNCTION mosaic.get_team_compositions(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  composition JSONB,
  games_played BIGINT,
  win_count BIGINT,
  win_rate NUMERIC,
  maps_played TEXT[]
)
LANGUAGE sql
STABLE
AS $$
  WITH game_compositions AS (
    SELECT
      g.id AS game_id,
      g.map_name,
      g.winner_id,
      jsonb_agg(DISTINCT prs.agent ORDER BY prs.agent) AS composition
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))
      AND prs.team_id = p_team_id
      -- FIX: Removed "AND r.round_number = 0"
    GROUP BY g.id, g.map_name, g.winner_id
  )
  SELECT
    composition,
    COUNT(*)::BIGINT AS games_played,
    COUNT(*) FILTER (WHERE winner_id = p_team_id)::BIGINT AS win_count,
    ROUND(
      COUNT(*) FILTER (WHERE winner_id = p_team_id)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate,
    ARRAY_AGG(DISTINCT map_name ORDER BY map_name) AS maps_played
  FROM game_compositions
  GROUP BY composition
  ORDER BY games_played DESC;
$$;

-- Fix 2: get_composition_win_rates_by_map
CREATE OR REPLACE FUNCTION mosaic.get_composition_win_rates_by_map(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  composition JSONB,
  map_name TEXT,
  games BIGINT,
  wins BIGINT,
  win_rate NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH game_compositions AS (
    SELECT
      g.id AS game_id,
      g.map_name,
      g.winner_id,
      jsonb_agg(DISTINCT prs.agent ORDER BY prs.agent) AS composition
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))
      AND prs.team_id = p_team_id
      -- FIX: Removed "AND r.round_number = 0"
    GROUP BY g.id, g.map_name, g.winner_id
  )
  SELECT
    composition,
    map_name,
    COUNT(*)::BIGINT AS games,
    COUNT(*) FILTER (WHERE winner_id = p_team_id)::BIGINT AS wins,
    ROUND(
      COUNT(*) FILTER (WHERE winner_id = p_team_id)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate
  FROM game_compositions
  GROUP BY composition, map_name
  ORDER BY map_name, games DESC;
$$;

-- Fix 3: get_meta_adaptation_timeline
CREATE OR REPLACE FUNCTION mosaic.get_meta_adaptation_timeline(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  series_id TEXT,
  series_date TEXT,
  game_id TEXT,
  map_name TEXT,
  composition JSONB,
  is_new_comp BOOLEAN,
  consecutive_uses BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH game_comps AS (
    SELECT
      s.id AS series_id,
      s.start_time AS series_date,
      g.id AS game_id,
      g.map_name,
      jsonb_agg(DISTINCT prs.agent ORDER BY prs.agent) AS composition
    FROM public.series s
    JOIN public.games g ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR s.id = ANY(p_series_ids))
      AND prs.team_id = p_team_id
      -- FIX: Removed "AND r.round_number = 0"
    GROUP BY s.id, s.start_time, g.id, g.map_name
    ORDER BY s.start_time, g.sequence_number
  ),
  comp_changes AS (
    SELECT
      *,
      composition != LAG(composition) OVER (ORDER BY series_date, game_id) AS is_new_comp
    FROM game_comps
  )
  SELECT
    series_id,
    series_date,
    game_id,
    map_name,
    composition,
    COALESCE(is_new_comp, TRUE) AS is_new_comp,
    COUNT(*) OVER (
      PARTITION BY composition
      ORDER BY series_date, game_id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS consecutive_uses
  FROM comp_changes
  ORDER BY series_date, game_id;
$$;

-- Fix 4: get_role_distribution
CREATE OR REPLACE FUNCTION mosaic.get_role_distribution(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  duelist_count BIGINT,
  controller_count BIGINT,
  initiator_count BIGINT,
  sentinel_count BIGINT,
  games_played BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH agent_roles AS (
    SELECT agent, role FROM (VALUES
      ('Jett', 'duelist'), ('Raze', 'duelist'), ('Phoenix', 'duelist'),
      ('Reyna', 'duelist'), ('Yoru', 'duelist'), ('Neon', 'duelist'), ('Iso', 'duelist'),
      ('Brimstone', 'controller'), ('Omen', 'controller'), ('Viper', 'controller'),
      ('Astra', 'controller'), ('Harbor', 'controller'), ('Clove', 'controller'),
      ('Sova', 'initiator'), ('Breach', 'initiator'), ('Skye', 'initiator'),
      ('KAY/O', 'initiator'), ('Fade', 'initiator'), ('Gekko', 'initiator'),
      ('Sage', 'sentinel'), ('Cypher', 'sentinel'), ('Killjoy', 'sentinel'),
      ('Chamber', 'sentinel'), ('Deadlock', 'sentinel'), ('Vyse', 'sentinel')
    ) AS t(agent, role)
  ),
  game_compositions AS (
    SELECT
      g.id AS game_id,
      prs.agent,
      ar.role
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    LEFT JOIN agent_roles ar ON prs.agent = ar.agent
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))
      AND prs.team_id = p_team_id
      -- FIX: Removed "AND r.round_number = 0"
    GROUP BY g.id, prs.agent, ar.role
  ),
  role_counts AS (
    SELECT
      game_id,
      COUNT(*) FILTER (WHERE role = 'duelist') AS duelist_count,
      COUNT(*) FILTER (WHERE role = 'controller') AS controller_count,
      COUNT(*) FILTER (WHERE role = 'initiator') AS initiator_count,
      COUNT(*) FILTER (WHERE role = 'sentinel') AS sentinel_count
    FROM game_compositions
    GROUP BY game_id
  )
  SELECT
    duelist_count,
    controller_count,
    initiator_count,
    sentinel_count,
    COUNT(*)::BIGINT AS games_played
  FROM role_counts
  GROUP BY duelist_count, controller_count, initiator_count, sentinel_count
  ORDER BY games_played DESC;
$$;

-- Fix 5: get_map_composition_preferences
CREATE OR REPLACE FUNCTION mosaic.get_map_composition_preferences(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  map_name TEXT,
  composition JSONB,
  games_played BIGINT,
  win_count BIGINT,
  win_rate NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH game_compositions AS (
    SELECT
      g.id AS game_id,
      g.map_name,
      g.winner_id,
      jsonb_agg(DISTINCT prs.agent ORDER BY prs.agent) AS composition
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))
      AND prs.team_id = p_team_id
      -- FIX: Removed "AND r.round_number = 0"
    GROUP BY g.id, g.map_name, g.winner_id
  )
  SELECT
    map_name,
    composition,
    COUNT(*)::BIGINT AS games_played,
    COUNT(*) FILTER (WHERE winner_id = p_team_id)::BIGINT AS win_count,
    ROUND(
      COUNT(*) FILTER (WHERE winner_id = p_team_id)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate
  FROM game_compositions
  GROUP BY map_name, composition
  ORDER BY map_name, games_played DESC;
$$;

-- Grant permissions for all fixed functions (with full signatures)
GRANT EXECUTE ON FUNCTION mosaic.get_team_compositions(TEXT, TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_composition_win_rates_by_map(TEXT, TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_meta_adaptation_timeline(TEXT, TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_role_distribution(TEXT, TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_map_composition_preferences(TEXT, TEXT[]) TO authenticated, anon;
