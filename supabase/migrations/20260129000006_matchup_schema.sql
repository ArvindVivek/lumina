-- Set search path to synapse schema
SET search_path TO synapse;

-- champion_matchups: Role-specific lane matchup win rates
CREATE TABLE IF NOT EXISTS champion_matchups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  champion VARCHAR(100) NOT NULL,  -- the champion we're evaluating
  opponent VARCHAR(100) NOT NULL,  -- opposing champion in same role
  role VARCHAR(20) NOT NULL CHECK (role IN ('top', 'jungle', 'mid', 'adc', 'support')),
  patch_version VARCHAR(20) NOT NULL,
  games INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,  -- wins for champion against opponent
  raw_win_rate DECIMAL(5,4),
  smoothed_win_rate DECIMAL(5,4),
  matchup_delta DECIMAL(5,4),  -- smoothed_win_rate - 0.50, positive = favorable
  confidence VARCHAR(20) CHECK (confidence IN ('high', 'medium', 'low', 'insufficient')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(champion, opponent, role, patch_version)
);

-- pick_order_stats: Early vs late pick success rates
CREATE TABLE IF NOT EXISTS pick_order_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  champion_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('top', 'jungle', 'mid', 'adc', 'support')),
  patch_version VARCHAR(20) NOT NULL,
  pick_phase VARCHAR(20) NOT NULL CHECK (pick_phase IN ('early', 'mid', 'late')),
  -- early: pick_order 1-3, mid: pick_order 4-7, late: pick_order 8-10
  games_in_phase INT NOT NULL DEFAULT 0,
  wins_in_phase INT NOT NULL DEFAULT 0,
  smoothed_win_rate DECIMAL(5,4),
  blind_pick_success DECIMAL(5,4),  -- win rate when picked before opponent
  counter_pick_success DECIMAL(5,4),  -- win rate when picked after opponent
  confidence VARCHAR(20) CHECK (confidence IN ('high', 'medium', 'low', 'insufficient')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(champion_name, role, patch_version, pick_phase)
);

-- Indexes for matchup lookups
CREATE INDEX IF NOT EXISTS idx_matchups_lookup
  ON champion_matchups(champion, role, patch_version);

CREATE INDEX IF NOT EXISTS idx_matchups_opponent
  ON champion_matchups(opponent, role, patch_version);

-- Indexes for pick order lookups
CREATE INDEX IF NOT EXISTS idx_pick_order_lookup
  ON pick_order_stats(champion_name, role, patch_version);

CREATE INDEX IF NOT EXISTS idx_pick_order_phase
  ON pick_order_stats(pick_phase, confidence);

-- Add updated_at trigger for champion_matchups
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_champion_matchups_updated_at
  BEFORE UPDATE ON champion_matchups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE champion_matchups IS 'Lane-specific champion counter-pick data with Bayesian smoothing';
COMMENT ON TABLE pick_order_stats IS 'Pick order success rates for blind pick vs counter-pick analysis';
COMMENT ON COLUMN champion_matchups.matchup_delta IS 'Positive = favorable matchup, negative = unfavorable';
COMMENT ON COLUMN pick_order_stats.pick_phase IS 'early: 1-3, mid: 4-7, late: 8-10';
