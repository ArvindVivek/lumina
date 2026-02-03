-- Macro Analytics RPC Functions
-- This migration creates PostgreSQL functions for team-level macro queries

-- ============================================================================
-- MACRO QUERIES (macro-queries.ts)
-- ============================================================================

-- MACRO-01: Pistol Analysis
CREATE OR REPLACE FUNCTION query_pistol_analysis(
  p_team_id TEXT,
  p_tournament_id TEXT DEFAULT NULL,
  p_map_name TEXT DEFAULT NULL
)
RETURNS TABLE (
  pistol_rounds TEXT,
  pistol_wins TEXT,
  bonus_wins TEXT,
  total_bonus_rounds TEXT,
  pistol_win_rate TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    WITH pistol_rounds AS (
      SELECT
        r.id,
        r.round_number,
        r.winning_team_id,
        g.map_name,
        CASE
          WHEN r.round_number IN (1, 13) THEN 'pistol'
          WHEN r.round_number IN (2, 14) THEN 'bonus'
        END as round_type
      FROM public.rounds r
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE (s.team_a_id = p_team_id OR s.team_b_id = p_team_id)
        AND s.tournament_id = p_tournament_id
        AND (p_map_name IS NULL OR g.map_name = p_map_name)
    )
    SELECT
      COUNT(*) FILTER (WHERE round_type = 'pistol')::TEXT as pistol_rounds,
      COUNT(*) FILTER (WHERE round_type = 'pistol' AND winning_team_id = p_team_id)::TEXT as pistol_wins,
      COUNT(*) FILTER (WHERE round_type = 'bonus' AND winning_team_id = p_team_id)::TEXT as bonus_wins,
      COUNT(*) FILTER (WHERE round_type = 'bonus')::TEXT as total_bonus_rounds,
      ROUND(
        CASE
          WHEN COUNT(*) FILTER (WHERE round_type = 'pistol') > 0
          THEN (COUNT(*) FILTER (WHERE round_type = 'pistol' AND winning_team_id = p_team_id)::NUMERIC /
                COUNT(*) FILTER (WHERE round_type = 'pistol')::NUMERIC * 100)
          ELSE 0
        END, 2
      )::TEXT as pistol_win_rate
    FROM pistol_rounds;
  ELSE
    RETURN QUERY
    WITH pistol_rounds AS (
      SELECT
        r.id,
        r.round_number,
        r.winning_team_id,
        g.map_name,
        CASE
          WHEN r.round_number IN (1, 13) THEN 'pistol'
          WHEN r.round_number IN (2, 14) THEN 'bonus'
        END as round_type
      FROM public.rounds r
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE (s.team_a_id = p_team_id OR s.team_b_id = p_team_id)
        AND (p_map_name IS NULL OR g.map_name = p_map_name)
    )
    SELECT
      COUNT(*) FILTER (WHERE round_type = 'pistol')::TEXT as pistol_rounds,
      COUNT(*) FILTER (WHERE round_type = 'pistol' AND winning_team_id = p_team_id)::TEXT as pistol_wins,
      COUNT(*) FILTER (WHERE round_type = 'bonus' AND winning_team_id = p_team_id)::TEXT as bonus_wins,
      COUNT(*) FILTER (WHERE round_type = 'bonus')::TEXT as total_bonus_rounds,
      ROUND(
        CASE
          WHEN COUNT(*) FILTER (WHERE round_type = 'pistol') > 0
          THEN (COUNT(*) FILTER (WHERE round_type = 'pistol' AND winning_team_id = p_team_id)::NUMERIC /
                COUNT(*) FILTER (WHERE round_type = 'pistol')::NUMERIC * 100)
          ELSE 0
        END, 2
      )::TEXT as pistol_win_rate
    FROM pistol_rounds;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- MACRO-02: First Blood Conversion
CREATE OR REPLACE FUNCTION query_first_blood_conversion(
  p_team_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  first_bloods TEXT,
  first_blood_wins TEXT,
  first_blood_conversion_rate TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    WITH first_blood_rounds AS (
      SELECT
        r.id,
        r.winning_team_id,
        prs.team_id as first_blood_team_id
      FROM public.rounds r
      JOIN public.player_round_stats prs ON prs.round_id = r.id AND prs.first_kill = TRUE
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE (s.team_a_id = p_team_id OR s.team_b_id = p_team_id)
        AND s.tournament_id = p_tournament_id
    )
    SELECT
      COUNT(*) FILTER (WHERE first_blood_team_id = p_team_id)::TEXT as first_bloods,
      COUNT(*) FILTER (WHERE first_blood_team_id = p_team_id AND winning_team_id = p_team_id)::TEXT as first_blood_wins,
      ROUND(
        CASE
          WHEN COUNT(*) FILTER (WHERE first_blood_team_id = p_team_id) > 0
          THEN (COUNT(*) FILTER (WHERE first_blood_team_id = p_team_id AND winning_team_id = p_team_id)::NUMERIC /
                COUNT(*) FILTER (WHERE first_blood_team_id = p_team_id)::NUMERIC * 100)
          ELSE 0
        END, 2
      )::TEXT as first_blood_conversion_rate
    FROM first_blood_rounds;
  ELSE
    RETURN QUERY
    WITH first_blood_rounds AS (
      SELECT
        r.id,
        r.winning_team_id,
        prs.team_id as first_blood_team_id
      FROM public.rounds r
      JOIN public.player_round_stats prs ON prs.round_id = r.id AND prs.first_kill = TRUE
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE (s.team_a_id = p_team_id OR s.team_b_id = p_team_id)
    )
    SELECT
      COUNT(*) FILTER (WHERE first_blood_team_id = p_team_id)::TEXT as first_bloods,
      COUNT(*) FILTER (WHERE first_blood_team_id = p_team_id AND winning_team_id = p_team_id)::TEXT as first_blood_wins,
      ROUND(
        CASE
          WHEN COUNT(*) FILTER (WHERE first_blood_team_id = p_team_id) > 0
          THEN (COUNT(*) FILTER (WHERE first_blood_team_id = p_team_id AND winning_team_id = p_team_id)::NUMERIC /
                COUNT(*) FILTER (WHERE first_blood_team_id = p_team_id)::NUMERIC * 100)
          ELSE 0
        END, 2
      )::TEXT as first_blood_conversion_rate
    FROM first_blood_rounds;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- MACRO-03: Trade Discipline
CREATE OR REPLACE FUNCTION query_trade_discipline(
  p_team_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_deaths TEXT,
  traded_deaths TEXT,
  first_deaths TEXT,
  first_deaths_traded TEXT,
  overall_trade_rate TEXT,
  first_death_trade_rate TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    WITH team_deaths AS (
      SELECT
        prs.round_id,
        prs.player_id,
        prs.team_id,
        prs.deaths,
        prs.traded,
        prs.first_death
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.team_id = p_team_id
        AND prs.deaths > 0
        AND s.tournament_id = p_tournament_id
    )
    SELECT
      COUNT(*)::TEXT as total_deaths,
      COUNT(*) FILTER (WHERE traded = TRUE)::TEXT as traded_deaths,
      COUNT(*) FILTER (WHERE first_death = TRUE)::TEXT as first_deaths,
      COUNT(*) FILTER (WHERE first_death = TRUE AND traded = TRUE)::TEXT as first_deaths_traded,
      ROUND(
        CASE
          WHEN COUNT(*) > 0
          THEN (COUNT(*) FILTER (WHERE traded = TRUE)::NUMERIC / COUNT(*)::NUMERIC * 100)
          ELSE 0
        END, 2
      )::TEXT as overall_trade_rate,
      ROUND(
        CASE
          WHEN COUNT(*) FILTER (WHERE first_death = TRUE) > 0
          THEN (COUNT(*) FILTER (WHERE first_death = TRUE AND traded = TRUE)::NUMERIC /
                COUNT(*) FILTER (WHERE first_death = TRUE)::NUMERIC * 100)
          ELSE 0
        END, 2
      )::TEXT as first_death_trade_rate
    FROM team_deaths;
  ELSE
    RETURN QUERY
    WITH team_deaths AS (
      SELECT
        prs.round_id,
        prs.player_id,
        prs.team_id,
        prs.deaths,
        prs.traded,
        prs.first_death
      FROM public.player_round_stats prs
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE prs.team_id = p_team_id
        AND prs.deaths > 0
    )
    SELECT
      COUNT(*)::TEXT as total_deaths,
      COUNT(*) FILTER (WHERE traded = TRUE)::TEXT as traded_deaths,
      COUNT(*) FILTER (WHERE first_death = TRUE)::TEXT as first_deaths,
      COUNT(*) FILTER (WHERE first_death = TRUE AND traded = TRUE)::TEXT as first_deaths_traded,
      ROUND(
        CASE
          WHEN COUNT(*) > 0
          THEN (COUNT(*) FILTER (WHERE traded = TRUE)::NUMERIC / COUNT(*)::NUMERIC * 100)
          ELSE 0
        END, 2
      )::TEXT as overall_trade_rate,
      ROUND(
        CASE
          WHEN COUNT(*) FILTER (WHERE first_death = TRUE) > 0
          THEN (COUNT(*) FILTER (WHERE first_death = TRUE AND traded = TRUE)::NUMERIC /
                COUNT(*) FILTER (WHERE first_death = TRUE)::NUMERIC * 100)
          ELSE 0
        END, 2
      )::TEXT as first_death_trade_rate
    FROM team_deaths;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- MACRO-04: Opening Duels by Player
CREATE OR REPLACE FUNCTION query_opening_duels_by_player(
  p_team_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  player_id TEXT,
  first_kills TEXT,
  first_deaths TEXT,
  total_rounds TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      prs.player_id,
      SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::TEXT as first_kills,
      SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::TEXT as first_deaths,
      COUNT(*)::TEXT as total_rounds
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.team_id = p_team_id
      AND s.tournament_id = p_tournament_id
    GROUP BY prs.player_id
    ORDER BY SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END) DESC;
  ELSE
    RETURN QUERY
    SELECT
      prs.player_id,
      SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::TEXT as first_kills,
      SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::TEXT as first_deaths,
      COUNT(*)::TEXT as total_rounds
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.team_id = p_team_id
    GROUP BY prs.player_id
    ORDER BY SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END) DESC;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- MACRO-05: Economy Management
CREATE OR REPLACE FUNCTION query_economy_management(
  p_team_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  economy_decision TEXT,
  rounds TEXT,
  wins TEXT,
  win_rate TEXT,
  avg_loadout_value TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    WITH round_economy AS (
      SELECT
        r.id,
        r.round_number,
        r.winning_team_id,
        CASE
          WHEN s.team_a_id = p_team_id THEN r.team_a_loadout_value
          ELSE r.team_b_loadout_value
        END as team_loadout_value,
        CASE
          WHEN (CASE WHEN s.team_a_id = p_team_id THEN r.team_a_loadout_value ELSE r.team_b_loadout_value END) >= 20000 THEN 'full_buy'
          WHEN (CASE WHEN s.team_a_id = p_team_id THEN r.team_a_loadout_value ELSE r.team_b_loadout_value END) >= 10000 THEN 'force_buy'
          ELSE 'eco'
        END as economy_decision
      FROM public.rounds r
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE (s.team_a_id = p_team_id OR s.team_b_id = p_team_id)
        AND s.tournament_id = p_tournament_id
    )
    SELECT
      re.economy_decision,
      COUNT(*)::TEXT as rounds,
      COUNT(*) FILTER (WHERE winning_team_id = p_team_id)::TEXT as wins,
      ROUND(
        COUNT(*) FILTER (WHERE winning_team_id = p_team_id)::NUMERIC /
        NULLIF(COUNT(*), 0),
        3
      )::TEXT as win_rate,
      AVG(team_loadout_value)::TEXT as avg_loadout_value
    FROM round_economy re
    GROUP BY re.economy_decision
    ORDER BY re.economy_decision;
  ELSE
    RETURN QUERY
    WITH round_economy AS (
      SELECT
        r.id,
        r.round_number,
        r.winning_team_id,
        CASE
          WHEN s.team_a_id = p_team_id THEN r.team_a_loadout_value
          ELSE r.team_b_loadout_value
        END as team_loadout_value,
        CASE
          WHEN (CASE WHEN s.team_a_id = p_team_id THEN r.team_a_loadout_value ELSE r.team_b_loadout_value END) >= 20000 THEN 'full_buy'
          WHEN (CASE WHEN s.team_a_id = p_team_id THEN r.team_a_loadout_value ELSE r.team_b_loadout_value END) >= 10000 THEN 'force_buy'
          ELSE 'eco'
        END as economy_decision
      FROM public.rounds r
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE (s.team_a_id = p_team_id OR s.team_b_id = p_team_id)
    )
    SELECT
      re.economy_decision,
      COUNT(*)::TEXT as rounds,
      COUNT(*) FILTER (WHERE winning_team_id = p_team_id)::TEXT as wins,
      ROUND(
        COUNT(*) FILTER (WHERE winning_team_id = p_team_id)::NUMERIC /
        NULLIF(COUNT(*), 0),
        3
      )::TEXT as win_rate,
      AVG(team_loadout_value)::TEXT as avg_loadout_value
    FROM round_economy re
    GROUP BY re.economy_decision
    ORDER BY re.economy_decision;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- MACRO-06: Timing Patterns
CREATE OR REPLACE FUNCTION query_timing_patterns(
  p_team_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  avg_round_duration_ms TEXT,
  avg_first_kill_time_ms TEXT,
  rounds_analyzed TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      AVG(r.duration_ms)::TEXT as avg_round_duration_ms,
      (SELECT AVG(ke.game_time_ms)::TEXT
       FROM public.kill_events ke
       WHERE ke.is_first_kill = TRUE
         AND ke.round_id IN (
           SELECT r2.id FROM public.rounds r2
           JOIN public.games g2 ON r2.game_id = g2.id
           JOIN public.series s2 ON g2.series_id = s2.id
           WHERE (s2.team_a_id = p_team_id OR s2.team_b_id = p_team_id)
             AND s2.tournament_id = p_tournament_id
         )
      ) as avg_first_kill_time_ms,
      COUNT(*)::TEXT as rounds_analyzed
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE (s.team_a_id = p_team_id OR s.team_b_id = p_team_id)
      AND s.tournament_id = p_tournament_id;
  ELSE
    RETURN QUERY
    SELECT
      AVG(r.duration_ms)::TEXT as avg_round_duration_ms,
      (SELECT AVG(ke.game_time_ms)::TEXT
       FROM public.kill_events ke
       WHERE ke.is_first_kill = TRUE
         AND ke.round_id IN (
           SELECT r2.id FROM public.rounds r2
           JOIN public.games g2 ON r2.game_id = g2.id
           JOIN public.series s2 ON g2.series_id = s2.id
           WHERE (s2.team_a_id = p_team_id OR s2.team_b_id = p_team_id)
         )
      ) as avg_first_kill_time_ms,
      COUNT(*)::TEXT as rounds_analyzed
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE (s.team_a_id = p_team_id OR s.team_b_id = p_team_id);
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- MACRO-07: Ultimate Economy
CREATE OR REPLACE FUNCTION query_ultimate_economy(
  p_team_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  total_rounds TEXT,
  ultimates_used TEXT,
  usage_rate TEXT,
  rounds_with_ult_available TEXT,
  ult_availability_win_rate TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      COUNT(*)::TEXT as total_rounds,
      SUM(CASE WHEN prs.ultimate_used = TRUE THEN 1 ELSE 0 END)::TEXT as ultimates_used,
      ROUND(
        SUM(CASE WHEN prs.ultimate_used = TRUE THEN 1 ELSE 0 END)::NUMERIC /
        NULLIF(COUNT(*), 0),
        3
      )::TEXT as usage_rate,
      SUM(CASE WHEN prs.ultimate_points >= 7 THEN 1 ELSE 0 END)::TEXT as rounds_with_ult_available,
      ROUND(
        SUM(CASE WHEN prs.ultimate_points >= 7 AND r.winning_team_id = prs.team_id THEN 1 ELSE 0 END)::NUMERIC /
        NULLIF(SUM(CASE WHEN prs.ultimate_points >= 7 THEN 1 ELSE 0 END), 0),
        3
      )::TEXT as ult_availability_win_rate
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.team_id = p_team_id
      AND s.tournament_id = p_tournament_id;
  ELSE
    RETURN QUERY
    SELECT
      COUNT(*)::TEXT as total_rounds,
      SUM(CASE WHEN prs.ultimate_used = TRUE THEN 1 ELSE 0 END)::TEXT as ultimates_used,
      ROUND(
        SUM(CASE WHEN prs.ultimate_used = TRUE THEN 1 ELSE 0 END)::NUMERIC /
        NULLIF(COUNT(*), 0),
        3
      )::TEXT as usage_rate,
      SUM(CASE WHEN prs.ultimate_points >= 7 THEN 1 ELSE 0 END)::TEXT as rounds_with_ult_available,
      ROUND(
        SUM(CASE WHEN prs.ultimate_points >= 7 AND r.winning_team_id = prs.team_id THEN 1 ELSE 0 END)::NUMERIC /
        NULLIF(SUM(CASE WHEN prs.ultimate_points >= 7 THEN 1 ELSE 0 END), 0),
        3
      )::TEXT as ult_availability_win_rate
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.team_id = p_team_id;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION query_pistol_analysis TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_first_blood_conversion TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_trade_discipline TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_opening_duels_by_player TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_economy_management TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_timing_patterns TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_ultimate_economy TO anon, authenticated, service_role;
