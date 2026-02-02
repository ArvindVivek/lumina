-- Comprehensive deduplication migration for all schemas
-- Fixes duplicate data in:
--   PUBLIC: kill_events (3x), kill_assists (2x), spike_events (2x), scenario_index (2x)
--   SYNAPSE: champion_picks (4x)

-- =============================================================================
-- PHASE 1: PUBLIC SCHEMA DEDUPLICATION
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1.1: Deduplicate kill_events
-- Natural key: round_id + game_time_ms + killer_id + victim_id
-- Actual columns: id, round_id, game_time_ms, killer_id, victim_id, weapon,
--                 headshot, wallbang, is_first_kill, is_trade, is_self_kill,
--                 killer_pos_x, killer_pos_y, victim_pos_x, victim_pos_y,
--                 kill_distance, assist_count, created_at
-- -----------------------------------------------------------------------------
BEGIN;

-- Create temp table with deduplicated data
CREATE TEMP TABLE kill_events_deduped AS
SELECT DISTINCT ON (round_id, game_time_ms, killer_id, victim_id)
  id,
  round_id,
  game_time_ms,
  killer_id,
  victim_id,
  weapon,
  headshot,
  wallbang,
  is_first_kill,
  is_trade,
  is_self_kill,
  killer_pos_x,
  killer_pos_y,
  victim_pos_x,
  victim_pos_y,
  kill_distance,
  assist_count,
  created_at
FROM public.kill_events
ORDER BY round_id, game_time_ms, killer_id, victim_id, created_at DESC;

-- Get counts for verification
DO $$
DECLARE
  original_count INTEGER;
  deduped_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO original_count FROM public.kill_events;
  SELECT COUNT(*) INTO deduped_count FROM kill_events_deduped;
  RAISE NOTICE 'kill_events: % original → % deduplicated (removed %)',
    original_count, deduped_count, original_count - deduped_count;
END $$;

-- Clear and repopulate
TRUNCATE public.kill_events CASCADE;

INSERT INTO public.kill_events (
  id, round_id, game_time_ms, killer_id, victim_id, weapon, headshot,
  wallbang, is_first_kill, is_trade, is_self_kill, killer_pos_x, killer_pos_y,
  victim_pos_x, victim_pos_y, kill_distance, assist_count, created_at
)
SELECT * FROM kill_events_deduped;

DROP TABLE kill_events_deduped;

-- Add unique constraint to prevent future duplicates
ALTER TABLE public.kill_events
DROP CONSTRAINT IF EXISTS kill_events_unique_key;

ALTER TABLE public.kill_events
ADD CONSTRAINT kill_events_unique_key
UNIQUE (round_id, game_time_ms, killer_id, victim_id);

COMMIT;

-- -----------------------------------------------------------------------------
-- 1.2: Deduplicate kill_assists
-- Natural key: round_id + kill_index + assister_id
-- Actual columns: id, round_id, kill_index, killer_id, assister_id, created_at
-- -----------------------------------------------------------------------------
BEGIN;

CREATE TEMP TABLE kill_assists_deduped AS
SELECT DISTINCT ON (round_id, COALESCE(kill_index, 0), assister_id)
  id,
  round_id,
  kill_index,
  killer_id,
  assister_id,
  created_at
FROM public.kill_assists
ORDER BY round_id, COALESCE(kill_index, 0), assister_id, created_at DESC;

DO $$
DECLARE
  original_count INTEGER;
  deduped_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO original_count FROM public.kill_assists;
  SELECT COUNT(*) INTO deduped_count FROM kill_assists_deduped;
  RAISE NOTICE 'kill_assists: % original → % deduplicated (removed %)',
    original_count, deduped_count, original_count - deduped_count;
END $$;

TRUNCATE public.kill_assists CASCADE;

INSERT INTO public.kill_assists (id, round_id, kill_index, killer_id, assister_id, created_at)
SELECT * FROM kill_assists_deduped;

DROP TABLE kill_assists_deduped;

ALTER TABLE public.kill_assists
DROP CONSTRAINT IF EXISTS kill_assists_unique_key;

ALTER TABLE public.kill_assists
ADD CONSTRAINT kill_assists_unique_key
UNIQUE (round_id, kill_index, assister_id);

COMMIT;

-- -----------------------------------------------------------------------------
-- 1.3: Deduplicate spike_events
-- Natural key: round_id + game_time_ms + event_type + player_id
-- Actual columns: id, round_id, game_time_ms, event_type, player_id, site, pos_x, pos_y, created_at
-- -----------------------------------------------------------------------------
BEGIN;

CREATE TEMP TABLE spike_events_deduped AS
SELECT DISTINCT ON (round_id, game_time_ms, event_type, player_id)
  id,
  round_id,
  game_time_ms,
  event_type,
  player_id,
  site,
  pos_x,
  pos_y,
  created_at
FROM public.spike_events
ORDER BY round_id, game_time_ms, event_type, player_id, created_at DESC;

