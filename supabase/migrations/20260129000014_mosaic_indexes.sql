-- Migration: Performance indexes on materialized views
-- Purpose: Enable CONCURRENTLY refresh and optimize query performance
-- Pattern: UNIQUE indexes required for REFRESH MATERIALIZED VIEW CONCURRENTLY

-- Set search path
SET search_path TO mosaic, public;

-- Indexes for mv_player_core_stats
-- UNIQUE index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX mosaic_mv_player_core_stats_unique
  ON mosaic.mv_player_core_stats(player_id, series_id);
CREATE INDEX mosaic_mv_player_core_stats_player
  ON mosaic.mv_player_core_stats(player_id);
CREATE INDEX mosaic_mv_player_core_stats_team
  ON mosaic.mv_player_core_stats(team_id);
CREATE INDEX mosaic_mv_player_core_stats_series
  ON mosaic.mv_player_core_stats(series_id);
CREATE INDEX mosaic_mv_player_core_stats_acs
  ON mosaic.mv_player_core_stats(acs DESC);

-- Indexes for mv_player_agent_pool
CREATE UNIQUE INDEX mosaic_mv_player_agent_pool_unique
  ON mosaic.mv_player_agent_pool(player_id, agent, series_id);
CREATE INDEX mosaic_mv_player_agent_pool_player
  ON mosaic.mv_player_agent_pool(player_id);
CREATE INDEX mosaic_mv_player_agent_pool_agent
  ON mosaic.mv_player_agent_pool(agent);
CREATE INDEX mosaic_mv_player_agent_pool_series
  ON mosaic.mv_player_agent_pool(series_id);

-- Indexes for mv_team_map_stats
CREATE UNIQUE INDEX mosaic_mv_team_map_stats_unique
  ON mosaic.mv_team_map_stats(team_id, map_name, series_id);
CREATE INDEX mosaic_mv_team_map_stats_team
  ON mosaic.mv_team_map_stats(team_id);
CREATE INDEX mosaic_mv_team_map_stats_map
  ON mosaic.mv_team_map_stats(map_name);
CREATE INDEX mosaic_mv_team_map_stats_series
  ON mosaic.mv_team_map_stats(series_id);
CREATE INDEX mosaic_mv_team_map_stats_win_rate
  ON mosaic.mv_team_map_stats(win_rate DESC);

-- Indexes for mv_team_compositions
CREATE UNIQUE INDEX mosaic_mv_team_compositions_unique
  ON mosaic.mv_team_compositions(team_id, series_id, composition);
CREATE INDEX mosaic_mv_team_compositions_team
  ON mosaic.mv_team_compositions(team_id);
CREATE INDEX mosaic_mv_team_compositions_series
  ON mosaic.mv_team_compositions(series_id);

-- Composite indexes for common query patterns
-- Team + series filter (most common)
CREATE INDEX mosaic_mv_player_core_stats_team_series
  ON mosaic.mv_player_core_stats(team_id, series_id);
CREATE INDEX mosaic_mv_player_agent_pool_player_series
  ON mosaic.mv_player_agent_pool(player_id, series_id);
