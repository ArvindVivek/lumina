-- Fix public wrapper functions for player analytics to match mosaic function signatures

-- =============================================================================
-- Fix get_player_core_stats wrapper
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_player_core_stats(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_player_core_stats(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  player_id TEXT,
  player_name TEXT,
  rounds_played BIGINT,
  acs NUMERIC,
  kd_ratio NUMERIC,
  adr NUMERIC,
  headshot_pct NUMERIC,
  kast_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_player_core_stats(p_player_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_player_core_stats(TEXT, TEXT[]) TO authenticated, anon;

-- =============================================================================
-- Fix get_player_agent_pool wrapper
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_player_agent_pool(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_player_agent_pool(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  agent TEXT,
  games_played BIGINT,
  rounds_played BIGINT,
  pick_rate NUMERIC,
  win_rate NUMERIC,
  avg_acs NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_player_agent_pool(p_player_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_player_agent_pool(TEXT, TEXT[]) TO authenticated, anon;

-- =============================================================================
-- Fix get_player_performance_trend wrapper
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_player_performance_trend(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_player_performance_trend(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  series_id TEXT,
  series_date TIMESTAMP WITH TIME ZONE,
  acs NUMERIC,
  acs_moving_avg NUMERIC,
  performance_trend TEXT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_player_performance_trend(p_player_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_player_performance_trend(TEXT, TEXT[]) TO authenticated, anon;
