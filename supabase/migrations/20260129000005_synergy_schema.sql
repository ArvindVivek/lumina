-- Synergy schema for Synapse
-- Migration: 20260129000005_synergy_schema.sql
-- Created: 2026-01-29
-- Purpose: Champion pair synergies with Bayesian smoothing and archetype fallback

-- Set search path to synapse schema
SET search_path TO synapse, public;

-- Champion synergies table (champion pair performance)
CREATE TABLE champion_synergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  champion_a VARCHAR(100) NOT NULL,
  champion_b VARCHAR(100) NOT NULL,
  patch_version VARCHAR(20) NOT NULL,

  -- Raw counts
  games_together INT NOT NULL DEFAULT 0,
  wins_together INT NOT NULL DEFAULT 0,

  -- Computed rates
  raw_win_rate DECIMAL(5,4),
  smoothed_win_rate DECIMAL(5,4),  -- Bayesian smoothed with prior
  synergy_delta DECIMAL(5,4),      -- smoothed_win_rate - 0.50 (positive = good synergy)

  -- Confidence scoring
  confidence VARCHAR(20) CHECK (confidence IN ('high', 'medium', 'low', 'insufficient')),
  ci_lower DECIMAL(5,4),  -- Wilson confidence interval lower bound
  ci_upper DECIMAL(5,4),  -- Wilson confidence interval upper bound

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(champion_a, champion_b, patch_version),
  CHECK(champion_a < champion_b)  -- Ensure consistent ordering (avoid duplicate pairs)
);

-- Champion archetypes table (for fallback on rare pairs)
CREATE TABLE champion_archetypes (
  champion_name VARCHAR(100) PRIMARY KEY,
  archetype VARCHAR(50) NOT NULL,
  damage_type VARCHAR(10) CHECK (damage_type IN ('physical', 'magic', 'mixed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Archetype synergies table (aggregated fallback for rare pairs)
CREATE TABLE archetype_synergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype_a VARCHAR(50) NOT NULL,
  archetype_b VARCHAR(50) NOT NULL,

  -- Aggregated stats
  games_together INT NOT NULL DEFAULT 0,
  smoothed_win_rate DECIMAL(5,4),

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(archetype_a, archetype_b),
  CHECK(archetype_a < archetype_b)  -- Ensure consistent ordering
);

-- Indexes for champion_synergies
CREATE INDEX idx_synergies_lookup
  ON champion_synergies(champion_a, champion_b, patch_version);

CREATE INDEX idx_synergies_champion_a
  ON champion_synergies(champion_a);

CREATE INDEX idx_synergies_champion_b
  ON champion_synergies(champion_b);

-- Index for champion_archetypes
CREATE INDEX idx_archetypes_champion
  ON champion_archetypes(champion_name);

-- Add updated_at trigger for champion_synergies
CREATE TRIGGER update_champion_synergies_updated_at
  BEFORE UPDATE ON champion_synergies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
