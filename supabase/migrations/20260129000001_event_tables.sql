-- Event-level and Analysis Tables for Synapse
-- Migration: 20260129000001_event_tables.sql
-- Created: 2026-01-29
-- Adds detailed event tracking and pre-computed analysis tables

SET search_path TO synapse, public;

-- ==========================================
-- PLAYER PERFORMANCE TABLES
-- ==========================================

-- Player game stats (aggregated per game)
CREATE TABLE player_game_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  champion_name VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('top', 'jungle', 'mid', 'adc', 'support')),
  team_side VARCHAR(10) NOT NULL CHECK (team_side IN ('blue', 'red')),

  -- KDA stats
  kills INT NOT NULL DEFAULT 0,
  deaths INT NOT NULL DEFAULT 0,
  assists INT NOT NULL DEFAULT 0,

  -- Combat stats
  damage_dealt_champions INT NOT NULL DEFAULT 0,
  damage_dealt_objectives INT NOT NULL DEFAULT 0,
  damage_taken INT NOT NULL DEFAULT 0,
  healing_done INT NOT NULL DEFAULT 0,
  shielding_done INT NOT NULL DEFAULT 0,

  -- Economy stats
  gold_earned INT NOT NULL DEFAULT 0,
  gold_spent INT NOT NULL DEFAULT 0,
  cs_total INT NOT NULL DEFAULT 0,
  cs_minute DECIMAL(5, 2),

  -- Vision stats
  wards_placed INT NOT NULL DEFAULT 0,
  wards_destroyed INT NOT NULL DEFAULT 0,
  vision_score INT NOT NULL DEFAULT 0,

  -- Performance flags
  first_blood BOOLEAN DEFAULT FALSE,
  first_blood_victim BOOLEAN DEFAULT FALSE,
  solo_kills INT NOT NULL DEFAULT 0,
  multi_kills JSONB, -- {"double": 2, "triple": 1, "quadra": 0, "penta": 0}

  -- Items
  final_items TEXT[], -- Array of item names at game end

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

-- ==========================================
-- OBJECTIVE EVENT TABLES
-- ==========================================

-- Dragon/Baron/Herald/Tower/Inhibitor events
CREATE TABLE objective_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_time_seconds INT NOT NULL, -- Seconds since game start
  objective_type VARCHAR(50) NOT NULL CHECK (objective_type IN (
    'dragon_cloud', 'dragon_infernal', 'dragon_mountain', 'dragon_ocean',
    'dragon_hextech', 'dragon_chemtech', 'dragon_elder', 'baron', 'herald',
    'tower_outer_top', 'tower_outer_mid', 'tower_outer_bot',
    'tower_inner_top', 'tower_inner_mid', 'tower_inner_bot',
    'tower_base_top', 'tower_base_mid', 'tower_base_bot',
    'tower_nexus_top', 'tower_nexus_bot',
    'inhibitor_top', 'inhibitor_mid', 'inhibitor_bot', 'nexus'
  )),
  team_side VARCHAR(10) NOT NULL CHECK (team_side IN ('blue', 'red')),
  killer_player_id UUID REFERENCES players(id) ON DELETE SET NULL, -- Who last-hit
  assisting_player_ids UUID[], -- Players who assisted
  position_x INT,
  position_y INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- KILL EVENT TABLES
-- ==========================================

-- Individual kill events with positions and context
CREATE TABLE kill_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_time_seconds INT NOT NULL,

  -- Participants
  killer_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  victim_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  assisting_player_ids UUID[], -- Ordered list of assisters

  -- Kill details
  is_first_blood BOOLEAN DEFAULT FALSE,
  is_solo_kill BOOLEAN DEFAULT FALSE,
  is_shutdown BOOLEAN DEFAULT FALSE, -- Ended enemy kill streak
  shutdown_bounty INT DEFAULT 0, -- Extra gold from shutdown
  position_x INT,
  position_y INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kill assist junction table (for detailed assist tracking)
CREATE TABLE kill_assists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kill_event_id UUID NOT NULL REFERENCES kill_events(id) ON DELETE CASCADE,
  assister_player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  assist_order INT NOT NULL, -- 1st assist, 2nd assist, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kill_event_id, assister_player_id)
);

-- ==========================================
-- ECONOMY TABLES
-- ==========================================

-- Gold snapshots at key intervals (every 1-2 minutes)
CREATE TABLE gold_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_time_seconds INT NOT NULL,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  total_gold INT NOT NULL,
  current_gold INT NOT NULL, -- Unspent gold
  gold_per_second DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id, game_time_seconds)
);

-- Item purchase events
CREATE TABLE item_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_time_seconds INT NOT NULL,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('purchase', 'sell', 'undo')),
  item_name VARCHAR(100) NOT NULL,
  item_cost INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- VISION TABLES