DO $$
DECLARE
  original_count INTEGER;
  deduped_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO original_count FROM public.spike_events;
  SELECT COUNT(*) INTO deduped_count FROM spike_events_deduped;
  RAISE NOTICE 'spike_events: % original → % deduplicated (removed %)',
    original_count, deduped_count, original_count - deduped_count;
END $$;

TRUNCATE public.spike_events CASCADE;

INSERT INTO public.spike_events (id, round_id, game_time_ms, event_type, player_id, site, pos_x, pos_y, created_at)
SELECT * FROM spike_events_deduped;

DROP TABLE spike_events_deduped;

ALTER TABLE public.spike_events
DROP CONSTRAINT IF EXISTS spike_events_unique_key;

ALTER TABLE public.spike_events
ADD CONSTRAINT spike_events_unique_key
UNIQUE (round_id, game_time_ms, event_type, player_id);

COMMIT;

-- -----------------------------------------------------------------------------
-- 1.4: Deduplicate ability_events
-- Natural key: round_id + player_id + ability_name
-- Actual columns: id, round_id, player_id, ability_name, ability_count, created_at
-- -----------------------------------------------------------------------------
BEGIN;

CREATE TEMP TABLE ability_events_deduped AS
SELECT DISTINCT ON (round_id, player_id, ability_name)
  id,
  round_id,
  player_id,
  ability_name,
  ability_count,
  created_at
FROM public.ability_events
ORDER BY round_id, player_id, ability_name, created_at DESC;

DO $$
DECLARE
  original_count INTEGER;
  deduped_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO original_count FROM public.ability_events;
  SELECT COUNT(*) INTO deduped_count FROM ability_events_deduped;
  RAISE NOTICE 'ability_events: % original → % deduplicated (removed %)',
    original_count, deduped_count, original_count - deduped_count;
END $$;

TRUNCATE public.ability_events CASCADE;

INSERT INTO public.ability_events (id, round_id, player_id, ability_name, ability_count, created_at)
SELECT * FROM ability_events_deduped;

DROP TABLE ability_events_deduped;

ALTER TABLE public.ability_events
DROP CONSTRAINT IF EXISTS ability_events_unique_key;

ALTER TABLE public.ability_events
ADD CONSTRAINT ability_events_unique_key
UNIQUE (round_id, player_id, ability_name);

COMMIT;

-- -----------------------------------------------------------------------------
-- 1.5: Deduplicate orb_events
-- Natural key: round_id + game_time_ms + player_id
-- Actual columns: id, round_id, game_time_ms, player_id, orb_type, pos_x, pos_y, created_at
-- -----------------------------------------------------------------------------
BEGIN;

CREATE TEMP TABLE orb_events_deduped AS
SELECT DISTINCT ON (round_id, game_time_ms, player_id)
  id,
  round_id,
  game_time_ms,
  player_id,
  orb_type,
  pos_x,
  pos_y,
  created_at
FROM public.orb_events
ORDER BY round_id, game_time_ms, player_id, created_at DESC;

DO $$
DECLARE
  original_count INTEGER;
  deduped_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO original_count FROM public.orb_events;
  SELECT COUNT(*) INTO deduped_count FROM orb_events_deduped;
  RAISE NOTICE 'orb_events: % original → % deduplicated (removed %)',
    original_count, deduped_count, original_count - deduped_count;
END $$;

TRUNCATE public.orb_events CASCADE;

INSERT INTO public.orb_events (id, round_id, game_time_ms, player_id, orb_type, pos_x, pos_y, created_at)
SELECT * FROM orb_events_deduped;

DROP TABLE orb_events_deduped;

ALTER TABLE public.orb_events
DROP CONSTRAINT IF EXISTS orb_events_unique_key;

ALTER TABLE public.orb_events
ADD CONSTRAINT orb_events_unique_key
UNIQUE (round_id, game_time_ms, player_id);

COMMIT;

-- -----------------------------------------------------------------------------
-- 1.6: Deduplicate scenario_index
-- Natural key: round_id (one scenario snapshot per round)
-- Actual columns: id, round_id, game_id, round_number, attacker_alive, defender_alive,
--                 spike_planted, time_remaining_ms, attacker_economy, defender_economy,
--                 attacker_won, map_name, tournament_id, created_at
-- -----------------------------------------------------------------------------
BEGIN;

CREATE TEMP TABLE scenario_index_deduped AS
SELECT DISTINCT ON (round_id)
  id,
  round_id,
  game_id,
  round_number,
  attacker_alive,
  defender_alive,
  spike_planted,
  time_remaining_ms,
  attacker_economy,
  defender_economy,
  attacker_won,
  map_name,
  tournament_id,
  created_at
FROM public.scenario_index
ORDER BY round_id, created_at DESC;

DO $$
DECLARE
  original_count INTEGER;
  deduped_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO original_count FROM public.scenario_index;
  SELECT COUNT(*) INTO deduped_count FROM scenario_index_deduped;
  RAISE NOTICE 'scenario_index: % original → % deduplicated (removed %)',
    original_count, deduped_count, original_count - deduped_count;
END $$;

TRUNCATE public.scenario_index CASCADE;

