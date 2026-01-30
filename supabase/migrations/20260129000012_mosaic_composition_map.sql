-- Migration 004: Composition and Map Analytics Database Functions
-- Created: 2026-01-29
-- Purpose: PostgreSQL functions for team composition and map performance analytics

-- Set search path for functions
SET search_path TO mosaic, public;

-- =============================================================================
-- COMPOSITION ANALYTICS FUNCTIONS (COMP-01 to COMP-06)
-- =============================================================================

-- Function 1: Get Team Compositions
-- Returns composition frequencies, win rates, and maps played for a team
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
      -- Get starting composition (round 0) sorted alphabetically
      jsonb_agg(DISTINCT prs.agent ORDER BY prs.agent) AS composition
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      g.series_id = ANY(p_series_ids)
      AND prs.team_id = p_team_id
      AND r.round_number = 0  -- Starting composition
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

GRANT EXECUTE ON FUNCTION mosaic.get_team_compositions(TEXT, TEXT[]) TO authenticated, anon;

-- Function 2: Get Composition Win Rates By Map
-- Returns per-map performance for each composition
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
      g.series_id = ANY(p_series_ids)
      AND prs.team_id = p_team_id
      AND r.round_number = 0
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

GRANT EXECUTE ON FUNCTION mosaic.get_composition_win_rates_by_map(TEXT, TEXT[]) TO authenticated, anon;

