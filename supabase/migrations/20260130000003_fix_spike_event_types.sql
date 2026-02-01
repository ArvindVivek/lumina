-- Fix spike event type mismatch in get_team_site_preferences
-- Issue: Lumina stores 'plant_complete', Mosaic function queries 'plant'

SET search_path TO mosaic, public;

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
    WHERE se.event_type = 'plant_complete'  -- FIX: Change from 'plant' to 'plant_complete'
      AND prs.team_id = p_team_id
      AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))
  ),
  map_totals AS (
    SELECT
      sp.map_name,
      COUNT(*) AS total_plants
    FROM site_plants sp
    GROUP BY sp.map_name
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

GRANT EXECUTE ON FUNCTION mosaic.get_team_site_preferences TO authenticated, anon;
