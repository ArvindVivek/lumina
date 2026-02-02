-- Fix all public wrapper functions to match mosaic function signatures
-- Issue: Multiple wrappers have incorrect return types causing "structure of query does not match function result type" errors

-- =============================================================================
-- COMPOSITION ANALYTICS WRAPPERS
-- =============================================================================

-- Fix get_composition_win_rates_by_map
-- Was: composition, map_name, rounds_played, win_rate
-- Should be: composition, map_name, games, wins, win_rate
DROP FUNCTION IF EXISTS public.get_composition_win_rates_by_map(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_composition_win_rates_by_map(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  composition JSONB,
  map_name TEXT,
  games BIGINT,
  wins BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_composition_win_rates_by_map(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_composition_win_rates_by_map(TEXT, TEXT[]) TO authenticated, anon;

-- Fix get_meta_adaptation_timeline
-- Was: match_date DATE, composition, consecutive_uses, win_rate
-- Should be: series_date TEXT, series_id TEXT, composition, is_new_comp BOOLEAN, consecutive_uses BIGINT
DROP FUNCTION IF EXISTS public.get_meta_adaptation_timeline(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_meta_adaptation_timeline(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  series_date TEXT,
  series_id TEXT,
  composition JSONB,
  is_new_comp BOOLEAN,
  consecutive_uses BIGINT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_meta_adaptation_timeline(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_meta_adaptation_timeline(TEXT, TEXT[]) TO authenticated, anon;

-- Fix get_role_distribution
-- Was: role, agent_name, rounds_played, usage_rate
-- Should be: game_id, map_name, duelist_count, controller_count, initiator_count, sentinel_count
DROP FUNCTION IF EXISTS public.get_role_distribution(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_role_distribution(
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
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_role_distribution(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_role_distribution(TEXT, TEXT[]) TO authenticated, anon;

-- =============================================================================
-- MAP ANALYTICS WRAPPERS
-- =============================================================================

-- Fix get_map_win_rates
-- Was: map_name, matches_played, wins, losses, win_rate, attack_win_rate, defense_win_rate
-- Should be: map_name, games_played, wins, losses, win_rate, avg_rounds_won, avg_rounds_lost
DROP FUNCTION IF EXISTS public.get_map_win_rates(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_map_win_rates(
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
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_map_win_rates(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_map_win_rates(TEXT, TEXT[]) TO authenticated, anon;

-- Fix get_map_composition_preferences
-- Was: composition, rounds_played, win_rate
-- Should be: composition, times_used, win_rate
DROP FUNCTION IF EXISTS public.get_map_composition_preferences(TEXT, TEXT[], TEXT);

CREATE OR REPLACE FUNCTION public.get_map_composition_preferences(
  p_team_id TEXT,
  p_series_ids TEXT[],
  p_map_name TEXT
)
RETURNS TABLE(
  composition JSONB,
  times_used BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_map_composition_preferences(p_team_id, p_series_ids, p_map_name);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_map_composition_preferences(TEXT, TEXT[], TEXT) TO authenticated, anon;

-- Fix get_map_site_patterns
-- Was: site, attacks, preference_pct, win_rate
-- Should be: site, attack_count, attack_pct, success_rate
DROP FUNCTION IF EXISTS public.get_map_site_patterns(TEXT, TEXT[], TEXT);

CREATE OR REPLACE FUNCTION public.get_map_site_patterns(
  p_team_id TEXT,
  p_series_ids TEXT[],
  p_map_name TEXT
)
RETURNS TABLE(
  site TEXT,
  attack_count BIGINT,
  attack_pct NUMERIC,
  success_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_map_site_patterns(p_team_id, p_series_ids, p_map_name);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_map_site_patterns(TEXT, TEXT[], TEXT) TO authenticated, anon;

-- Fix get_map_pool_analysis
-- Was: TABLE with map_name, classification, win_rate, matches_played
-- Should be: JSONB
DROP FUNCTION IF EXISTS public.get_map_pool_analysis(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_map_pool_analysis(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS JSONB AS $$
BEGIN
  RETURN mosaic.get_map_pool_analysis(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_map_pool_analysis(TEXT, TEXT[]) TO authenticated, anon;
