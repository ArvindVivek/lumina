-- Mosaic analytics: Team strategy database functions
-- Migration: 002_team_strategy_functions.sql
-- Created: 2026-01-29
-- Refactored: 2026-01-29 (use mosaic schema, reference public schema lumina data)

-- Create mosaic schema for analytics isolation
CREATE SCHEMA IF NOT EXISTS mosaic;

-- Set search path to mosaic schema with public (lumina data) as fallback
SET search_path TO mosaic, public;

-- Function: Get team attack pistol patterns
-- Analyzes first-round spike plant timing to classify pistol strategies
CREATE OR REPLACE FUNCTION mosaic.get_team_attack_pistol_patterns(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  pattern_type TEXT,
  occurrences BIGINT,
  win_rate NUMERIC,
  avg_plant_time NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH pistol_rounds AS (
    SELECT
      r.id AS round_id,
      r.winning_team_id,
      prs.team_id,
      MIN(se.timestamp_seconds) AS plant_time
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    JOIN public.player_round_stats prs ON r.id = prs.round_id
    LEFT JOIN public.spike_events se ON r.id = se.round_id AND se.event_type = 'plant'
    WHERE r.round_number = 0  -- First round (pistol)
      AND prs.team_id = p_team_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY r.id, r.winning_team_id, prs.team_id
  )
  SELECT
    CASE
      WHEN plant_time IS NULL THEN 'no_plant'
      WHEN plant_time < 60 THEN 'fast_execute'
      ELSE 'default'
    END AS pattern_type,
    COUNT(*)::BIGINT AS occurrences,
    ROUND(
      COUNT(*) FILTER (WHERE winning_team_id = team_id)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate,
    ROUND(AVG(plant_time), 2) AS avg_plant_time
  FROM pistol_rounds
  GROUP BY pattern_type
  ORDER BY occurrences DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get team economy patterns
-- Analyzes buy decisions based on loadout value thresholds
CREATE OR REPLACE FUNCTION mosaic.get_team_economy_patterns(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  economy_type TEXT,
  occurrences BIGINT,
  win_rate NUMERIC,
  avg_loadout_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH team_rounds AS (
    SELECT
      r.id AS round_id,
      r.winning_team_id,
      prs.team_id,
      AVG(prs.loadout_value) AS avg_loadout
    FROM public.rounds r
    JOIN public.games g ON r.id = r.game_id
    JOIN public.player_round_stats prs ON r.id = prs.round_id
    WHERE prs.team_id = p_team_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY r.id, r.winning_team_id, prs.team_id
  )
  SELECT
    CASE
      WHEN avg_loadout < 5000 THEN 'eco'
      WHEN avg_loadout < 15000 THEN 'half_buy'
      WHEN avg_loadout < 20000 THEN 'force_buy'
      ELSE 'full_buy'
    END AS economy_type,
    COUNT(*)::BIGINT AS occurrences,
    ROUND(
      COUNT(*) FILTER (WHERE winning_team_id = team_id)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate,
    ROUND(AVG(avg_loadout), 2) AS avg_loadout_value
  FROM team_rounds
  GROUP BY economy_type
  ORDER BY occurrences DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get team site preferences
-- Analyzes spike plant locations to determine site attack preferences
CREATE OR REPLACE FUNCTION mosaic.get_team_site_preferences(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  map_name TEXT,
  site TEXT,
  attacks BIGINT,
  win_rate NUMERIC,
  preference_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH site_plants AS (
    SELECT
      g.map_name,
      se.site,
      r.winning_team_id,
      prs.team_id
    FROM public.spike_events se
    JOIN public.rounds r ON se.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.player_round_stats prs ON r.id = prs.round_id
    WHERE se.event_type = 'plant'
      AND prs.team_id = p_team_id
      AND g.series_id = ANY(p_series_ids)
  ),
  map_totals AS (
    SELECT
      map_name,
      COUNT(*) AS total_plants
    FROM site_plants
    GROUP BY map_name
  )
  SELECT
    sp.map_name,
    sp.site,
    COUNT(*)::BIGINT AS attacks,
    ROUND(
      COUNT(*) FILTER (WHERE sp.winning_team_id = sp.team_id)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate,
    ROUND(
      COUNT(*)::NUMERIC / NULLIF(mt.total_plants, 0) * 100,
      2
    ) AS preference_pct
  FROM site_plants sp
  JOIN map_totals mt ON sp.map_name = mt.map_name
  GROUP BY sp.map_name, sp.site, mt.total_plants
  ORDER BY sp.map_name, attacks DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Get team strategies summary (combined JSONB)
-- Returns all strategy analytics as single JSONB for efficient querying
CREATE OR REPLACE FUNCTION mosaic.get_team_strategies_summary(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'pistol_patterns', (
      SELECT jsonb_agg(row_to_json(pp))
      FROM mosaic.get_team_attack_pistol_patterns(p_team_id, p_series_ids) pp
    ),
    'economy_patterns', (
      SELECT jsonb_agg(row_to_json(ep))
      FROM mosaic.get_team_economy_patterns(p_team_id, p_series_ids) ep
    ),
    'site_preferences', (
      SELECT jsonb_agg(row_to_json(sp))
      FROM mosaic.get_team_site_preferences(p_team_id, p_series_ids) sp
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION mosaic.get_team_attack_pistol_patterns TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_team_economy_patterns TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_team_site_preferences TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_team_strategies_summary TO authenticated, anon;
