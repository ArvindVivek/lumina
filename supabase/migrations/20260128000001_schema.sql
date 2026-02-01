-- Core database schema for Synapse
-- Migration: 20260128000001_schema.sql
-- Created: 2026-01-28

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create synapse schema for project isolation (Option C: shared database)
CREATE SCHEMA IF NOT EXISTS synapse;

-- Set search path to use synapse schema by default
SET search_path TO synapse, public;

-- Teams table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  short_name VARCHAR(50),
  region VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  primary_role VARCHAR(20) NOT NULL CHECK (primary_role IN ('top', 'jungle', 'mid', 'adc', 'support')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tournaments table
CREATE TABLE tournaments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_id VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(300) NOT NULL,
  region VARCHAR(50),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Series table
CREATE TABLE series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_id VARCHAR(100) UNIQUE NOT NULL,
  tournament_id UUID REFERENCES tournaments(id) ON DELETE CASCADE,
  blue_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  red_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  winner_team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  patch_version VARCHAR(20),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grid_id VARCHAR(100) UNIQUE NOT NULL,
  series_id UUID REFERENCES series(id) ON DELETE CASCADE,
  game_number INT NOT NULL,
  blue_team_won BOOLEAN,
  duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drafts table
CREATE TABLE drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID UNIQUE NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  blue_bans TEXT[],
  red_bans TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Champion picks table
CREATE TABLE champion_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  team_side VARCHAR(10) NOT NULL CHECK (team_side IN ('blue', 'red')),
  champion_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('top', 'jungle', 'mid', 'adc', 'support')),
  role_confidence DECIMAL(3, 2) CHECK (role_confidence >= 0 AND role_confidence <= 1),
  pick_order INT NOT NULL CHECK (pick_order >= 1 AND pick_order <= 10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Champions table (reference data)
CREATE TABLE champions (
  name VARCHAR(100) PRIMARY KEY,
  grid_name VARCHAR(100),
  riot_id VARCHAR(50),
  aliases TEXT[],
  primary_roles TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Champion stats table (pre-computed)
CREATE TABLE champion_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  champion_name VARCHAR(100) NOT NULL REFERENCES champions(name) ON DELETE CASCADE,
  patch_version VARCHAR(20) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('top', 'jungle', 'mid', 'adc', 'support')),
  games_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  raw_win_rate DECIMAL(5, 4),
  smoothed_win_rate DECIMAL(5, 4),
  confidence VARCHAR(20) CHECK (confidence IN ('high', 'medium', 'low', 'insufficient')),
  pick_rate DECIMAL(5, 4),
  ban_rate DECIMAL(5, 4),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(champion_name, patch_version, role)
);

-- ETL checkpoints table (for resumable jobs)
CREATE TABLE etl_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(50) NOT NULL,
  entity_id VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  progress JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_type, entity_id)
);

-- Add indexes on foreign keys for performance
CREATE INDEX idx_players_team ON players(team_id);
CREATE INDEX idx_series_tournament ON series(tournament_id);
CREATE INDEX idx_games_series ON games(series_id);
CREATE INDEX idx_picks_draft ON champion_picks(draft_id);
CREATE INDEX idx_picks_player ON champion_picks(player_id);
CREATE INDEX idx_stats_champion ON champion_stats(champion_name);

-- Add updated_at trigger for teams and players
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_champion_stats_updated_at BEFORE UPDATE ON champion_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_etl_checkpoints_updated_at BEFORE UPDATE ON etl_checkpoints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
