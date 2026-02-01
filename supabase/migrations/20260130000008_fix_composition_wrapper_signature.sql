-- Fix public.get_team_compositions wrapper to match mosaic function signature
-- Issue: Wrapper has incorrect return type (matches_played, rounds_played, most_played_map)
-- Fix: Update to match actual mosaic function (games_played, win_count, maps_played)

DROP FUNCTION IF EXISTS public.get_team_compositions(TEXT, TEXT[]);

CREATE OR REPLACE FUNCTION public.get_team_compositions(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  composition JSONB,
  games_played BIGINT,
  win_count BIGINT,
  win_rate NUMERIC,
  maps_played TEXT[]
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_team_compositions(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;