INSERT INTO public.scenario_index (
  id, round_id, game_id, round_number, attacker_alive, defender_alive,
  spike_planted, time_remaining_ms, attacker_economy, defender_economy,
  attacker_won, map_name, tournament_id, created_at
)
SELECT * FROM scenario_index_deduped;

DROP TABLE scenario_index_deduped;

ALTER TABLE public.scenario_index
DROP CONSTRAINT IF EXISTS scenario_index_unique_key;

ALTER TABLE public.scenario_index
ADD CONSTRAINT scenario_index_unique_key
UNIQUE (round_id);

COMMIT;

-- =============================================================================
-- PHASE 2: SYNAPSE SCHEMA DEDUPLICATION
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1: Deduplicate synapse.champion_picks
-- Natural key: draft_id + pick_order
-- Actual columns: id, draft_id, player_id, team_side, champion_name, role,
--                 role_confidence, pick_order, created_at
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  original_count INTEGER;
  deduped_count INTEGER;
BEGIN
  -- Check if synapse schema exists
  IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'synapse') THEN
    -- Get original count
    SELECT COUNT(*) INTO original_count FROM synapse.champion_picks;

    -- Create temp table with deduplicated data
    CREATE TEMP TABLE champion_picks_deduped AS
    SELECT DISTINCT ON (draft_id, pick_order)
      id,
      draft_id,
      player_id,
      team_side,
      champion_name,
      role,
      role_confidence,
      pick_order,
      created_at
    FROM synapse.champion_picks
    ORDER BY draft_id, pick_order, created_at DESC;

    -- Get deduped count
    SELECT COUNT(*) INTO deduped_count FROM champion_picks_deduped;
    RAISE NOTICE 'synapse.champion_picks: % original → % deduplicated (removed %)',
      original_count, deduped_count, original_count - deduped_count;

    -- Clear and repopulate
    TRUNCATE synapse.champion_picks CASCADE;

    INSERT INTO synapse.champion_picks (
      id, draft_id, player_id, team_side, champion_name, role, role_confidence, pick_order, created_at
    )
    SELECT * FROM champion_picks_deduped;

    DROP TABLE champion_picks_deduped;

    -- Add unique constraint
    ALTER TABLE synapse.champion_picks
    DROP CONSTRAINT IF EXISTS champion_picks_unique_key;

    ALTER TABLE synapse.champion_picks
    ADD CONSTRAINT champion_picks_unique_key
    UNIQUE (draft_id, pick_order);
  ELSE
    RAISE NOTICE 'synapse schema does not exist, skipping champion_picks deduplication';
  END IF;
END $$;

-- =============================================================================
-- PHASE 3: REFRESH MATERIALIZED VIEWS
-- =============================================================================

-- Refresh all mosaic materialized views to reflect deduplicated data
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'mosaic' AND matviewname = 'mv_player_core_stats') THEN
    REFRESH MATERIALIZED VIEW mosaic.mv_player_core_stats;
    RAISE NOTICE 'Refreshed mosaic.mv_player_core_stats';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'mosaic' AND matviewname = 'mv_player_agent_pool') THEN
    REFRESH MATERIALIZED VIEW mosaic.mv_player_agent_pool;
    RAISE NOTICE 'Refreshed mosaic.mv_player_agent_pool';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'mosaic' AND matviewname = 'mv_team_map_stats') THEN
    REFRESH MATERIALIZED VIEW mosaic.mv_team_map_stats;
    RAISE NOTICE 'Refreshed mosaic.mv_team_map_stats';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'mosaic' AND matviewname = 'mv_team_compositions') THEN
    REFRESH MATERIALIZED VIEW mosaic.mv_team_compositions;
    RAISE NOTICE 'Refreshed mosaic.mv_team_compositions';
  END IF;
END $$;

-- =============================================================================
-- PHASE 4: VERIFICATION QUERIES (run manually to verify)
-- =============================================================================

-- Verification query to check for any remaining duplicates
-- Run this after migration to confirm success:
/*
SELECT 'kill_events' as table_name,
  COUNT(*) as total,
  COUNT(DISTINCT (round_id, game_time_ms, killer_id, victim_id)) as unique_keys,
  COUNT(*) - COUNT(DISTINCT (round_id, game_time_ms, killer_id, victim_id)) as duplicates
FROM public.kill_events
UNION ALL
SELECT 'kill_assists',
  COUNT(*),
  COUNT(DISTINCT (round_id, kill_index, assister_id)),
  COUNT(*) - COUNT(DISTINCT (round_id, kill_index, assister_id))
FROM public.kill_assists
UNION ALL
SELECT 'spike_events',
  COUNT(*),
  COUNT(DISTINCT (round_id, game_time_ms, event_type, player_id)),
  COUNT(*) - COUNT(DISTINCT (round_id, game_time_ms, event_type, player_id))
FROM public.spike_events
UNION ALL
SELECT 'scenario_index',
  COUNT(*),
  COUNT(DISTINCT round_id),
  COUNT(*) - COUNT(DISTINCT round_id)
FROM public.scenario_index;
*/
