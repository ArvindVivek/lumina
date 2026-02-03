-- Analytics RPC Functions
-- This migration creates PostgreSQL functions to support analytics queries
-- These replace direct SQL queries from the postgres library

-- ============================================================================
-- PLAYER ANALYTICS (queries.ts)
-- ============================================================================

-- PLAY-01: First Death Impact Analysis
CREATE OR REPLACE FUNCTION query_first_death_impact(
  p_player_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  losses TEXT,
  total TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      SUM(CASE WHEN r.winning_team_id != prs.team_id THEN 1 ELSE 0 END)::TEXT as losses,
      COUNT(*)::TEXT as total
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id
      AND prs.first_death = TRUE
      AND prs.kills = 0
      AND prs.assists = 0
      AND s.tournament_id = p_tournament_id;
  ELSE
    RETURN QUERY
    SELECT
      SUM(CASE WHEN r.winning_team_id != prs.team_id THEN 1 ELSE 0 END)::TEXT as losses,
      COUNT(*)::TEXT as total
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id
      AND prs.first_death = TRUE
      AND prs.kills = 0
      AND prs.assists = 0;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- PLAY-02: Trading Efficiency Metrics
CREATE OR REPLACE FUNCTION query_trading_efficiency(
  p_player_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  traded TEXT,
  total_deaths TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      SUM(CASE WHEN prs.traded = TRUE THEN 1 ELSE 0 END)::TEXT as traded,
      SUM(CASE WHEN prs.deaths > 0 THEN 1 ELSE 0 END)::TEXT as total_deaths
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id
      AND s.tournament_id = p_tournament_id;
  ELSE
    RETURN QUERY
    SELECT
      SUM(CASE WHEN prs.traded = TRUE THEN 1 ELSE 0 END)::TEXT as traded,
      SUM(CASE WHEN prs.deaths > 0 THEN 1 ELSE 0 END)::TEXT as total_deaths
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- PLAY-03: Opening Duel Performance
CREATE OR REPLACE FUNCTION query_opening_duels(
  p_player_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  first_kills TEXT,
  first_deaths TEXT,
  total_rounds TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::TEXT as first_kills,
      SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::TEXT as first_deaths,
      COUNT(*)::TEXT as total_rounds
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id
      AND s.tournament_id = p_tournament_id;
  ELSE
    RETURN QUERY
    SELECT
      SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::TEXT as first_kills,
      SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::TEXT as first_deaths,
      COUNT(*)::TEXT as total_rounds
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- PLAY-04: Clutch Situation Analysis
CREATE OR REPLACE FUNCTION query_clutch_performance(
  p_player_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  clutches_won TEXT,
  clutch_situations TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      SUM(CASE WHEN prs.clutch_won = TRUE THEN 1 ELSE 0 END)::TEXT as clutches_won,
      COUNT(*)::TEXT as clutch_situations
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id
      AND prs.clutch_situation = TRUE
      AND s.tournament_id = p_tournament_id;
  ELSE
    RETURN QUERY
    SELECT
      SUM(CASE WHEN prs.clutch_won = TRUE THEN 1 ELSE 0 END)::TEXT as clutches_won,
      COUNT(*)::TEXT as clutch_situations
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id
      AND prs.clutch_situation = TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- PLAY-05: Agent Performance Comparison
CREATE OR REPLACE FUNCTION query_agent_performance(
  p_player_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  agent TEXT,
  rounds_played TEXT,
  total_kills TEXT,
  total_deaths TEXT,
  first_kills TEXT,
  first_deaths TEXT,
  rounds_won TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      prs.agent,
      COUNT(*)::TEXT as rounds_played,
      SUM(prs.kills)::TEXT as total_kills,
      SUM(prs.deaths)::TEXT as total_deaths,
      SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::TEXT as first_kills,
      SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::TEXT as first_deaths,
      SUM(CASE WHEN r.winning_team_id = prs.team_id THEN 1 ELSE 0 END)::TEXT as rounds_won
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id
      AND s.tournament_id = p_tournament_id
    GROUP BY prs.agent
    ORDER BY COUNT(*) DESC;
  ELSE
    RETURN QUERY
    SELECT
      prs.agent,
      COUNT(*)::TEXT as rounds_played,
      SUM(prs.kills)::TEXT as total_kills,
      SUM(prs.deaths)::TEXT as total_deaths,
      SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::TEXT as first_kills,
      SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::TEXT as first_deaths,
      SUM(CASE WHEN r.winning_team_id = prs.team_id THEN 1 ELSE 0 END)::TEXT as rounds_won
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id
    GROUP BY prs.agent
    ORDER BY COUNT(*) DESC;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- PLAY-06: Multi-Kill Round Tracking
CREATE OR REPLACE FUNCTION query_multi_kill_rounds(
  p_player_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  two_plus_kills TEXT,
  three_plus_kills TEXT,
  four_plus_kills TEXT,
  aces TEXT,
  total_rounds TEXT,
  total_kills TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      SUM(CASE WHEN prs.kills >= 2 THEN 1 ELSE 0 END)::TEXT as two_plus_kills,
      SUM(CASE WHEN prs.kills >= 3 THEN 1 ELSE 0 END)::TEXT as three_plus_kills,
      SUM(CASE WHEN prs.kills >= 4 THEN 1 ELSE 0 END)::TEXT as four_plus_kills,
      SUM(CASE WHEN prs.kills = 5 THEN 1 ELSE 0 END)::TEXT as aces,
      COUNT(*)::TEXT as total_rounds,
      SUM(prs.kills)::TEXT as total_kills
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id
      AND s.tournament_id = p_tournament_id;
  ELSE
    RETURN QUERY
    SELECT
      SUM(CASE WHEN prs.kills >= 2 THEN 1 ELSE 0 END)::TEXT as two_plus_kills,
      SUM(CASE WHEN prs.kills >= 3 THEN 1 ELSE 0 END)::TEXT as three_plus_kills,
      SUM(CASE WHEN prs.kills >= 4 THEN 1 ELSE 0 END)::TEXT as four_plus_kills,
      SUM(CASE WHEN prs.kills = 5 THEN 1 ELSE 0 END)::TEXT as aces,
      COUNT(*)::TEXT as total_rounds,
      SUM(prs.kills)::TEXT as total_kills
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- PLAY-07: Eco Round Performance by Phase
CREATE OR REPLACE FUNCTION query_eco_round_performance(
  p_player_id TEXT,
  p_tournament_id TEXT DEFAULT NULL
)
RETURNS TABLE (
  phase TEXT,
  rounds TEXT,
  total_kills TEXT,
  total_deaths TEXT,
  rounds_won TEXT
) AS $$
BEGIN
  IF p_tournament_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      r.phase,
      COUNT(*)::TEXT as rounds,
      SUM(prs.kills)::TEXT as total_kills,
      SUM(prs.deaths)::TEXT as total_deaths,
      SUM(CASE WHEN r.winning_team_id = prs.team_id THEN 1 ELSE 0 END)::TEXT as rounds_won
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id
      AND r.phase IS NOT NULL
      AND s.tournament_id = p_tournament_id
    GROUP BY r.phase
    ORDER BY r.phase;
  ELSE
    RETURN QUERY
    SELECT
      r.phase,
      COUNT(*)::TEXT as rounds,
      SUM(prs.kills)::TEXT as total_kills,
      SUM(prs.deaths)::TEXT as total_deaths,
      SUM(CASE WHEN r.winning_team_id = prs.team_id THEN 1 ELSE 0 END)::TEXT as rounds_won
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE prs.player_id = p_player_id
      AND r.phase IS NOT NULL
    GROUP BY r.phase
    ORDER BY r.phase;
  END IF;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION query_first_death_impact TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_trading_efficiency TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_opening_duels TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_clutch_performance TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_agent_performance TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_multi_kill_rounds TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION query_eco_round_performance TO anon, authenticated, service_role;
