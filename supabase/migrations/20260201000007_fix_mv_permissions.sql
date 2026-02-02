-- Fix permissions for mosaic materialized views
-- The mv_round_acs view needs to be accessible by the functions

-- Grant permissions on all mosaic schema objects
GRANT USAGE ON SCHEMA mosaic TO authenticated, anon, service_role;

-- Grant select on all materialized views
GRANT SELECT ON mosaic.mv_round_acs TO authenticated, anon, service_role;
GRANT SELECT ON mosaic.mv_player_core_stats TO authenticated, anon, service_role;
GRANT SELECT ON mosaic.mv_player_agent_pool TO authenticated, anon, service_role;

-- Grant select on team views if they exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'mosaic' AND matviewname = 'mv_team_map_stats') THEN
    GRANT SELECT ON mosaic.mv_team_map_stats TO authenticated, anon, service_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'mosaic' AND matviewname = 'mv_team_compositions') THEN
    GRANT SELECT ON mosaic.mv_team_compositions TO authenticated, anon, service_role;
  END IF;
END $$;

-- Grant execute on all mosaic functions to all roles
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mosaic TO authenticated, anon, service_role;