-- Function 3: Get Meta Adaptation Timeline
-- Tracks composition changes over time and consecutive usage
CREATE OR REPLACE FUNCTION mosaic.get_meta_adaptation_timeline(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  series_date TEXT,
  series_id TEXT,
  composition JSONB,
  is_new_comp BOOLEAN,
  consecutive_uses BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH series_compositions AS (
    SELECT
      s.id AS series_id,
      s.start_time::TEXT AS series_date,
      jsonb_agg(DISTINCT prs.agent ORDER BY prs.agent) AS composition
    FROM public.series s
    JOIN public.games g ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      s.id = ANY(p_series_ids)
      AND prs.team_id = p_team_id
      AND r.round_number = 0
    GROUP BY s.id, s.start_time
    ORDER BY s.start_time
  )
  SELECT
    series_date,
    series_id,
    composition,
    -- Detect composition change from previous series
    (composition IS DISTINCT FROM LAG(composition) OVER (ORDER BY series_date)) AS is_new_comp,
    -- Count consecutive uses of this composition
    COUNT(*) OVER (
      PARTITION BY composition
      ORDER BY series_date
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS consecutive_uses
  FROM series_compositions
  ORDER BY series_date;
$$;

GRANT EXECUTE ON FUNCTION mosaic.get_meta_adaptation_timeline(TEXT, TEXT[]) TO authenticated, anon;

-- Function 4: Get Role Distribution
-- Counts agents by role (duelist, controller, initiator, sentinel) per game
CREATE OR REPLACE FUNCTION mosaic.get_role_distribution(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  game_id TEXT,
  map_name TEXT,
  duelist_count BIGINT,
  controller_count BIGINT,
  initiator_count BIGINT,
  sentinel_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH game_agents AS (
    SELECT
      g.id AS game_id,
      g.map_name,
      prs.agent,
      -- Classify agents by role
      CASE
        WHEN prs.agent IN ('Jett', 'Reyna', 'Phoenix', 'Raze', 'Yoru', 'Neon', 'Iso') THEN 'duelist'
        WHEN prs.agent IN ('Brimstone', 'Viper', 'Omen', 'Astra', 'Harbor', 'Clove') THEN 'controller'
        WHEN prs.agent IN ('Sova', 'Breach', 'Skye', 'KAY/O', 'Fade', 'Gekko') THEN 'initiator'
        WHEN prs.agent IN ('Sage', 'Cypher', 'Killjoy', 'Chamber', 'Deadlock', 'Vyse') THEN 'sentinel'
        ELSE 'unknown'
      END AS role
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      g.series_id = ANY(p_series_ids)
      AND prs.team_id = p_team_id
      AND r.round_number = 0
    GROUP BY g.id, g.map_name, prs.agent
  )
  SELECT
    game_id,
    map_name,
    COUNT(*) FILTER (WHERE role = 'duelist')::BIGINT AS duelist_count,
    COUNT(*) FILTER (WHERE role = 'controller')::BIGINT AS controller_count,
    COUNT(*) FILTER (WHERE role = 'initiator')::BIGINT AS initiator_count,
    COUNT(*) FILTER (WHERE role = 'sentinel')::BIGINT AS sentinel_count
  FROM game_agents
  GROUP BY game_id, map_name
  ORDER BY game_id;
$$;

GRANT EXECUTE ON FUNCTION mosaic.get_role_distribution(TEXT, TEXT[]) TO authenticated, anon;

-- =============================================================================
-- MAP ANALYTICS FUNCTIONS (MAP-01 to MAP-04)
-- =============================================================================

-- Function 5: Get Map Win Rates
-- Returns per-map win/loss records and round statistics
CREATE OR REPLACE FUNCTION mosaic.get_map_win_rates(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  map_name TEXT,
  games_played BIGINT,
  wins BIGINT,
  losses BIGINT,
  win_rate NUMERIC,
  avg_rounds_won NUMERIC,
  avg_rounds_lost NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH team_games AS (
    SELECT
      g.map_name,
      g.winner_id,
      -- Determine which team is team_a or team_b
      CASE
        WHEN s.team_a_id = p_team_id THEN g.team_a_score
        WHEN s.team_b_id = p_team_id THEN g.team_b_score
        ELSE NULL
      END AS team_rounds_won,
      CASE
        WHEN s.team_a_id = p_team_id THEN g.team_b_score
        WHEN s.team_b_id = p_team_id THEN g.team_a_score
        ELSE NULL
      END AS team_rounds_lost
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    WHERE
      g.series_id = ANY(p_series_ids)
      AND (s.team_a_id = p_team_id OR s.team_b_id = p_team_id)
  )
  SELECT
    map_name,
    COUNT(*)::BIGINT AS games_played,
    COUNT(*) FILTER (WHERE winner_id = p_team_id)::BIGINT AS wins,
    COUNT(*) FILTER (WHERE winner_id != p_team_id)::BIGINT AS losses,
    ROUND(
      COUNT(*) FILTER (WHERE winner_id = p_team_id)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate,
    ROUND(AVG(team_rounds_won), 2) AS avg_rounds_won,
    ROUND(AVG(team_rounds_lost), 2) AS avg_rounds_lost
  FROM team_games
  GROUP BY map_name
  ORDER BY win_rate DESC NULLS LAST, games_played DESC;
$$;

GRANT EXECUTE ON FUNCTION mosaic.get_map_win_rates(TEXT, TEXT[]) TO authenticated, anon;

-- Function 6: Get Map Composition Preferences
-- Returns compositions used on a specific map with win rates
CREATE OR REPLACE FUNCTION mosaic.get_map_composition_preferences(
  p_team_id TEXT,
  p_series_ids TEXT[],
  p_map_name TEXT
)
RETURNS TABLE(
  composition JSONB,
  times_used BIGINT,
  win_rate NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH map_game_compositions AS (
    SELECT
      g.id AS game_id,
      g.winner_id,
      jsonb_agg(DISTINCT prs.agent ORDER BY prs.agent) AS composition
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      g.series_id = ANY(p_series_ids)
      AND g.map_name = p_map_name
      AND prs.team_id = p_team_id
      AND r.round_number = 0
    GROUP BY g.id, g.winner_id
  )
  SELECT
    composition,
    COUNT(*)::BIGINT AS times_used,
    ROUND(
      COUNT(*) FILTER (WHERE winner_id = p_team_id)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate
  FROM map_game_compositions
  GROUP BY composition
  ORDER BY times_used DESC;
$$;

GRANT EXECUTE ON FUNCTION mosaic.get_map_composition_preferences(TEXT, TEXT[], TEXT) TO authenticated, anon;

-- Function 7: Get Map Site Patterns
-- Returns attack site preferences and success rates per map
CREATE OR REPLACE FUNCTION mosaic.get_map_site_patterns(
  p_team_id TEXT,
  p_series_ids TEXT[],
  p_map_name TEXT
)
RETURNS TABLE(
  site TEXT,
  attack_count BIGINT,
  attack_pct NUMERIC,
  success_rate NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH attacking_rounds AS (
    SELECT
      r.id AS round_id,
      r.winning_team_id,
      -- Determine if team was attacking (rounds 0-11 for team_a, 12-24 for team_b)
      CASE
        WHEN r.round_number < 12 AND s.team_a_id = p_team_id THEN TRUE
        WHEN r.round_number >= 12 AND s.team_b_id = p_team_id THEN TRUE
        ELSE FALSE
      END AS is_attacking,
      CASE
        WHEN r.round_number < 12 THEN s.team_a_id
        ELSE s.team_b_id
      END AS attacking_team_id
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE
      g.series_id = ANY(p_series_ids)
      AND g.map_name = p_map_name
  ),
  site_plants AS (
    SELECT
      ar.round_id,
      ar.winning_team_id,
      ar.attacking_team_id,
      se.site
    FROM attacking_rounds ar
    JOIN public.spike_events se ON se.round_id = ar.round_id
    WHERE
      ar.is_attacking = TRUE
      AND se.event_type = 'plant'
  )
  SELECT
    COALESCE(site, 'Unknown') AS site,
    COUNT(*)::BIGINT AS attack_count,
    ROUND(
      COUNT(*)::NUMERIC / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100,
      2
    ) AS attack_pct,
    ROUND(
      COUNT(*) FILTER (WHERE winning_team_id = attacking_team_id)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS success_rate
  FROM site_plants
  GROUP BY site
  ORDER BY attack_count DESC;
$$;

GRANT EXECUTE ON FUNCTION mosaic.get_map_site_patterns(TEXT, TEXT[], TEXT) TO authenticated, anon;

-- Function 8: Get Map Pool Analysis
-- Classifies maps into strengths (>60%), weaknesses (<40%), and neutral
CREATE OR REPLACE FUNCTION mosaic.get_map_pool_analysis(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH map_stats AS (
    SELECT
      g.map_name,
      ROUND(
        COUNT(*) FILTER (WHERE g.winner_id = p_team_id)::NUMERIC /
        NULLIF(COUNT(*), 0) * 100,
        2
      ) AS win_rate
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    WHERE
      g.series_id = ANY(p_series_ids)
      AND (s.team_a_id = p_team_id OR s.team_b_id = p_team_id)
    GROUP BY g.map_name
  )
  SELECT jsonb_build_object(
    'strengths', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('map', map_name, 'win_rate', win_rate) ORDER BY win_rate DESC), '[]'::jsonb)
      FROM map_stats
      WHERE win_rate > 60
    ),
    'weaknesses', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('map', map_name, 'win_rate', win_rate) ORDER BY win_rate ASC), '[]'::jsonb)
      FROM map_stats
      WHERE win_rate < 40
    ),
    'neutral', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('map', map_name, 'win_rate', win_rate) ORDER BY map_name), '[]'::jsonb)
      FROM map_stats
      WHERE win_rate >= 40 AND win_rate <= 60
    )
  );
$$;

GRANT EXECUTE ON FUNCTION mosaic.get_map_pool_analysis(TEXT, TEXT[]) TO authenticated, anon;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- Eight database functions created for composition and map analytics
-- All functions are STABLE (cacheable) and use efficient JSONB aggregation
-- All functions are prefixed with mosaic. and reference public. tables