-- ==========================================

-- Ward placement and destruction events
CREATE TABLE ward_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_time_seconds INT NOT NULL,
  event_type VARCHAR(20) NOT NULL CHECK (event_type IN ('placed', 'destroyed', 'expired')),
  ward_type VARCHAR(50) NOT NULL CHECK (ward_type IN (
    'yellow_trinket', 'blue_trinket', 'control_ward', 'farsight', 'stealth'
  )),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE, -- Placer or destroyer
  position_x INT NOT NULL,
  position_y INT NOT NULL,
  destroyed_by_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- POSITION TRACKING TABLES
-- ==========================================

-- Position snapshots at key intervals
CREATE TABLE position_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_time_seconds INT NOT NULL,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position_x INT NOT NULL,
  position_y INT NOT NULL,
  alive BOOLEAN NOT NULL,
  health_percent DECIMAL(5, 2),
  mana_percent DECIMAL(5, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id, game_time_seconds)
);

-- ==========================================
-- ANALYSIS TABLES (Pre-computed)
-- ==========================================

-- Game state snapshots for ML/analysis (every 1-2 mins or at key events)
CREATE TABLE game_state_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  game_time_seconds INT NOT NULL,

  -- Team gold differential
  blue_total_gold INT NOT NULL,
  red_total_gold INT NOT NULL,
  gold_diff INT NOT NULL, -- blue - red

  -- Team XP differential
  blue_total_xp INT NOT NULL,
  red_total_xp INT NOT NULL,
  xp_diff INT NOT NULL,

  -- Objective counts
  blue_dragons INT NOT NULL DEFAULT 0,
  red_dragons INT NOT NULL DEFAULT 0,
  blue_barons INT NOT NULL DEFAULT 0,
  red_barons INT NOT NULL DEFAULT 0,
  blue_heralds INT NOT NULL DEFAULT 0,
  red_heralds INT NOT NULL DEFAULT 0,
  blue_towers INT NOT NULL DEFAULT 0,
  red_towers INT NOT NULL DEFAULT 0,
  blue_inhibitors INT NOT NULL DEFAULT 0,
  red_inhibitors INT NOT NULL DEFAULT 0,

  -- Kill differential
  blue_kills INT NOT NULL DEFAULT 0,
  red_kills INT NOT NULL DEFAULT 0,

  -- Win probability (if computed)
  blue_win_probability DECIMAL(5, 4),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, game_time_seconds)
);

-- Champion matchup statistics (pre-computed)
CREATE TABLE champion_matchup_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  champion_a VARCHAR(100) NOT NULL,
  champion_b VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('top', 'jungle', 'mid', 'adc', 'support')),
  patch_version VARCHAR(20) NOT NULL,

  -- Head-to-head stats
  games_played INT NOT NULL DEFAULT 0,
  champion_a_wins INT NOT NULL DEFAULT 0,
  win_rate DECIMAL(5, 4), -- champion_a vs champion_b

  -- Performance differentials
  avg_kill_diff DECIMAL(5, 2), -- champion_a - champion_b
  avg_death_diff DECIMAL(5, 2),
  avg_cs_diff_15 DECIMAL(5, 2), -- CS diff at 15 minutes
  avg_gold_diff_15 INT,

  -- Confidence
  confidence VARCHAR(20) CHECK (confidence IN ('high', 'medium', 'low', 'insufficient')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(champion_a, champion_b, role, patch_version)
);

-- Team composition statistics
CREATE TABLE team_comp_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comp_hash VARCHAR(64) NOT NULL UNIQUE, -- Hash of sorted champion names
  champion_names TEXT[] NOT NULL, -- Sorted array of 5 champions
  patch_version VARCHAR(20) NOT NULL,

  -- Performance stats
  games_played INT NOT NULL DEFAULT 0,
  wins INT NOT NULL DEFAULT 0,
  win_rate DECIMAL(5, 4),

  -- Average game stats
  avg_game_duration INT, -- seconds
  avg_kills DECIMAL(5, 2),
  avg_deaths DECIMAL(5, 2),
  avg_objectives_taken DECIMAL(5, 2),

  -- Composition metadata
  comp_type VARCHAR(50), -- 'poke', 'engage', 'split', 'teamfight', 'pick'
  early_game_strength DECIMAL(3, 2), -- 0-1 score
  late_game_strength DECIMAL(3, 2),

  confidence VARCHAR(20) CHECK (confidence IN ('high', 'medium', 'low', 'insufficient')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Draft win probability (based on picks/bans)
CREATE TABLE draft_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id UUID NOT NULL REFERENCES drafts(id) ON DELETE CASCADE,

  -- Predicted win rates
  blue_win_probability DECIMAL(5, 4),
  red_win_probability DECIMAL(5, 4),

  -- Contributing factors
  blue_comp_strength DECIMAL(5, 4), -- How strong is blue's comp in vacuum
  red_comp_strength DECIMAL(5, 4),
  matchup_advantage DECIMAL(5, 4), -- Blue vs Red head-to-head

  -- Confidence
  confidence VARCHAR(20) CHECK (confidence IN ('high', 'medium', 'low', 'insufficient')),

  -- Actual outcome (filled after game)
  actual_winner VARCHAR(10) CHECK (actual_winner IN ('blue', 'red', NULL)),
  prediction_correct BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(draft_id)
);

