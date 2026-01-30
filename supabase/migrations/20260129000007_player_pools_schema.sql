-- Player Pools Schema
-- Creates player champion pool aggregation with role flexibility scores
-- Dependencies: synapse.players, synapse.champion_picks
-- Part of: Phase 02-05 (Player Pool Analytics)

SET search_path TO synapse;

-- ====================
-- Player Champion Pools
-- ====================
-- Aggregates individual player champion statistics with recency weighting
-- Enables targeted ban recommendations and comfort pick identification

CREATE TABLE IF NOT EXISTS player_champion_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  champion_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('top', 'jungle', 'mid', 'adc', 'support')),

  -- Game statistics
  games_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  raw_win_rate DECIMAL(5,4),
  smoothed_win_rate DECIMAL(5,4),  -- Bayesian smoothed with lighter prior (5 games)
  weighted_win_rate DECIMAL(5,4),  -- Recency-weighted (30-day half-life)

  -- Role confidence and recency
  avg_role_confidence DECIMAL(3,2),  -- Average role_confidence for this champion
  last_played TIMESTAMPTZ,
  days_since_played INT,  -- Computed from last_played

  -- Comfort level classification
  comfort_level VARCHAR(20) CHECK (comfort_level IN ('signature', 'comfort', 'occasional', 'rare')),
  -- signature: 10+ games AND win_rate >= 0.55
  -- comfort: 5+ games AND win_rate >= 0.50
  -- occasional: 3+ games
  -- rare: <3 games

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one row per player/champion/role combination
  UNIQUE(player_id, champion_name, role)
);

COMMENT ON TABLE player_champion_pools IS 'Aggregated player champion statistics with comfort level classification';
COMMENT ON COLUMN player_champion_pools.smoothed_win_rate IS 'Bayesian smoothed win rate (prior: 50%, weight: 5 games)';
COMMENT ON COLUMN player_champion_pools.weighted_win_rate IS 'Recency-weighted win rate (30-day half-life)';
COMMENT ON COLUMN player_champion_pools.comfort_level IS 'signature=10+g 55%+wr, comfort=5+g 50%+wr, occasional=3+g, rare<3g';

-- ====================
-- Flex Picks
-- ====================
-- Identifies champions played in multiple roles by the same player
-- Enables flex pick detection for draft strategy

CREATE TABLE IF NOT EXISTS flex_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  champion_name VARCHAR(100) NOT NULL,

  -- Role distribution
  roles_played TEXT[] NOT NULL,  -- Array of roles this player has played this champion
  primary_role VARCHAR(20),       -- Role with most games
  secondary_role VARCHAR(20),     -- Role with second most games
  total_games INT NOT NULL DEFAULT 0,

  -- Flexibility scoring
  is_true_flex BOOLEAN DEFAULT FALSE,  -- TRUE if 2+ roles with 3+ games each
  flexibility_score DECIMAL(3,2),      -- 0-1, how evenly spread across roles
  -- Score = 1 - (max_role_games / total_games)
  -- 0.5 = perfectly split between 2 roles
  -- Near 0 = one role dominates

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Ensure one row per player/champion combination
  UNIQUE(player_id, champion_name)
);

COMMENT ON TABLE flex_picks IS 'Champions played in multiple roles by same player (flex pick identification)';
COMMENT ON COLUMN flex_picks.flexibility_score IS '1 - (max_role_games / total_games): 0.5=even split, 0=single role';
COMMENT ON COLUMN flex_picks.is_true_flex IS 'TRUE if player has 3+ games in 2+ different roles';

-- ====================
-- Indexes
-- ====================

-- Player pool lookups
CREATE INDEX idx_player_pools_player ON player_champion_pools(player_id);
CREATE INDEX idx_player_pools_champion ON player_champion_pools(champion_name);
CREATE INDEX idx_player_pools_comfort ON player_champion_pools(player_id, comfort_level);

-- Flex pick lookups
CREATE INDEX idx_flex_picks_player ON flex_picks(player_id);
CREATE INDEX idx_flex_picks_true_flex ON flex_picks(is_true_flex) WHERE is_true_flex = TRUE;

-- ====================
-- Triggers
-- ====================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_player_pools_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_player_pools_updated_at
  BEFORE UPDATE ON player_champion_pools
  FOR EACH ROW
  EXECUTE FUNCTION update_player_pools_updated_at();
