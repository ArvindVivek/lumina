-- Coaching Analytics RPC Functions
-- This migration creates PostgreSQL functions for coaching-related queries
-- Note: Some simpler queries will use Supabase client directly

-- ============================================================================
-- COACHING QUERIES (coaching-queries.ts)
-- ============================================================================

-- Find similar historical scenarios
CREATE OR REPLACE FUNCTION find_similar_scenarios(
  p_attacker_alive INTEGER,
  p_defender_alive INTEGER,
  p_spike_planted BOOLEAN,
  p_map_name TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  round_id TEXT,
  game_id TEXT,
  map_name TEXT,
  round_number INTEGER,
  attacker_alive INTEGER,
  defender_alive INTEGER,
  spike_planted BOOLEAN,
  attacker_won BOOLEAN,
  similarity_score NUMERIC
) AS $$
DECLARE
  v_has_map_filter BOOLEAN;
  v_map_filter TEXT;
BEGIN
  v_map_filter := COALESCE(p_map_name, '');
  v_has_map_filter := p_map_name IS NOT NULL;

  -- First try scenario_index table
  RETURN QUERY
  SELECT
    si.round_id,
    si.game_id,
    si.map_name,
    si.round_number,
    si.attacker_alive,
    si.defender_alive,
    si.spike_planted,
    si.attacker_won,
    1.0 -
      (ABS(si.attacker_alive - p_attacker_alive) * 0.15) -
      (ABS(si.defender_alive - p_defender_alive) * 0.15) -
      (CASE WHEN si.spike_planted != p_spike_planted THEN 0.3 ELSE 0 END) -
      (CASE WHEN v_has_map_filter AND si.map_name != v_map_filter THEN 0.1 ELSE 0 END)
    as similarity_score
  FROM public.scenario_index si
  WHERE si.attacker_alive BETWEEN p_attacker_alive - 1 AND p_attacker_alive + 1
    AND si.defender_alive BETWEEN p_defender_alive - 1 AND p_defender_alive + 1
    AND (NOT v_has_map_filter OR si.map_name = v_map_filter)
  ORDER BY similarity_score DESC
  LIMIT p_limit;

  -- If no results, return empty (TypeScript will handle fallback)
  IF NOT FOUND THEN
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Detect anti-strat signals
CREATE OR REPLACE FUNCTION detect_anti_strat_signals(
  p_series_id TEXT,
  p_team_id TEXT
)
RETURNS TABLE (
  signal TEXT,
  severity TEXT,
  detail TEXT,
  implication TEXT,
  occurrences INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH first_death_rounds AS (
    SELECT
      prs.player_id,
      p.name as player_name,
      prs.round_id,
      g.map_name,
      ke.game_time_ms,
      r.winning_team_id,
      prs.team_id
    FROM public.player_round_stats prs
    JOIN public.players p ON prs.player_id = p.id
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    LEFT JOIN public.kill_events ke ON ke.round_id = r.id AND ke.victim_id = prs.player_id AND ke.is_first_kill = TRUE
    WHERE g.series_id = p_series_id
      AND prs.team_id = p_team_id
      AND prs.first_death = TRUE
  ),
  repeated_deaths AS (
    SELECT
      player_id,
      player_name,
      map_name,
      COUNT(*) as death_count,
      AVG(game_time_ms) as avg_death_time,
      COUNT(*) FILTER (WHERE winning_team_id != team_id)::FLOAT / COUNT(*) as loss_rate
    FROM first_death_rounds
    GROUP BY player_id, player_name, map_name
    HAVING COUNT(*) >= 3
    ORDER BY COUNT(*) DESC, loss_rate DESC
  )
  SELECT
    ('Predictable ' || rd.player_name || ' first deaths on ' || rd.map_name)::TEXT as signal,
    CASE
      WHEN rd.loss_rate > 0.7 AND rd.death_count >= 4 THEN 'critical'
      WHEN rd.loss_rate > 0.6 AND rd.death_count >= 3 THEN 'moderate'
      ELSE 'minor'
    END::TEXT as severity,
    (rd.player_name || ' died first ' || rd.death_count || ' times on ' || rd.map_name || ', avg at ' || ROUND(rd.avg_death_time / 1000, 1) || 's')::TEXT as detail,
    ('Opponent likely timing ' || rd.player_name || '''s positioning - vary approach or fake elsewhere')::TEXT as implication,
    rd.death_count::INTEGER as occurrences
  FROM repeated_deaths rd
  LIMIT 3;
END;
$$ LANGUAGE plpgsql STABLE;

-- Detect forced mistakes
CREATE OR REPLACE FUNCTION detect_forced_mistakes(
  p_series_id TEXT,
  p_team_id TEXT
)
RETURNS TABLE (
  mistake TEXT,
  severity TEXT,
  detail TEXT,
  fix TEXT,
  rounds_impacted INTEGER
) AS $$
BEGIN
  RETURN QUERY
  WITH round_trades AS (
    SELECT
      r.id as round_id,
      g.map_name,
      r.round_number,
      r.winning_team_id,
      COUNT(*) FILTER (WHERE prs.deaths > 0 AND prs.traded = FALSE AND prs.team_id = p_team_id) as untraded_deaths
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE g.series_id = p_series_id
    GROUP BY r.id, g.map_name, r.round_number, r.winning_team_id
  ),
  untraded_patterns AS (
    SELECT
      map_name,
      SUM(CASE WHEN untraded_deaths >= 3 THEN 1 ELSE 0 END) as high_untraded_rounds,
      SUM(CASE WHEN untraded_deaths >= 3 AND winning_team_id != p_team_id THEN 1 ELSE 0 END) as high_untraded_losses,
      AVG(untraded_deaths) as avg_untraded
    FROM round_trades
    GROUP BY map_name
    HAVING SUM(CASE WHEN untraded_deaths >= 3 THEN 1 ELSE 0 END) > 0
    ORDER BY high_untraded_losses DESC
  )
  SELECT
    ('Isolated deaths on ' || up.map_name)::TEXT as mistake,
    CASE
      WHEN up.high_untraded_losses >= 4 THEN 'critical'
      WHEN up.high_untraded_losses >= 3 THEN 'high'
      WHEN up.high_untraded_losses >= 2 THEN 'medium'
      ELSE 'low'
    END::TEXT as severity,
    ('Lost ' || up.high_untraded_losses || ' rounds with 3+ untraded deaths on ' || up.map_name)::TEXT as detail,
    'Review positioning to ensure teammates can trade. Never isolate on contact.'::TEXT as fix,
    up.high_untraded_rounds::INTEGER as rounds_impacted
  FROM untraded_patterns up
  LIMIT 3;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION find_similar_scenarios TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION detect_anti_strat_signals TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION detect_forced_mistakes TO anon, authenticated, service_role;
