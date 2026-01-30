-- Analytics schema for Synapse
-- Migration: 20260129000003_analytics_schema.sql
-- Created: 2026-01-29
-- Purpose: Champion statistics, confidence scoring, side-aware analytics

-- Set search path to synapse schema
SET search_path TO synapse, public;

-- Champion stats computed table (pre-aggregated with Bayesian smoothing)
CREATE TABLE champion_stats_computed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  champion_name VARCHAR(100) NOT NULL,
  patch_version VARCHAR(20) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('top', 'jungle', 'mid', 'adc', 'support')),
  side VARCHAR(10) CHECK (side IN ('blue', 'red') OR side IS NULL),

  -- Raw counts
  games_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  bans INT NOT NULL DEFAULT 0,
  total_games_in_context INT NOT NULL DEFAULT 0,  -- Total games for pick/ban rate calculation

  -- Computed rates
  raw_win_rate DECIMAL(5,4),
  smoothed_win_rate DECIMAL(5,4),  -- Bayesian smoothed with prior
  pick_rate DECIMAL(5,4),
  ban_rate DECIMAL(5,4),

  -- Confidence scoring
  confidence VARCHAR(20) CHECK (confidence IN ('high', 'medium', 'low', 'insufficient')),
  ci_lower DECIMAL(5,4),  -- Wilson confidence interval lower bound
  ci_upper DECIMAL(5,4),  -- Wilson confidence interval upper bound

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(champion_name, patch_version, role, side)
);

-- Analytics refresh log (tracks computation job history)
CREATE TABLE analytics_refresh_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('success', 'failed')),
  duration_ms INT,
  rows_affected INT,
  error_message TEXT,
  refreshed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for champion_stats_computed
CREATE INDEX idx_stats_computed_lookup
  ON champion_stats_computed(champion_name, patch_version, role, side);

CREATE INDEX idx_stats_computed_confidence
  ON champion_stats_computed(confidence);

CREATE INDEX idx_stats_computed_patch
  ON champion_stats_computed(patch_version);

-- Index for analytics_refresh_log
CREATE INDEX idx_refresh_log_job
  ON analytics_refresh_log(job_name, refreshed_at DESC);

-- Add updated_at trigger for champion_stats_computed
CREATE TRIGGER update_champion_stats_computed_updated_at
  BEFORE UPDATE ON champion_stats_computed
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
