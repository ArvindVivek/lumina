-- Mosaic Schema Fixes: Correct Lumina schema incompatibilities
-- Migration: 20260130000001_mosaic_schema_fixes.sql
-- Fixes: pistol detection, empty array handling, JOIN bug, timestamp column
-- Applied via CREATE OR REPLACE FUNCTION (does not modify existing migrations)
--
-- Issues fixed:
--   1. Pistol round detection: r.phase = 'pistol' (not round_number = 0)
--   2. Empty series_ids: CARDINALITY check for "all series" queries
--   3. JOIN condition: r.game_id = g.id (not r.id = r.game_id)
--   4. Timestamp column: game_time_ms / 1000.0 (not timestamp_seconds)

SET search_path TO mosaic, public;

-- =============================================================================
-- TEAM STRATEGY FUNCTIONS (4 functions)
-- =============================================================================

-- Fix: get_team_attack_pistol_patterns
-- Changes: r.phase = 'pistol', CARDINALITY check, game_time_ms / 1000.0
CREATE OR REPLACE FUNCTION mosaic.get_team_attack_pistol_patterns(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  pattern_type TEXT,
  occurrences BIGINT,
  win_rate NUMERIC,
  avg_plant_time NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH pistol_rounds AS (
    SELECT
      r.id AS round_id,
      r.winning_team_id,
      prs.team_id,
      MIN(se.game_time_ms / 1000.0) AS plant_time  -- FIX: Use game_time_ms instead of timestamp_seconds
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    JOIN public.player_round_stats prs ON r.id = prs.round_id
    LEFT JOIN public.spike_events se ON r.id = se.round_id AND se.event_type = 'plant'
    WHERE r.phase = 'pistol'  -- FIX: Use phase column instead of round_number = 0
      AND prs.team_id = p_team_id
      AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
    GROUP BY r.id, r.winning_team_id, prs.team_id
  )
  SELECT
    CASE
      WHEN plant_time IS NULL THEN 'no_plant'
      WHEN plant_time < 60 THEN 'fast_execute'
      ELSE 'default'
    END AS pattern_type,
    COUNT(*)::BIGINT AS occurrences,
    ROUND(
      COUNT(*) FILTER (WHERE winning_team_id = team_id)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate,
    ROUND(AVG(plant_time), 2) AS avg_plant_time
  FROM pistol_rounds
  GROUP BY pattern_type
  ORDER BY occurrences DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fix: get_team_economy_patterns
-- Changes: CARDINALITY check, correct JOIN condition
CREATE OR REPLACE FUNCTION mosaic.get_team_economy_patterns(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  economy_type TEXT,
  occurrences BIGINT,
  win_rate NUMERIC,
  avg_loadout_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH team_rounds AS (
    SELECT
      r.id AS round_id,
      r.winning_team_id,
      prs.team_id,
      AVG(prs.loadout_value) AS avg_loadout
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id  -- FIX: Correct JOIN (was r.id = r.game_id)
    JOIN public.player_round_stats prs ON r.id = prs.round_id
    WHERE prs.team_id = p_team_id
      AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
    GROUP BY r.id, r.winning_team_id, prs.team_id
  )
  SELECT
    CASE
      WHEN avg_loadout < 5000 THEN 'eco'
      WHEN avg_loadout < 15000 THEN 'half_buy'
      WHEN avg_loadout < 20000 THEN 'force_buy'
      ELSE 'full_buy'
    END AS economy_type,
    COUNT(*)::BIGINT AS occurrences,
    ROUND(
      COUNT(*) FILTER (WHERE winning_team_id = team_id)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate,
    ROUND(AVG(avg_loadout), 2) AS avg_loadout_value
  FROM team_rounds
  GROUP BY economy_type
  ORDER BY occurrences DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fix: get_team_site_preferences
-- Changes: CARDINALITY check
CREATE OR REPLACE FUNCTION mosaic.get_team_site_preferences(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  map_name TEXT,
  site TEXT,
  attacks BIGINT,
  win_rate NUMERIC,
  preference_pct NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH site_plants AS (
    SELECT
      g.map_name,
      se.site,
      r.winning_team_id,
      prs.team_id
    FROM public.spike_events se
    JOIN public.rounds r ON se.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.player_round_stats prs ON r.id = prs.round_id
    WHERE se.event_type = 'plant'
      AND prs.team_id = p_team_id
      AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
  ),
  map_totals AS (
    SELECT
      map_name,
      COUNT(*) AS total_plants
    FROM site_plants
    GROUP BY map_name
  )
  SELECT
    sp.map_name,
    sp.site,
    COUNT(*)::BIGINT AS attacks,
    ROUND(
      COUNT(*) FILTER (WHERE sp.winning_team_id = sp.team_id)::NUMERIC / NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate,
    ROUND(
      COUNT(*)::NUMERIC / NULLIF(mt.total_plants, 0) * 100,
      2
    ) AS preference_pct
  FROM site_plants sp
  JOIN map_totals mt ON sp.map_name = mt.map_name
  GROUP BY sp.map_name, sp.site, mt.total_plants
  ORDER BY sp.map_name, attacks DESC;
END;
$$ LANGUAGE plpgsql STABLE;

-- Fix: get_team_strategies_summary
-- Changes: CARDINALITY check (via calling fixed functions)
CREATE OR REPLACE FUNCTION mosaic.get_team_strategies_summary(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'pistol_patterns', (
      SELECT jsonb_agg(row_to_json(pp))
      FROM mosaic.get_team_attack_pistol_patterns(p_team_id, p_series_ids) pp
    ),
    'economy_patterns', (
      SELECT jsonb_agg(row_to_json(ep))
      FROM mosaic.get_team_economy_patterns(p_team_id, p_series_ids) ep
    ),
    'site_preferences', (
      SELECT jsonb_agg(row_to_json(sp))
      FROM mosaic.get_team_site_preferences(p_team_id, p_series_ids) sp
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- PLAYER ANALYTICS FUNCTIONS (6 functions)
-- =============================================================================

-- Fix: get_player_core_stats
-- Changes: CARDINALITY check on both CTEs
CREATE OR REPLACE FUNCTION mosaic.get_player_core_stats(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  player_id TEXT,
  player_name TEXT,
  rounds_played BIGINT,
  acs NUMERIC(7,2),
  kd_ratio NUMERIC(5,2),
  adr NUMERIC(7,2),
  headshot_pct NUMERIC(5,2),
  kast_pct NUMERIC(5,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH player_rounds AS (
    SELECT
      prs.player_id,
      p.name AS player_name,
      COUNT(DISTINCT prs.round_id) AS rounds_played,
      SUM(prs.kills) AS total_kills,
      SUM(prs.deaths) AS total_deaths,
      SUM(prs.assists) AS total_assists,
      SUM(prs.damage_dealt) AS total_damage,
      COUNT(*) FILTER (
        WHERE prs.kills > 0
          OR prs.assists > 0
          OR prs.deaths = 0
          OR prs.traded = true
      ) AS kast_rounds
    FROM public.player_round_stats prs
    JOIN public.players p ON prs.player_id = p.id
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
    GROUP BY prs.player_id, p.name
  ),
  headshot_stats AS (
    SELECT
      ke.killer_id AS player_id,
      COUNT(*) FILTER (WHERE ke.headshot = true) AS headshot_kills,
      COUNT(*) AS total_kills_from_events
    FROM public.kill_events ke
    JOIN public.rounds r ON ke.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      ke.killer_id = p_player_id
      AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
    GROUP BY ke.killer_id
  )
  SELECT
    pr.player_id,
    pr.player_name,
    pr.rounds_played,
    ROUND(pr.total_damage::NUMERIC / NULLIF(pr.rounds_played, 0), 2) AS acs,
    ROUND(pr.total_kills::NUMERIC / NULLIF(pr.total_deaths, 0), 2) AS kd_ratio,
    ROUND(pr.total_damage::NUMERIC / NULLIF(pr.rounds_played, 0), 2) AS adr,
    ROUND(
      COALESCE(hs.headshot_kills, 0)::NUMERIC / NULLIF(hs.total_kills_from_events, 0) * 100,
      2
    ) AS headshot_pct,
    ROUND(
      pr.kast_rounds::NUMERIC / NULLIF(pr.rounds_played, 0) * 100,
      2
    ) AS kast_pct
  FROM player_rounds pr
  LEFT JOIN headshot_stats hs ON pr.player_id = hs.player_id;
END;
$$;

-- Fix: get_player_agent_pool
-- Changes: CARDINALITY check on both CTEs
CREATE OR REPLACE FUNCTION mosaic.get_player_agent_pool(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  agent TEXT,
  games_played BIGINT,
  rounds_played BIGINT,
  pick_rate NUMERIC(5,2),
  win_rate NUMERIC(5,2),
  avg_acs NUMERIC(7,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH player_total_games AS (
    SELECT COUNT(DISTINCT g.id) AS total_games
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
  ),
  agent_stats AS (
    SELECT
      prs.agent,
      COUNT(DISTINCT g.id) AS games_played,
      COUNT(DISTINCT prs.round_id) AS rounds_played,
      COUNT(DISTINCT r.id) FILTER (
        WHERE r.winning_team_id = prs.team_id
      ) AS rounds_won,
      COUNT(DISTINCT r.id) AS total_rounds,
      SUM(prs.damage_dealt) AS total_damage
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
    GROUP BY prs.agent
  )
  SELECT
    a.agent,
    a.games_played::BIGINT,
    a.rounds_played::BIGINT,
    ROUND(
      a.games_played::NUMERIC / NULLIF((SELECT total_games FROM player_total_games), 0) * 100,
      2
    ) AS pick_rate,
    ROUND(
      a.rounds_won::NUMERIC / NULLIF(a.total_rounds, 0) * 100,
      2
    ) AS win_rate,
    ROUND(
      a.total_damage::NUMERIC / NULLIF(a.rounds_played, 0),
      2
    ) AS avg_acs
  FROM agent_stats a
  ORDER BY a.games_played DESC;
END;
$$;

-- Fix: get_player_first_blood_stats
-- Changes: CARDINALITY check
CREATE OR REPLACE FUNCTION mosaic.get_player_first_blood_stats(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  first_kill_attempts BIGINT,
  first_kills BIGINT,
  first_deaths BIGINT,
  fk_rate NUMERIC(5,2),
  fd_rate NUMERIC(5,2),
  fk_fd_diff NUMERIC(6,2)
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH first_blood_stats AS (
    SELECT
      COUNT(DISTINCT prs.round_id) AS total_rounds,
      COUNT(DISTINCT prs.round_id) FILTER (
        WHERE prs.first_kill = true OR prs.first_death = true
      ) AS first_kill_attempts,
      COUNT(DISTINCT prs.round_id) FILTER (
        WHERE prs.first_kill = true
      ) AS first_kills,
      COUNT(DISTINCT prs.round_id) FILTER (
        WHERE prs.first_death = true
      ) AS first_deaths
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
  )
  SELECT
    fb.first_kill_attempts::BIGINT,
    fb.first_kills::BIGINT,
    fb.first_deaths::BIGINT,
    ROUND(
      fb.first_kills::NUMERIC / NULLIF(fb.first_kill_attempts, 0) * 100,
      2
    ) AS fk_rate,
    ROUND(
      fb.first_deaths::NUMERIC / NULLIF(fb.total_rounds, 0) * 100,
      2
    ) AS fd_rate,
    ROUND(
      (fb.first_kills::NUMERIC / NULLIF(fb.first_kill_attempts, 0) * 100) -
      (fb.first_deaths::NUMERIC / NULLIF(fb.total_rounds, 0) * 100),
      2
    ) AS fk_fd_diff
  FROM first_blood_stats fb;
END;
$$;

-- Fix: get_player_clutch_stats
-- Changes: CARDINALITY check
CREATE OR REPLACE FUNCTION mosaic.get_player_clutch_stats(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  clutch_situations BIGINT,
  clutch_wins BIGINT,
  clutch_win_rate NUMERIC(5,2),
  clutch_1v1_wins BIGINT,
  clutch_1v2_wins BIGINT,
  clutch_1v3_plus_wins BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH clutch_data AS (
    SELECT
      COUNT(*) FILTER (
        WHERE prs.clutch_situation = true
      ) AS clutch_situations,
      COUNT(*) FILTER (
        WHERE prs.clutch_situation = true AND prs.clutch_won = true
      ) AS clutch_wins
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
  )
  SELECT
    cd.clutch_situations::BIGINT,
    cd.clutch_wins::BIGINT,
    ROUND(
      cd.clutch_wins::NUMERIC / NULLIF(cd.clutch_situations, 0) * 100,
      2
    ) AS clutch_win_rate,
    NULL::BIGINT AS clutch_1v1_wins,
    NULL::BIGINT AS clutch_1v2_wins,
    NULL::BIGINT AS clutch_1v3_plus_wins
  FROM clutch_data cd;
END;
$$;

-- Fix: get_player_performance_trend
-- Changes: CARDINALITY check
CREATE OR REPLACE FUNCTION mosaic.get_player_performance_trend(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  series_id TEXT,
  series_date TIMESTAMP WITH TIME ZONE,
  acs NUMERIC(7,2),
  acs_moving_avg NUMERIC(7,2),
  performance_trend TEXT
)
LANGUAGE sql
AS $$
  WITH series_performance AS (
    SELECT
      s.id AS series_id,
      s.start_time::TIMESTAMP WITH TIME ZONE AS series_date,
      ROUND(
        SUM(prs.damage_dealt)::NUMERIC /
        NULLIF(COUNT(DISTINCT prs.round_id), 0),
        2
      ) AS acs
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE
      prs.player_id = p_player_id
      AND (CARDINALITY(p_series_ids) = 0 OR s.id = ANY(p_series_ids))  -- FIX: Handle empty array
    GROUP BY s.id, s.start_time
    ORDER BY s.start_time
  )
  SELECT
    series_id,
    series_date,
    acs,
    ROUND(
      AVG(acs) OVER (
        ORDER BY series_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
      ),
      2
    ) AS acs_moving_avg,
    CASE
      WHEN acs > LAG(acs) OVER (ORDER BY series_date) THEN 'improving'
      WHEN acs < LAG(acs) OVER (ORDER BY series_date) THEN 'declining'
      ELSE 'stable'
    END AS performance_trend
  FROM series_performance;
$$;

-- Fix: get_team_players_summary
-- Changes: CARDINALITY check on both CTEs
CREATE OR REPLACE FUNCTION mosaic.get_team_players_summary(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  WITH player_stats AS (
    SELECT
      prs.player_id,
      p.name AS player_name,
      COUNT(DISTINCT prs.round_id) AS rounds_played,
      ROUND(
        SUM(prs.damage_dealt)::NUMERIC / NULLIF(COUNT(DISTINCT prs.round_id), 0),
        2
      ) AS acs,
      ROUND(
        SUM(prs.kills)::NUMERIC / NULLIF(SUM(prs.deaths), 0),
        2
      ) AS kd_ratio,
      ROUND(
        COUNT(*) FILTER (
          WHERE prs.kills > 0 OR prs.assists > 0 OR prs.deaths = 0 OR prs.traded = true
        )::NUMERIC / NULLIF(COUNT(*), 0) * 100,
        2
      ) AS kast_pct
    FROM public.player_round_stats prs
    JOIN public.players p ON prs.player_id = p.id
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.team_id = p_team_id
      AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
    GROUP BY prs.player_id, p.name
  ),
  top_agents AS (
    SELECT
      prs.player_id,
      jsonb_agg(prs.agent ORDER BY game_count DESC) AS agents
    FROM (
      SELECT
        prs.player_id,
        prs.agent,
        COUNT(DISTINCT g.id) AS game_count,
        ROW_NUMBER() OVER (PARTITION BY prs.player_id ORDER BY COUNT(DISTINCT g.id) DESC) AS rn
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      WHERE
        prs.team_id = p_team_id
        AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
      GROUP BY prs.player_id, prs.agent
    ) prs
    WHERE rn <= 3
    GROUP BY prs.player_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'player_id', ps.player_id,
      'player_name', ps.player_name,
      'acs', ps.acs,
      'kd_ratio', ps.kd_ratio,
      'kast_pct', ps.kast_pct,
      'top_agents', COALESCE(ta.agents, '[]'::jsonb)
    )
    ORDER BY ps.acs DESC
  )
  INTO result
  FROM player_stats ps
  LEFT JOIN top_agents ta ON ps.player_id = ta.player_id;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- =============================================================================
-- COMPOSITION AND MAP ANALYTICS FUNCTIONS (8 functions)
-- =============================================================================

-- Fix: get_team_compositions
-- Changes: CARDINALITY check
-- Note: r.round_number = 0 is CORRECT here (starting composition of each game)
CREATE OR REPLACE FUNCTION mosaic.get_team_compositions(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  composition JSONB,
  games_played BIGINT,
  win_count BIGINT,
  win_rate NUMERIC,
  maps_played TEXT[]
)
LANGUAGE sql
STABLE
AS $$
  WITH game_compositions AS (
    SELECT
      g.id AS game_id,
      g.map_name,
      g.winner_id,
      jsonb_agg(DISTINCT prs.agent ORDER BY prs.agent) AS composition
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
      AND prs.team_id = p_team_id
      AND r.round_number = 0
    GROUP BY g.id, g.map_name, g.winner_id
  )
  SELECT
    composition,
    COUNT(*)::BIGINT AS games_played,
    COUNT(*) FILTER (WHERE winner_id = p_team_id)::BIGINT AS win_count,
    ROUND(
      COUNT(*) FILTER (WHERE winner_id = p_team_id)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate,
    ARRAY_AGG(DISTINCT map_name ORDER BY map_name) AS maps_played
  FROM game_compositions
  GROUP BY composition
  ORDER BY games_played DESC;
$$;

-- Fix: get_composition_win_rates_by_map
-- Changes: CARDINALITY check
CREATE OR REPLACE FUNCTION mosaic.get_composition_win_rates_by_map(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  composition JSONB,
  map_name TEXT,
  games BIGINT,
  wins BIGINT,
  win_rate NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH game_compositions AS (
    SELECT
      g.id AS game_id,
      g.map_name,
      g.winner_id,
      jsonb_agg(DISTINCT prs.agent ORDER BY prs.agent) AS composition
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
      AND prs.team_id = p_team_id
      AND r.round_number = 0
    GROUP BY g.id, g.map_name, g.winner_id
  )
  SELECT
    composition,
    map_name,
    COUNT(*)::BIGINT AS games,
    COUNT(*) FILTER (WHERE winner_id = p_team_id)::BIGINT AS wins,
    ROUND(
      COUNT(*) FILTER (WHERE winner_id = p_team_id)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate
  FROM game_compositions
  GROUP BY composition, map_name
  ORDER BY map_name, games DESC;
$$;

-- Fix: get_meta_adaptation_timeline
-- Changes: CARDINALITY check
CREATE OR REPLACE FUNCTION mosaic.get_meta_adaptation_timeline(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  series_date TEXT,
  series_id TEXT,
  composition JSONB,
  is_new_comp BOOLEAN,
  consecutive_uses BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH series_compositions AS (
    SELECT
      s.id AS series_id,
      s.start_time::TEXT AS series_date,
      jsonb_agg(DISTINCT prs.agent ORDER BY prs.agent) AS composition
    FROM public.series s
    JOIN public.games g ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR s.id = ANY(p_series_ids))  -- FIX: Handle empty array
      AND prs.team_id = p_team_id
      AND r.round_number = 0
    GROUP BY s.id, s.start_time
    ORDER BY s.start_time
  )
  SELECT
    series_date,
    series_id,
    composition,
    (composition IS DISTINCT FROM LAG(composition) OVER (ORDER BY series_date)) AS is_new_comp,
    COUNT(*) OVER (
      PARTITION BY composition
      ORDER BY series_date
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS consecutive_uses
  FROM series_compositions
  ORDER BY series_date;
$$;

-- Fix: get_role_distribution
-- Changes: CARDINALITY check
CREATE OR REPLACE FUNCTION mosaic.get_role_distribution(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  game_id TEXT,
  map_name TEXT,
  duelist_count BIGINT,
  controller_count BIGINT,
  initiator_count BIGINT,
  sentinel_count BIGINT
)
LANGUAGE sql
STABLE
AS $$
  WITH game_agents AS (
    SELECT
      g.id AS game_id,
      g.map_name,
      prs.agent,
      CASE
        WHEN prs.agent IN ('Jett', 'Reyna', 'Phoenix', 'Raze', 'Yoru', 'Neon', 'Iso') THEN 'duelist'
        WHEN prs.agent IN ('Brimstone', 'Viper', 'Omen', 'Astra', 'Harbor', 'Clove') THEN 'controller'
        WHEN prs.agent IN ('Sova', 'Breach', 'Skye', 'KAY/O', 'Fade', 'Gekko') THEN 'initiator'
        WHEN prs.agent IN ('Sage', 'Cypher', 'Killjoy', 'Chamber', 'Deadlock', 'Vyse') THEN 'sentinel'
        ELSE 'unknown'
      END AS role
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
      AND prs.team_id = p_team_id
      AND r.round_number = 0
    GROUP BY g.id, g.map_name, prs.agent
  )
  SELECT
    game_id,
    map_name,
    COUNT(*) FILTER (WHERE role = 'duelist')::BIGINT AS duelist_count,
    COUNT(*) FILTER (WHERE role = 'controller')::BIGINT AS controller_count,
    COUNT(*) FILTER (WHERE role = 'initiator')::BIGINT AS initiator_count,
    COUNT(*) FILTER (WHERE role = 'sentinel')::BIGINT AS sentinel_count
  FROM game_agents
  GROUP BY game_id, map_name
  ORDER BY game_id;
$$;

-- Fix: get_map_win_rates
-- Changes: CARDINALITY check
CREATE OR REPLACE FUNCTION mosaic.get_map_win_rates(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  map_name TEXT,
  games_played BIGINT,
  wins BIGINT,
  losses BIGINT,
  win_rate NUMERIC,
  avg_rounds_won NUMERIC,
  avg_rounds_lost NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH team_games AS (
    SELECT
      g.map_name,
      g.winner_id,
      CASE
        WHEN s.team_a_id = p_team_id THEN g.team_a_score
        WHEN s.team_b_id = p_team_id THEN g.team_b_score
        ELSE NULL
      END AS team_rounds_won,
      CASE
        WHEN s.team_a_id = p_team_id THEN g.team_b_score
        WHEN s.team_b_id = p_team_id THEN g.team_a_score
        ELSE NULL
      END AS team_rounds_lost
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
      AND (s.team_a_id = p_team_id OR s.team_b_id = p_team_id)
  )
  SELECT
    map_name,
    COUNT(*)::BIGINT AS games_played,
    COUNT(*) FILTER (WHERE winner_id = p_team_id)::BIGINT AS wins,
    COUNT(*) FILTER (WHERE winner_id != p_team_id)::BIGINT AS losses,
    ROUND(
      COUNT(*) FILTER (WHERE winner_id = p_team_id)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate,
    ROUND(AVG(team_rounds_won), 2) AS avg_rounds_won,
    ROUND(AVG(team_rounds_lost), 2) AS avg_rounds_lost
  FROM team_games
  GROUP BY map_name
  ORDER BY win_rate DESC NULLS LAST, games_played DESC;
$$;

-- Fix: get_map_composition_preferences
-- Changes: CARDINALITY check
CREATE OR REPLACE FUNCTION mosaic.get_map_composition_preferences(
  p_team_id TEXT,
  p_series_ids TEXT[],
  p_map_name TEXT
)
RETURNS TABLE(
  composition JSONB,
  times_used BIGINT,
  win_rate NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH map_game_compositions AS (
    SELECT
      g.id AS game_id,
      g.winner_id,
      jsonb_agg(DISTINCT prs.agent ORDER BY prs.agent) AS composition
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    JOIN public.rounds r ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = r.id
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
      AND g.map_name = p_map_name
      AND prs.team_id = p_team_id
      AND r.round_number = 0
    GROUP BY g.id, g.winner_id
  )
  SELECT
    composition,
    COUNT(*)::BIGINT AS times_used,
    ROUND(
      COUNT(*) FILTER (WHERE winner_id = p_team_id)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS win_rate
  FROM map_game_compositions
  GROUP BY composition
  ORDER BY times_used DESC;
$$;

-- Fix: get_map_site_patterns
-- Changes: CARDINALITY check
CREATE OR REPLACE FUNCTION mosaic.get_map_site_patterns(
  p_team_id TEXT,
  p_series_ids TEXT[],
  p_map_name TEXT
)
RETURNS TABLE(
  site TEXT,
  attack_count BIGINT,
  attack_pct NUMERIC,
  success_rate NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH attacking_rounds AS (
    SELECT
      r.id AS round_id,
      r.winning_team_id,
      CASE
        WHEN r.round_number < 12 AND s.team_a_id = p_team_id THEN TRUE
        WHEN r.round_number >= 12 AND s.team_b_id = p_team_id THEN TRUE
        ELSE FALSE
      END AS is_attacking,
      CASE
        WHEN r.round_number < 12 THEN s.team_a_id
        ELSE s.team_b_id
      END AS attacking_team_id
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
      AND g.map_name = p_map_name
  ),
  site_plants AS (
    SELECT
      ar.round_id,
      ar.winning_team_id,
      ar.attacking_team_id,
      se.site
    FROM attacking_rounds ar
    JOIN public.spike_events se ON se.round_id = ar.round_id
    WHERE
      ar.is_attacking = TRUE
      AND se.event_type = 'plant'
  )
  SELECT
    COALESCE(site, 'Unknown') AS site,
    COUNT(*)::BIGINT AS attack_count,
    ROUND(
      COUNT(*)::NUMERIC / NULLIF(SUM(COUNT(*)) OVER (), 0) * 100,
      2
    ) AS attack_pct,
    ROUND(
      COUNT(*) FILTER (WHERE winning_team_id = attacking_team_id)::NUMERIC /
      NULLIF(COUNT(*), 0) * 100,
      2
    ) AS success_rate
  FROM site_plants
  GROUP BY site
  ORDER BY attack_count DESC;
$$;

-- Fix: get_map_pool_analysis
-- Changes: CARDINALITY check
CREATE OR REPLACE FUNCTION mosaic.get_map_pool_analysis(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  WITH map_stats AS (
    SELECT
      g.map_name,
      ROUND(
        COUNT(*) FILTER (WHERE g.winner_id = p_team_id)::NUMERIC /
        NULLIF(COUNT(*), 0) * 100,
        2
      ) AS win_rate
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    WHERE
      (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))  -- FIX: Handle empty array
      AND (s.team_a_id = p_team_id OR s.team_b_id = p_team_id)
    GROUP BY g.map_name
  )
  SELECT jsonb_build_object(
    'strengths', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('map', map_name, 'win_rate', win_rate) ORDER BY win_rate DESC), '[]'::jsonb)
      FROM map_stats
      WHERE win_rate > 60
    ),
    'weaknesses', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('map', map_name, 'win_rate', win_rate) ORDER BY win_rate ASC), '[]'::jsonb)
      FROM map_stats
      WHERE win_rate < 40
    ),
    'neutral', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('map', map_name, 'win_rate', win_rate) ORDER BY map_name), '[]'::jsonb)
      FROM map_stats
      WHERE win_rate >= 40 AND win_rate <= 60
    )
  );
$$;

-- =============================================================================
-- GRANT EXECUTE PERMISSIONS
-- =============================================================================

-- Re-grant execute permissions (same as original migrations)
GRANT EXECUTE ON FUNCTION mosaic.get_team_attack_pistol_patterns TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_team_economy_patterns TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_team_site_preferences TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_team_strategies_summary TO authenticated, anon;

GRANT EXECUTE ON FUNCTION mosaic.get_player_core_stats TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_player_agent_pool TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_player_first_blood_stats TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_player_clutch_stats TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_player_performance_trend TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_team_players_summary TO authenticated, anon;

GRANT EXECUTE ON FUNCTION mosaic.get_team_compositions TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_composition_win_rates_by_map TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_meta_adaptation_timeline TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_role_distribution TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_map_win_rates TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_map_composition_preferences TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_map_site_patterns TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_map_pool_analysis TO authenticated, anon;

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================
-- Summary: Fixed all 18 Mosaic analytics functions to work with Lumina schema
--
-- Issues resolved:
--   ✓ Pistol round detection: r.phase = 'pistol' (1 function affected)
--   ✓ Empty series_ids handling: CARDINALITY check added (18 functions affected)
--   ✓ Wrong JOIN: r.game_id = g.id (1 function affected)
--   ✓ Timestamp column: game_time_ms / 1000.0 (1 function affected)
--
-- All functions tested with actual Lumina database schema.
-- Apply with: supabase migration up
