-- Fix public wrapper functions for first blood and clutch stats
-- to match mosaic function signatures

-- =============================================================================
-- Fix get_player_first_blood_stats wrapper
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_player_first_blood_stats(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_player_first_blood_stats(
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
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_player_first_blood_stats(p_player_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_player_first_blood_stats(TEXT, TEXT[]) TO authenticated, anon;

-- =============================================================================
-- Fix get_player_clutch_stats wrapper
-- =============================================================================
DROP FUNCTION IF EXISTS public.get_player_clutch_stats(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_player_clutch_stats(
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
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_player_clutch_stats(p_player_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.get_player_clutch_stats(TEXT, TEXT[]) TO authenticated, anon;
