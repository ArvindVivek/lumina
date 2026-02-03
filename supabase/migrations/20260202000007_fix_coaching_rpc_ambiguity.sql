-- Fix ambiguous column references in coaching RPC functions
-- Resolves: "column reference 'series_id' is ambiguous" error

-- Drop and recreate query_series_summary with fully qualified column names
DROP FUNCTION IF EXISTS query_series_summary(TEXT, TEXT);

CREATE OR REPLACE FUNCTION query_series_summary(
  p_series_id TEXT,
  p_team_id TEXT
)
RETURNS TABLE (
  series_id TEXT,
  team_a_id TEXT,
  team_b_id TEXT,
  winner_id TEXT,
  team_a_name TEXT,
  team_b_name TEXT,
  team_a_wins BIGINT,
  team_b_wins BIGINT,
  total_maps BIGINT,
  total_rounds BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH series_data AS (
    SELECT
      s.id,
      s.team_a_id,
      s.team_b_id,
      s.winner_id,
      ta.name as team_a_name,
      tb.name as team_b_name,
      (SELECT COUNT(*) FROM public.games g WHERE g.series_id = s.id AND g.winner_id = s.team_a_id) as team_a_wins,
      (SELECT COUNT(*) FROM public.games g WHERE g.series_id = s.id AND g.winner_id = s.team_b_id) as team_b_wins,
      (SELECT COUNT(*) FROM public.games g WHERE g.series_id = s.id) as total_maps
    FROM public.series s
    JOIN public.teams ta ON s.team_a_id = ta.id
    JOIN public.teams tb ON s.team_b_id = tb.id
    WHERE s.id = p_series_id
  ),
  round_count AS (
    SELECT COUNT(*)::BIGINT as count
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    WHERE g.series_id = p_series_id
  )
  SELECT
    sd.id::TEXT,
    sd.team_a_id::TEXT,
    sd.team_b_id::TEXT,
    sd.winner_id::TEXT,
    sd.team_a_name::TEXT,
    sd.team_b_name::TEXT,
    sd.team_a_wins,
    sd.team_b_wins,
    sd.total_maps,
    rc.count as total_rounds
  FROM series_data sd, round_count rc;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant permissions
GRANT EXECUTE ON FUNCTION query_series_summary(TEXT, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION query_series_summary(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION query_series_summary(TEXT, TEXT) TO service_role;
