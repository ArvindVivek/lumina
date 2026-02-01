-- Performance indexes for Synapse queries
-- Migration: 20260128000002_indexes.sql
-- Created: 2026-01-28

-- Ensure we're operating in the synapse schema
SET search_path TO synapse, public;

-- Index for role-filtered queries (most common query pattern)
-- Used for: "What's Jinx's win rate as ADC on patch 14.23?"
CREATE INDEX idx_picks_champion_role ON champion_picks(champion_name, role);

-- Index for player champion pool queries
-- Used for: "What champions does Faker play?"
CREATE INDEX idx_picks_player_champion ON champion_picks(player_id, champion_name);

-- Index for patch filtering on series
-- Used for: "Get all series from patch 14.23"
CREATE INDEX idx_series_patch ON series(patch_version);

-- Index for champion stats queries (primary lookup)
-- Used for: "Get stats for all ADCs on patch 14.23"
CREATE INDEX idx_stats_champion_patch_role ON champion_stats(champion_name, patch_version, role);

-- Index for ETL checkpoint queries
-- Used for: "Get all pending tournament fetch jobs"
CREATE INDEX idx_checkpoints_status ON etl_checkpoints(job_type, status);

-- Composite index for draft analysis queries
-- Used for: "Get all picks for a specific champion and role combination"
CREATE INDEX idx_picks_champion_role_team ON champion_picks(champion_name, role, team_side);

-- Index for time-based queries (recent games)
-- Used for: "Get games from the last 30 days"
CREATE INDEX idx_games_created_at ON games(created_at DESC);

-- Index for win rate calculations
-- Used for: "Calculate win rates by team"
CREATE INDEX idx_games_series_won ON games(series_id, blue_team_won);

-- Partial index for recent patches only (smaller, faster)
-- Used for: "Only query data from the last 3 patches"
-- Note: This will need to be recreated periodically as patches advance
CREATE INDEX idx_series_recent_patches ON series(patch_version, created_at DESC)
WHERE patch_version IS NOT NULL;

-- Index for team composition queries
-- Used for: "Get all drafts where a team played"
CREATE INDEX idx_series_teams ON series(blue_team_id, red_team_id);
