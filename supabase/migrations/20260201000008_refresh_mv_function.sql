-- Function to refresh materialized views via RPC
-- This allows the ETL to trigger view refreshes after data loading

CREATE OR REPLACE FUNCTION public.refresh_materialized_view(view_name TEXT)
RETURNS VOID AS $$
BEGIN
  -- Validate the view name is in allowed list (security)
  IF view_name NOT IN (
    'mosaic.mv_round_acs',
    'mosaic.mv_player_core_stats',
    'mosaic.mv_player_agent_pool',
    'mosaic.mv_team_map_stats',
    'mosaic.mv_team_compositions'
  ) THEN
    RAISE EXCEPTION 'Invalid view name: %', view_name;
  END IF;

  -- Execute refresh
  EXECUTE format('REFRESH MATERIALIZED VIEW %I.%I',
    split_part(view_name, '.', 1),
    split_part(view_name, '.', 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to service role (used by ETL)
GRANT EXECUTE ON FUNCTION public.refresh_materialized_view(TEXT) TO service_role;

-- Also create a convenience function to refresh all mosaic views
CREATE OR REPLACE FUNCTION public.refresh_all_mosaic_views()
RETURNS VOID AS $$
BEGIN
  -- Refresh in dependency order
  REFRESH MATERIALIZED VIEW mosaic.mv_round_acs;
  REFRESH MATERIALIZED VIEW mosaic.mv_player_core_stats;
  REFRESH MATERIALIZED VIEW mosaic.mv_player_agent_pool;

  -- Refresh team views if they exist
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'mosaic' AND matviewname = 'mv_team_map_stats') THEN
    REFRESH MATERIALIZED VIEW mosaic.mv_team_map_stats;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'mosaic' AND matviewname = 'mv_team_compositions') THEN
    REFRESH MATERIALIZED VIEW mosaic.mv_team_compositions;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.refresh_all_mosaic_views() TO service_role;
