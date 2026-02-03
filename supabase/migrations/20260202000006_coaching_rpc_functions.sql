-- Coaching RPC Functions
-- This migration creates PostgreSQL functions to support coaching queries
-- These replace direct SQL queries from the postgres library

-- Drop existing functions if they exist to avoid signature conflicts
DROP FUNCTION IF EXISTS query_series_summary(TEXT, TEXT);
DROP FUNCTION IF EXISTS query_series_maps(TEXT);
DROP FUNCTION IF EXISTS query_map_metrics(TEXT, TEXT);
DROP FUNCTION IF EXISTS query_player_opening_duels(TEXT, TEXT);
DROP FUNCTION IF EXISTS query_rounds_for_review(TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS find_similar_scenarios(INTEGER, INTEGER, BOOLEAN, TEXT, INTEGER);
DROP FUNCTION IF EXISTS detect_anti_strat_signals(TEXT, TEXT);
DROP FUNCTION IF EXISTS detect_forced_mistakes(TEXT, TEXT);

-- ============================================================================
-- COACHING ANALYTICS (coaching-queries.ts)
-- ============================================================================

-- COACH-01: Series Summary
CREATE OR REPLACE FUNCTION query_series_summary(
  p_series_id TEXT,
  p_team_id TEXT
)
RETURNS TABLE (
  series_id TEXT,
  team_a_id TEXT,
  team_b_id TEXT,
  winner_id TEXT,
  team_a_name TEXT,
  team_b_name TEXT,
  team_a_wins BIGINT,
  team_b_wins BIGINT,
  total_maps BIGINT,
  total_rounds BIGINT
) AS $$
BEGIN
  RETURN QUERY
  WITH series_data AS (
    SELECT
      s.id,
      s.team_a_id,
      s.team_b_id,
      s.winner_id,
      ta.name as team_a_name,
      tb.name as team_b_name,
      (SELECT COUNT(*) FROM public.games WHERE series_id = s.id AND winner_id = s.team_a_id) as team_a_wins,
      (SELECT COUNT(*) FROM public.games WHERE series_id = s.id AND winner_id = s.team_b_id) as team_b_wins,
      (SELECT COUNT(*) FROM public.games WHERE series_id = s.id) as total_maps
    FROM public.series s
    JOIN public.teams ta ON s.team_a_id = ta.id
    JOIN public.teams tb ON s.team_b_id = tb.id
    WHERE s.id = p_series_id
  ),
  round_count AS (
    SELECT COUNT(*)::BIGINT as count
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    WHERE g.series_id = p_series_id
  )
  SELECT
    sd.id::TEXT,
    sd.team_a_id::TEXT,
    sd.team_b_id::TEXT,
    sd.winner_id::TEXT,
    sd.team_a_name::TEXT,
    sd.team_b_name::TEXT,
    sd.team_a_wins,
    sd.team_b_wins,
    sd.total_maps,
    rc.count as total_rounds
  FROM series_data sd, round_count rc;
END;
$$ LANGUAGE plpgsql STABLE;

-- COACH-02: Series Maps
CREATE OR REPLACE FUNCTION query_series_maps(
  p_series_id TEXT
)
RETURNS TABLE (
  game_id TEXT,
  map_name TEXT,
  team_a_score INTEGER,
  team_b_score INTEGER,
  winner_id TEXT,
  sequence_number INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id::TEXT as game_id,
    g.map_name::TEXT,
    g.team_a_score::INTEGER,
    g.team_b_score::INTEGER,
    g.winner_id::TEXT,
    g.sequence_number::INTEGER
  FROM public.games g
  WHERE g.series_id = p_series_id
  ORDER BY g.sequence_number;
END;
$$ LANGUAGE plpgsql STABLE;

-- COACH-03: Map Metrics
CREATE OR REPLACE FUNCTION query_map_metrics(
  p_series_id TEXT,
  p_team_id TEXT
)
RETURNS TABLE (
  game_id TEXT,
  map_name TEXT,
  team_a_score INTEGER,
  team_b_score INTEGER,
  team_a_id TEXT,
  team_b_id TEXT,
  fb_win_rate FLOAT,
  fb_conversion_rate FLOAT,
  trade_rate FLOAT,
  untraded_deaths BIGINT,
  post_plant_win_rate FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH game_rounds AS (
    SELECT
      g.id as game_id,
      g.map_name,
      g.team_a_score,
      g.team_b_score,
      r.id as round_id,
      r.winning_team_id,
      r.spike_planted,
      s.team_a_id,
      s.team_b_id
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    WHERE g.series_id = p_series_id
  ),
  first_bloods AS (
    SELECT
      gr.game_id,
      gr.round_id,
      prs.team_id as fb_team_id,
      gr.winning_team_id
    FROM game_rounds gr
    JOIN public.player_round_stats prs ON prs.round_id = gr.round_id AND prs.first_kill = TRUE
  ),
  trades AS (
    SELECT
      gr.game_id,
      prs.player_id,
      prs.traded,
      prs.deaths
    FROM game_rounds gr
    JOIN public.player_round_stats prs ON prs.round_id = gr.round_id
    WHERE prs.team_id = p_team_id AND prs.deaths > 0
  ),
  post_plants AS (
    SELECT
      gr.game_id,
      gr.round_id,
      gr.winning_team_id,
      gr.spike_planted
    FROM game_rounds gr
    WHERE gr.spike_planted = TRUE
  )
  SELECT
    g.id::TEXT as game_id,
    g.map_name::TEXT,
    g.team_a_score::INTEGER,
    g.team_b_score::INTEGER,
    s.team_a_id::TEXT,
    s.team_b_id::TEXT,
    COALESCE((
      SELECT COUNT(*) FILTER (WHERE fb.fb_team_id = p_team_id)::float /
             NULLIF(COUNT(*)::float, 0)
      FROM first_bloods fb WHERE fb.game_id = g.id
    ), 0)::FLOAT as fb_win_rate,
    COALESCE((
      SELECT COUNT(*) FILTER (WHERE fb.fb_team_id = p_team_id AND fb.winning_team_id = p_team_id)::float /
             NULLIF(COUNT(*) FILTER (WHERE fb.fb_team_id = p_team_id)::float, 0)
      FROM first_bloods fb WHERE fb.game_id = g.id
    ), 0)::FLOAT as fb_conversion_rate,
    COALESCE((
      SELECT COUNT(*) FILTER (WHERE t.traded = TRUE)::float /
             NULLIF(COUNT(*)::float, 0)
      FROM trades t WHERE t.game_id = g.id
    ), 0)::FLOAT as trade_rate,
    COALESCE((
      SELECT COUNT(*) FILTER (WHERE t.traded = FALSE)
      FROM trades t WHERE t.game_id = g.id
    ), 0)::BIGINT as untraded_deaths,
    COALESCE((
      SELECT COUNT(*) FILTER (WHERE pp.winning_team_id = p_team_id)::float /
             NULLIF(COUNT(*)::float, 0)
      FROM post_plants pp WHERE pp.game_id = g.id
    ), 0)::FLOAT as post_plant_win_rate
  FROM public.games g
  JOIN public.series s ON g.series_id = s.id
  WHERE g.series_id = p_series_id
  ORDER BY g.sequence_number;
END;
$$ LANGUAGE plpgsql STABLE;

-- COACH-04: Player Opening Duels
CREATE OR REPLACE FUNCTION query_player_opening_duels(
  p_series_id TEXT,
  p_team_id TEXT
)
RETURNS TABLE (
  player_id TEXT,
  player_name TEXT,
  first_kills INTEGER,
  first_deaths INTEGER,
  net INTEGER,
  total_rounds BIGINT,
  fk_conversion_rate FLOAT,
  fd_loss_rate FLOAT
) AS $$
BEGIN
  RETURN QUERY
  WITH player_duels AS (
    SELECT
      prs.player_id,
      p.name as player_name,
      SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::INTEGER as first_kills,
      SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::INTEGER as first_deaths,
      COUNT(*)::BIGINT as total_rounds,
      -- FK conversion: rounds won when got FK
      SUM(CASE WHEN prs.first_kill = TRUE AND r.winning_team_id = p_team_id THEN 1 ELSE 0 END)::INTEGER as fk_wins,
      -- FD loss: rounds lost when got FD
      SUM(CASE WHEN prs.first_death = TRUE AND r.winning_team_id != p_team_id THEN 1 ELSE 0 END)::INTEGER as fd_losses
    FROM public.player_round_stats prs
    JOIN public.players p ON prs.player_id = p.id
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE g.series_id = p_series_id
      AND prs.team_id = p_team_id
    GROUP BY prs.player_id, p.name
  )
  SELECT
    pd.player_id::TEXT,
    pd.player_name::TEXT,
    pd.first_kills,
    pd.first_deaths,
    (pd.first_kills - pd.first_deaths)::INTEGER as net,
    pd.total_rounds,
    CASE WHEN pd.first_kills > 0 THEN pd.fk_wins::float / pd.first_kills ELSE 0 END::FLOAT as fk_conversion_rate,
    CASE WHEN pd.first_deaths > 0 THEN pd.fd_losses::float / pd.first_deaths ELSE 0 END::FLOAT as fd_loss_rate
  FROM player_duels pd
  ORDER BY net DESC, first_kills DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- COACH-05: Rounds for Review
CREATE OR REPLACE FUNCTION query_rounds_for_review(
  p_series_id TEXT,
  p_team_id TEXT
)
RETURNS TABLE (
  round_id TEXT,
  game_id TEXT,
  map_name TEXT,
  sequence_number INTEGER,
  round_number INTEGER,
  winning_team_id TEXT,
  winning_condition TEXT,
  spike_planted BOOLEAN,
  team_a_alive INTEGER,
  team_b_alive INTEGER,
  duration_ms BIGINT,
  team_a_id TEXT,
  team_b_id TEXT,
  team_a_score_before BIGINT,
  team_b_score_before BIGINT,
  fb_player_id TEXT,
  fb_player_name TEXT,
  fb_team_id TEXT,
  fb_time_ms BIGINT,
  untraded_deaths BIGINT,
  multi_kills JSONB,
  clutches JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH round_data AS (
    SELECT
      r.id as round_id,
      r.game_id,
      g.map_name,
      g.sequence_number,
      r.round_number,
      r.winning_team_id,
      r.winning_condition,
      r.spike_planted,
      r.team_a_alive,
      r.team_b_alive,
      r.duration_ms,
      s.team_a_id,
      s.team_b_id,
      -- Running scores
      SUM(CASE WHEN r2.winning_team_id = s.team_a_id AND r2.round_number < r.round_number AND r2.game_id = r.game_id THEN 1 ELSE 0 END)::BIGINT as team_a_score_before,
      SUM(CASE WHEN r2.winning_team_id = s.team_b_id AND r2.round_number < r.round_number AND r2.game_id = r.game_id THEN 1 ELSE 0 END)::BIGINT as team_b_score_before
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    LEFT JOIN public.rounds r2 ON r2.game_id = r.game_id
    WHERE g.series_id = p_series_id
    GROUP BY r.id, r.game_id, g.map_name, g.sequence_number, r.round_number, r.winning_team_id, r.winning_condition, r.spike_planted, r.team_a_alive, r.team_b_alive, r.duration_ms, s.team_a_id, s.team_b_id
  ),
  first_bloods AS (
    SELECT
      prs.round_id,
      prs.player_id,
      p.name as player_name,
      prs.team_id,
      ke.game_time_ms
    FROM public.player_round_stats prs
    JOIN public.players p ON prs.player_id = p.id
    LEFT JOIN public.kill_events ke ON ke.round_id = prs.round_id AND ke.is_first_kill = TRUE AND ke.killer_id = prs.player_id
    WHERE prs.first_kill = TRUE
  ),
  untraded AS (
    SELECT
      prs.round_id,
      COUNT(*)::BIGINT as untraded_count
    FROM public.player_round_stats prs
    WHERE prs.team_id = p_team_id
      AND prs.deaths > 0
      AND prs.traded = FALSE
    GROUP BY prs.round_id
  ),
  multi_kills AS (
    SELECT
      prs.round_id,
      jsonb_agg(jsonb_build_object('player_id', prs.player_id, 'player_name', p.name, 'kills', prs.kills)) as mk_data
    FROM public.player_round_stats prs
    JOIN public.players p ON prs.player_id = p.id
    WHERE prs.team_id = p_team_id
      AND prs.kills >= 3
    GROUP BY prs.round_id
  ),
  clutches AS (
    SELECT
      prs.round_id,
      jsonb_agg(jsonb_build_object('player_id', prs.player_id, 'player_name', p.name, 'won', prs.clutch_won)) as clutch_data
    FROM public.player_round_stats prs
    JOIN public.players p ON prs.player_id = p.id
    WHERE prs.team_id = p_team_id
      AND prs.clutch_situation = TRUE
    GROUP BY prs.round_id
  )
  SELECT
    rd.round_id::TEXT,
    rd.game_id::TEXT,
    rd.map_name::TEXT,
    rd.sequence_number::INTEGER,
    rd.round_number::INTEGER,
    rd.winning_team_id::TEXT,
    rd.winning_condition::TEXT,
    rd.spike_planted::BOOLEAN,
    rd.team_a_alive::INTEGER,
    rd.team_b_alive::INTEGER,
    rd.duration_ms::BIGINT,
    rd.team_a_id::TEXT,
    rd.team_b_id::TEXT,
    rd.team_a_score_before,
    rd.team_b_score_before,
    fb.player_id::TEXT as fb_player_id,
    fb.player_name::TEXT as fb_player_name,
    fb.team_id::TEXT as fb_team_id,
    fb.game_time_ms::BIGINT as fb_time_ms,
    COALESCE(ut.untraded_count, 0) as untraded_deaths,
    mk.mk_data as multi_kills,
    c.clutch_data as clutches
  FROM round_data rd
  LEFT JOIN first_bloods fb ON fb.round_id = rd.round_id
  LEFT JOIN untraded ut ON ut.round_id = rd.round_id
  LEFT JOIN multi_kills mk ON mk.round_id = rd.round_id
  LEFT JOIN clutches c ON c.round_id = rd.round_id
  ORDER BY rd.sequence_number, rd.round_number;
END;
$$ LANGUAGE plpgsql STABLE;

-- COACH-06: Find Similar Scenarios
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
  similarity_score FLOAT
) AS $$
DECLARE
  v_has_map_filter BOOLEAN := p_map_name IS NOT NULL;
BEGIN
  -- First try scenario_index table
  RETURN QUERY
  SELECT
    si.round_id::TEXT,
    si.game_id::TEXT,
    si.map_name::TEXT,
    si.round_number::INTEGER,
    si.attacker_alive::INTEGER,
    si.defender_alive::INTEGER,
    si.spike_planted::BOOLEAN,
    si.attacker_won::BOOLEAN,
    (1.0 -
      (ABS(si.attacker_alive - p_attacker_alive) * 0.15) -
      (ABS(si.defender_alive - p_defender_alive) * 0.15) -
      (CASE WHEN si.spike_planted != p_spike_planted THEN 0.3 ELSE 0 END) -
      (CASE WHEN v_has_map_filter AND si.map_name != p_map_name THEN 0.1 ELSE 0 END))::FLOAT as similarity_score
  FROM public.scenario_index si
  WHERE si.attacker_alive BETWEEN p_attacker_alive - 1 AND p_attacker_alive + 1
    AND si.defender_alive BETWEEN p_defender_alive - 1 AND p_defender_alive + 1
    AND (NOT v_has_map_filter OR si.map_name = p_map_name)
  ORDER BY similarity_score DESC
  LIMIT p_limit;

  -- If no results from scenario_index, try rounds table
  IF NOT FOUND THEN
    RETURN QUERY
    WITH round_scenarios AS (
      SELECT
        r.id as round_id,
        r.game_id,
        g.map_name,
        r.round_number,
        s.team_a_id,
        s.team_b_id,
        r.winning_team_id,
        r.spike_planted,
        CASE
          WHEN r.round_number <= 12 THEN COALESCE(r.team_a_alive, 0)
          ELSE COALESCE(r.team_b_alive, 0)
        END as attacker_alive,
        CASE
          WHEN r.round_number <= 12 THEN COALESCE(r.team_b_alive, 0)
          ELSE COALESCE(r.team_a_alive, 0)
        END as defender_alive,
        CASE
          WHEN r.round_number <= 12 THEN r.winning_team_id = s.team_a_id
          ELSE r.winning_team_id = s.team_b_id
        END as attacker_won
      FROM public.rounds r
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE r.team_a_alive IS NOT NULL
        AND r.team_b_alive IS NOT NULL
    )
    SELECT
      rs.round_id::TEXT,
      rs.game_id::TEXT,
      rs.map_name::TEXT,
      rs.round_number::INTEGER,
      rs.attacker_alive::INTEGER,
      rs.defender_alive::INTEGER,
      rs.spike_planted::BOOLEAN,
      rs.attacker_won::BOOLEAN,
      (1.0 -
        (ABS(rs.attacker_alive - p_attacker_alive) * 0.15) -
        (ABS(rs.defender_alive - p_defender_alive) * 0.15) -
        (CASE WHEN rs.spike_planted != p_spike_planted THEN 0.3 ELSE 0 END) -
        (CASE WHEN v_has_map_filter AND rs.map_name != p_map_name THEN 0.1 ELSE 0 END))::FLOAT as similarity_score
    FROM round_scenarios rs
    WHERE rs.attacker_alive BETWEEN p_attacker_alive - 1 AND p_attacker_alive + 1
      AND rs.defender_alive BETWEEN p_defender_alive - 1 AND p_defender_alive + 1
      AND (NOT v_has_map_filter OR rs.map_name = p_map_name)
    ORDER BY similarity_score DESC
    LIMIT p_limit;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- COACH-07: Detect Anti-Strat Signals
CREATE OR REPLACE FUNCTION detect_anti_strat_signals(
  p_series_id TEXT,
  p_team_id TEXT
)
RETURNS TABLE (
  player_id TEXT,
  player_name TEXT,
  map_name TEXT,
  death_count BIGINT,
  avg_death_time FLOAT,
  loss_rate FLOAT
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
  )
  SELECT
    fdr.player_id::TEXT,
    fdr.player_name::TEXT,
    fdr.map_name::TEXT,
    COUNT(*)::BIGINT as death_count,
    AVG(fdr.game_time_ms)::FLOAT as avg_death_time,
    (COUNT(*) FILTER (WHERE fdr.winning_team_id != fdr.team_id)::float / COUNT(*))::FLOAT as loss_rate
  FROM first_death_rounds fdr
  GROUP BY fdr.player_id, fdr.player_name, fdr.map_name
  HAVING COUNT(*) >= 3
  ORDER BY death_count DESC, loss_rate DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- COACH-08: Detect Forced Mistakes
CREATE OR REPLACE FUNCTION detect_forced_mistakes(
  p_series_id TEXT,
  p_team_id TEXT
)
RETURNS TABLE (
  map_name TEXT,
  high_untraded_rounds BIGINT,
  high_untraded_losses BIGINT,
  avg_untraded FLOAT
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
  )
  SELECT
    rt.map_name::TEXT,
    SUM(CASE WHEN rt.untraded_deaths >= 3 THEN 1 ELSE 0 END)::BIGINT as high_untraded_rounds,
    SUM(CASE WHEN rt.untraded_deaths >= 3 AND rt.winning_team_id != p_team_id THEN 1 ELSE 0 END)::BIGINT as high_untraded_losses,
    AVG(rt.untraded_deaths)::FLOAT as avg_untraded
  FROM round_trades rt
  GROUP BY rt.map_name
  HAVING SUM(CASE WHEN rt.untraded_deaths >= 3 THEN 1 ELSE 0 END) > 0
  ORDER BY high_untraded_losses DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION query_series_summary TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_series_maps TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_map_metrics TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_player_opening_duels TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_rounds_for_review TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION find_similar_scenarios TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION detect_anti_strat_signals TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION detect_forced_mistakes TO anon, authenticated, service_role;