-- Player performance trends (rolling statistics)
CREATE TABLE player_performance_trends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  champion_name VARCHAR(100) NOT NULL,
  patch_version VARCHAR(20) NOT NULL,

  -- Game counts
  games_played INT NOT NULL DEFAULT 0,
  games_won INT NOT NULL DEFAULT 0,
  win_rate DECIMAL(5, 4),

  -- Average stats
  avg_kda DECIMAL(5, 2),
  avg_kills DECIMAL(5, 2),
  avg_deaths DECIMAL(5, 2),
  avg_assists DECIMAL(5, 2),
  avg_cs_per_min DECIMAL(5, 2),
  avg_damage_per_min DECIMAL(7, 2),
  avg_gold_per_min DECIMAL(6, 2),
  avg_vision_score DECIMAL(5, 2),

  -- Performance flags
  first_blood_rate DECIMAL(5, 4), -- % of games with first blood
  solo_kill_rate DECIMAL(5, 4),

  -- Form (recent performance)
  last_5_games_wr DECIMAL(5, 4),

  confidence VARCHAR(20) CHECK (confidence IN ('high', 'medium', 'low', 'insufficient')),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, champion_name, patch_version)
);

-- ==========================================
-- INDEXES
-- ==========================================

-- Player game stats indexes
CREATE INDEX idx_player_game_stats_game ON player_game_stats(game_id);
CREATE INDEX idx_player_game_stats_player ON player_game_stats(player_id);
CREATE INDEX idx_player_game_stats_champion ON player_game_stats(champion_name);

-- Objective events indexes
CREATE INDEX idx_objective_events_game ON objective_events(game_id);
CREATE INDEX idx_objective_events_type ON objective_events(objective_type);
CREATE INDEX idx_objective_events_time ON objective_events(game_id, game_time_seconds);

-- Kill events indexes
CREATE INDEX idx_kill_events_game ON kill_events(game_id);
CREATE INDEX idx_kill_events_killer ON kill_events(killer_player_id);
CREATE INDEX idx_kill_events_victim ON kill_events(victim_player_id);
CREATE INDEX idx_kill_events_time ON kill_events(game_id, game_time_seconds);

-- Gold snapshots indexes
CREATE INDEX idx_gold_snapshots_game ON gold_snapshots(game_id);
CREATE INDEX idx_gold_snapshots_player ON gold_snapshots(player_id);
CREATE INDEX idx_gold_snapshots_time ON gold_snapshots(game_id, game_time_seconds);

-- Item events indexes
CREATE INDEX idx_item_events_game ON item_events(game_id);
CREATE INDEX idx_item_events_player ON item_events(player_id);

-- Ward events indexes
CREATE INDEX idx_ward_events_game ON ward_events(game_id);
CREATE INDEX idx_ward_events_player ON ward_events(player_id);

-- Position snapshots indexes
CREATE INDEX idx_position_snapshots_game ON position_snapshots(game_id);
CREATE INDEX idx_position_snapshots_player ON position_snapshots(player_id);
CREATE INDEX idx_position_snapshots_time ON position_snapshots(game_id, game_time_seconds);

-- Game state snapshots indexes
CREATE INDEX idx_game_state_snapshots_game ON game_state_snapshots(game_id);
CREATE INDEX idx_game_state_snapshots_time ON game_state_snapshots(game_id, game_time_seconds);

-- Analysis table indexes
CREATE INDEX idx_champion_matchup_stats_champions ON champion_matchup_stats(champion_a, champion_b, role);
CREATE INDEX idx_team_comp_stats_patch ON team_comp_stats(patch_version);
CREATE INDEX idx_player_performance_trends_player ON player_performance_trends(player_id);
CREATE INDEX idx_player_performance_trends_champion ON player_performance_trends(champion_name);

-- ==========================================
-- TRIGGERS
-- ==========================================

CREATE TRIGGER update_champion_matchup_stats_updated_at BEFORE UPDATE ON champion_matchup_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_team_comp_stats_updated_at BEFORE UPDATE ON team_comp_stats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_performance_trends_updated_at BEFORE UPDATE ON player_performance_trends
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
