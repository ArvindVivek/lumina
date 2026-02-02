-- Fix ACS calculation to use assists from kill_assists table
-- Issue: player_round_stats.assists is always 0, but kill_assists table has the data

-- =============================================================================
-- Function 1: Fix get_player_core_stats to count assists from kill_assists
-- =============================================================================
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
      SUM(prs.damage_dealt) AS total_damage,
      COUNT(*) FILTER (WHERE prs.first_kill = true) AS first_bloods,
      -- KAST: Kills, Assists, Survived (deaths=0), or Traded
      COUNT(*) FILTER (
        WHERE prs.kills > 0
          OR prs.deaths = 0
          OR prs.traded = true
      ) AS kast_rounds_partial
    FROM public.player_round_stats prs
    JOIN public.players p ON prs.player_id = p.id
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY prs.player_id, p.name
  ),
  -- Count assists from kill_assists table
  assist_counts AS (
    SELECT
      ka.assister_id AS player_id,
      COUNT(*) AS total_assists
    FROM public.kill_assists ka
    JOIN public.rounds r ON ka.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      ka.assister_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY ka.assister_id
  ),
  -- Count rounds with assists for KAST
  rounds_with_assists AS (
    SELECT
      ka.assister_id AS player_id,
      COUNT(DISTINCT ka.round_id) AS assist_rounds
    FROM public.kill_assists ka
    JOIN public.rounds r ON ka.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      ka.assister_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY ka.assister_id
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
      AND g.series_id = ANY(p_series_ids)
    GROUP BY ke.killer_id
  )
  SELECT
    pr.player_id,
    pr.player_name,
    pr.rounds_played,
    -- ACS: Average Combat Score (VALORANT approximate formula)
    -- kills * 150 + damage + assists * 25 + first_bloods * 50
    ROUND(
      (pr.total_kills::NUMERIC * 150 + pr.total_damage::NUMERIC + COALESCE(ac.total_assists, 0)::NUMERIC * 25 + pr.first_bloods::NUMERIC * 50) /
      NULLIF(pr.rounds_played, 0),
      2
    ) AS acs,
    -- K/D Ratio
    ROUND(pr.total_kills::NUMERIC / NULLIF(pr.total_deaths, 0), 2) AS kd_ratio,
    -- ADR: Average Damage per Round
    ROUND(pr.total_damage::NUMERIC / NULLIF(pr.rounds_played, 0), 2) AS adr,
    -- Headshot %
    ROUND(
      COALESCE(hs.headshot_kills, 0)::NUMERIC / NULLIF(hs.total_kills_from_events, 0) * 100,
      2
    ) AS headshot_pct,
    -- KAST % (now includes assist rounds)
    ROUND(
      (pr.kast_rounds_partial + COALESCE(rwa.assist_rounds, 0))::NUMERIC / NULLIF(pr.rounds_played, 0) * 100,
      2
    ) AS kast_pct
  FROM player_rounds pr
  LEFT JOIN assist_counts ac ON pr.player_id = ac.player_id
  LEFT JOIN rounds_with_assists rwa ON pr.player_id = rwa.player_id
  LEFT JOIN headshot_stats hs ON pr.player_id = hs.player_id;
END;
$$;

