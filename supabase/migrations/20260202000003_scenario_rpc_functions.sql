-- Scenario Analysis RPC Functions
-- This migration creates PostgreSQL functions for scenario-based queries

-- ============================================================================
-- SCENARIO QUERIES (scenario-queries.ts)
-- ============================================================================

-- SCEN-01: Save/Retake Similarity Matching
CREATE OR REPLACE FUNCTION match_save_retake_situations(
  p_defender_economy INTEGER,
  p_defender_alive INTEGER,
  p_attacker_alive INTEGER,
  p_time_remaining_ms INTEGER DEFAULT 45000,
  p_map_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  round_id TEXT,
  game_id TEXT,
  map_name TEXT,
  defender_economy INTEGER,
  defender_alive INTEGER,
  attacker_alive INTEGER,
  time_remaining_ms INTEGER,
  defender_won BOOLEAN,
  similarity_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH normalized_distances AS (
    SELECT
      si.round_id,
      si.game_id,
      si.map_name,
      si.defender_economy,
      si.defender_alive,
      si.attacker_alive,
      si.time_remaining_ms,
      si.attacker_won,
      -- Normalized distance calculations (0-1 range)
      ABS(si.defender_economy - p_defender_economy) / 25000.0 as economy_dist,
      ABS(si.defender_alive - p_defender_alive) / 5.0 as defender_alive_dist,
      ABS(si.attacker_alive - p_attacker_alive) / 5.0 as attacker_alive_dist,
      ABS(si.time_remaining_ms - p_time_remaining_ms) / 45000.0 as time_dist
    FROM public.scenario_index si
    WHERE si.spike_planted = TRUE
      AND (p_map_name IS NULL OR si.map_name = p_map_name)
  ),
  weighted_similarity AS (
    SELECT
      nd.round_id,
      nd.game_id,
      nd.map_name,
      nd.defender_economy,
      nd.defender_alive,
      nd.attacker_alive,
      nd.time_remaining_ms,
      nd.attacker_won,
      -- Weighted distance: economy(0.35) + defender_alive(0.30) + attacker_alive(0.25) + time(0.10)
      (nd.economy_dist * 0.35 + nd.defender_alive_dist * 0.30 + nd.attacker_alive_dist * 0.25 + nd.time_dist * 0.10) as similarity_distance
    FROM normalized_distances nd
  )
  SELECT
    ws.round_id,
    ws.game_id,
    ws.map_name,
    ws.defender_economy,
    ws.defender_alive,
    ws.attacker_alive,
    ws.time_remaining_ms,
    NOT ws.attacker_won as defender_won,
    (1 - ws.similarity_distance) as similarity_score
  FROM weighted_similarity ws
  WHERE ws.similarity_distance < 0.25
  ORDER BY ws.similarity_distance ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql STABLE;

-- SCEN-03: Force/Eco Decision Analysis
CREATE OR REPLACE FUNCTION match_force_eco_situations(
  p_team_economy INTEGER,
  p_opponent_economy INTEGER,
  p_map_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  round_id TEXT,
  round_number INTEGER,
  map_name TEXT,
  team_economy INTEGER,
  opponent_economy INTEGER,
  economy_category TEXT,
  opponent_category TEXT,
  team_won BOOLEAN
) AS $$
DECLARE
  v_economy_category TEXT;
BEGIN
  -- Classify query economy
  IF p_team_economy < 10000 THEN
    v_economy_category := 'eco';
  ELSIF p_team_economy < 20000 THEN
    v_economy_category := 'force_buy';
  ELSE
    v_economy_category := 'full_buy';
  END IF;

  RETURN QUERY
  SELECT
    r.id as round_id,
    r.round_number,
    g.map_name,
    r.team_a_loadout_value as team_economy,
    r.team_b_loadout_value as opponent_economy,
    CASE
      WHEN r.team_a_loadout_value < 10000 THEN 'eco'
      WHEN r.team_a_loadout_value < 20000 THEN 'force_buy'
      ELSE 'full_buy'
    END as economy_category,
    CASE
      WHEN r.team_b_loadout_value < 10000 THEN 'eco'
      WHEN r.team_b_loadout_value < 20000 THEN 'force_buy'
      ELSE 'full_buy'
    END as opponent_category,
    CASE
      WHEN r.winning_team_id = s.team_a_id THEN TRUE
      ELSE FALSE
    END as team_won
  FROM public.rounds r
  JOIN public.games g ON r.game_id = g.id
  JOIN public.series s ON g.series_id = s.id
  WHERE CASE
      WHEN r.team_a_loadout_value < 10000 THEN 'eco'
      WHEN r.team_a_loadout_value < 20000 THEN 'force_buy'
      ELSE 'full_buy'
    END = v_economy_category
    AND ABS(r.team_b_loadout_value - p_opponent_economy) < 5000
    AND (p_map_name IS NULL OR g.map_name = p_map_name)
  ORDER BY ABS(r.team_a_loadout_value - p_team_economy)
  LIMIT 100;
END;
$$ LANGUAGE plpgsql STABLE;

-- SCEN-04: Clutch Situation Analysis
CREATE OR REPLACE FUNCTION match_clutch_situations(
  p_opponent_count INTEGER,
  p_map_name TEXT DEFAULT NULL,
  p_site TEXT DEFAULT NULL
)
RETURNS TABLE (
  round_id TEXT,
  player_id TEXT,
  agent TEXT,
  clutch_won BOOLEAN,
  round_number INTEGER,
  map_name TEXT,
  site TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH clutch_with_context AS (
    SELECT
      prs.round_id,
      prs.player_id,
      prs.team_id,
      prs.agent,
      prs.clutch_won,
      r.round_number,
      r.team_a_alive,
      r.team_b_alive,
      g.map_name,
      s.team_a_id,
      s.team_b_id
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.clutch_situation = TRUE
  )
  SELECT
    cwc.round_id,
    cwc.player_id,
    cwc.agent,
    cwc.clutch_won,
    cwc.round_number,
    cwc.map_name,
    se.site
  FROM clutch_with_context cwc
  LEFT JOIN public.spike_events se ON se.round_id = cwc.round_id AND se.event_type = 'plant'
  WHERE CASE
      WHEN cwc.team_id = cwc.team_a_id THEN cwc.team_b_alive
      ELSE cwc.team_a_alive
    END = p_opponent_count
    AND (p_map_name IS NULL OR cwc.map_name = p_map_name)
    AND (p_site IS NULL OR se.site = p_site)
  ORDER BY cwc.round_number DESC
  LIMIT 100;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION match_save_retake_situations TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_force_eco_situations TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION match_clutch_situations TO anon, authenticated, service_role;
