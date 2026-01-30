-- Migration: Ban Analytics Schema
-- Created: 2026-01-30
-- Purpose: Create ban analytics tables for tracking ban patterns and target bans

SET search_path TO synapse, public;

-- Table: ban_analytics
-- Tracks ban statistics by context (global, team, player)
CREATE TABLE ban_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  champion_name VARCHAR(100) NOT NULL,
  patch_version VARCHAR(20) NOT NULL,
  context_type VARCHAR(20) NOT NULL CHECK (context_type IN ('global', 'team', 'player')),
  context_id VARCHAR(100),  -- NULL for global, team_id or player_id otherwise
  times_banned INT NOT NULL DEFAULT 0,
  total_games_in_context INT NOT NULL DEFAULT 0,
  ban_rate DECIMAL(5,4),
  smoothed_ban_rate DECIMAL(5,4),
  confidence VARCHAR(20) CHECK (confidence IN ('high', 'medium', 'low', 'insufficient')),
  rank_in_context INT,  -- 1 = most banned in this context
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(champion_name, patch_version, context_type, context_id)
);

-- Table: target_bans
-- Tracks bans directed at specific players (opponent target bans)
CREATE TABLE target_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  champion_name VARCHAR(100) NOT NULL,
  times_banned_against INT NOT NULL DEFAULT 0,
  total_games_against_player INT NOT NULL DEFAULT 0,
  ban_rate_against DECIMAL(5,4),
  is_comfort_pick BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, champion_name)
);

-- Indexes for ban_analytics
CREATE INDEX idx_ban_analytics_lookup
  ON ban_analytics(champion_name, patch_version, context_type);

CREATE INDEX idx_ban_analytics_rank
  ON ban_analytics(patch_version, context_type, rank_in_context);

CREATE INDEX idx_ban_analytics_context
  ON ban_analytics(context_type, context_id);

-- Indexes for target_bans
CREATE INDEX idx_target_bans_player
  ON target_bans(player_id);

CREATE INDEX idx_target_bans_champion
  ON target_bans(champion_name);

CREATE INDEX idx_target_bans_comfort
  ON target_bans(is_comfort_pick) WHERE is_comfort_pick = true;

-- Updated_at trigger function (reuse if exists)
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER ban_analytics_updated_at
  BEFORE UPDATE ON ban_analytics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER target_bans_updated_at
  BEFORE UPDATE ON target_bans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Comments for documentation
COMMENT ON TABLE ban_analytics IS 'Aggregated ban statistics by context (global, team, player)';
COMMENT ON TABLE target_bans IS 'Bans directed at specific players (opponent target bans)';
COMMENT ON COLUMN ban_analytics.context_type IS 'Context level: global (all games), team (specific team), player (specific player)';
COMMENT ON COLUMN ban_analytics.smoothed_ban_rate IS 'Bayesian smoothed ban rate to handle small samples';
COMMENT ON COLUMN target_bans.is_comfort_pick IS 'Whether this champion is in player''s champion pool (3+ games)';