-- =============================================================================
-- Function 2: Fix get_player_agent_pool to count assists
-- =============================================================================
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
      AND g.series_id = ANY(p_series_ids)
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
      SUM(prs.kills) AS total_kills,
      SUM(prs.damage_dealt) AS total_damage,
      COUNT(*) FILTER (WHERE prs.first_kill = true) AS first_bloods,
      ARRAY_AGG(DISTINCT prs.round_id) AS round_ids
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY prs.agent
  ),
  -- Count assists per agent from kill_assists
  agent_assists AS (
    SELECT
      prs.agent,
      COUNT(ka.id) AS total_assists
    FROM public.player_round_stats prs
    JOIN public.kill_assists ka ON ka.round_id = prs.round_id AND ka.assister_id = prs.player_id
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.player_id = p_player_id
      AND g.series_id = ANY(p_series_ids)
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
    -- ACS with assists from kill_assists table
    ROUND(
      (a.total_kills::NUMERIC * 150 + a.total_damage::NUMERIC + COALESCE(aa.total_assists, 0)::NUMERIC * 25 + a.first_bloods::NUMERIC * 50) /
      NULLIF(a.rounds_played, 0),
      2
    ) AS avg_acs
  FROM agent_stats a
  LEFT JOIN agent_assists aa ON a.agent = aa.agent
  ORDER BY a.games_played DESC;
END;
$$;

-- =============================================================================
-- Function 3: Fix get_team_players_summary to count assists
-- =============================================================================
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
      SUM(prs.kills) AS total_kills,
      SUM(prs.deaths) AS total_deaths,
      SUM(prs.damage_dealt) AS total_damage,
      COUNT(*) FILTER (WHERE prs.first_kill = true) AS first_bloods,
      COUNT(*) FILTER (
        WHERE prs.kills > 0 OR prs.deaths = 0 OR prs.traded = true
      ) AS kast_rounds_partial
    FROM public.player_round_stats prs
    JOIN public.players p ON prs.player_id = p.id
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    WHERE
      prs.team_id = p_team_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY prs.player_id, p.name
  ),
  -- Count assists from kill_assists table
  assist_counts AS (
    SELECT
      ka.assister_id AS player_id,
      COUNT(*) AS total_assists,
      COUNT(DISTINCT ka.round_id) AS assist_rounds
    FROM public.kill_assists ka
    JOIN public.rounds r ON ka.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.player_round_stats prs ON prs.round_id = ka.round_id AND prs.player_id = ka.assister_id
    WHERE
      prs.team_id = p_team_id
      AND g.series_id = ANY(p_series_ids)
    GROUP BY ka.assister_id
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
        AND g.series_id = ANY(p_series_ids)
      GROUP BY prs.player_id, prs.agent
    ) prs
    WHERE rn <= 3
    GROUP BY prs.player_id
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'player_id', ps.player_id,
      'player_name', ps.player_name,
      'acs', ROUND(
        (ps.total_kills::NUMERIC * 150 + ps.total_damage::NUMERIC + COALESCE(ac.total_assists, 0)::NUMERIC * 25 + ps.first_bloods::NUMERIC * 50) /
        NULLIF(ps.rounds_played, 0),
        2
      ),
      'kd_ratio', ROUND(ps.total_kills::NUMERIC / NULLIF(ps.total_deaths, 0), 2),
      'kast_pct', ROUND(
        (ps.kast_rounds_partial + COALESCE(ac.assist_rounds, 0))::NUMERIC / NULLIF(ps.rounds_played, 0) * 100,
        2
      ),
      'assists', COALESCE(ac.total_assists, 0),
      'top_agents', COALESCE(ta.agents, '[]'::jsonb)
    )
    ORDER BY ROUND(
      (ps.total_kills::NUMERIC * 150 + ps.total_damage::NUMERIC + COALESCE(ac.total_assists, 0)::NUMERIC * 25 + ps.first_bloods::NUMERIC * 50) /
      NULLIF(ps.rounds_played, 0),
      2
    ) DESC
  )
  INTO result
  FROM player_stats ps
  LEFT JOIN assist_counts ac ON ps.player_id = ac.player_id
  LEFT JOIN top_agents ta ON ps.player_id = ta.player_id;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- =============================================================================
-- Function 4: Fix get_player_performance_trend to count assists
-- =============================================================================
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
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH series_stats AS (
    SELECT
      s.id AS series_id,
      s.start_time::TIMESTAMP WITH TIME ZONE AS series_date,
      SUM(prs.kills) AS total_kills,
      SUM(prs.damage_dealt) AS total_damage,
      COUNT(*) FILTER (WHERE prs.first_kill = true) AS first_bloods,
      COUNT(DISTINCT prs.round_id) AS rounds_played
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE
      prs.player_id = p_player_id
      AND s.id = ANY(p_series_ids)
    GROUP BY s.id, s.start_time
  ),
  series_assists AS (
    SELECT
      s.id AS series_id,
      COUNT(*) AS total_assists
    FROM public.kill_assists ka
    JOIN public.rounds r ON ka.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE
      ka.assister_id = p_player_id
      AND s.id = ANY(p_series_ids)
    GROUP BY s.id
  ),
  series_performance AS (
    SELECT
      ss.series_id,
      ss.series_date,
      ROUND(
        (ss.total_kills::NUMERIC * 150 + ss.total_damage::NUMERIC + COALESCE(sa.total_assists, 0)::NUMERIC * 25 + ss.first_bloods::NUMERIC * 50) /
        NULLIF(ss.rounds_played, 0),
        2
      ) AS acs
    FROM series_stats ss
    LEFT JOIN series_assists sa ON ss.series_id = sa.series_id
    ORDER BY ss.series_date
  )
  SELECT
    sp.series_id,
    sp.series_date,
    sp.acs,
    ROUND(
      AVG(sp.acs) OVER (
        ORDER BY sp.series_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
      ),
      2
    ) AS acs_moving_avg,
    CASE
      WHEN sp.acs > LAG(sp.acs) OVER (ORDER BY sp.series_date) THEN 'improving'
      WHEN sp.acs < LAG(sp.acs) OVER (ORDER BY sp.series_date) THEN 'declining'
      ELSE 'stable'
    END AS performance_trend
  FROM series_performance sp;
END;
$$;
