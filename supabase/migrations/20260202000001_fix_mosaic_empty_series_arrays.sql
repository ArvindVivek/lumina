-- Fix Mosaic functions to handle empty series_ids arrays
-- Empty array should mean "all series" not "no results"

-- Fix get_team_players_summary to handle empty series array
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
      -- Handle empty array as "all series"
      AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))
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
        -- Handle empty array as "all series"
        AND (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))
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

-- Fix get_team_strategies_summary to handle empty series array
CREATE OR REPLACE FUNCTION mosaic.get_team_strategies_summary(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
  pistol_data JSONB;
  economy_data JSONB;
  site_data JSONB;
BEGIN
  -- Get pistol patterns
  SELECT jsonb_agg(
    jsonb_build_object(
      'pattern_type', pattern_type,
      'occurrences', occurrences,
      'win_rate', win_rate,
      'avg_plant_time', avg_plant_time
    )
  )
  INTO pistol_data
  FROM mosaic.get_team_attack_pistol_patterns(p_team_id, p_series_ids);

  -- Get economy patterns
  SELECT jsonb_agg(
    jsonb_build_object(
      'economy_type', buy_type,
      'occurrences', rounds_played,
      'win_rate', win_rate,
      'avg_loadout_value', avg_loadout_value
    )
  )
  INTO economy_data
  FROM mosaic.get_team_economy_patterns(p_team_id, p_series_ids);

  -- Get site preferences
  SELECT jsonb_agg(
    jsonb_build_object(
      'map_name', map_name,
      'site', site,
      'attacks', attacks,
      'preference_pct', preference_pct,
      'win_rate', win_rate
    )
  )
  INTO site_data
  FROM mosaic.get_team_site_preferences(p_team_id, p_series_ids, NULL);

  -- Build final result
  result := jsonb_build_object(
    'pistol_patterns', COALESCE(pistol_data, '[]'::jsonb),
    'economy_patterns', COALESCE(economy_data, '[]'::jsonb),
    'site_preferences', COALESCE(site_data, '[]'::jsonb)
  );

  RETURN result;
END;
$$;

-- Update public wrapper to match
CREATE OR REPLACE FUNCTION public.get_team_players_summary(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS JSONB AS $$
BEGIN
  RETURN mosaic.get_team_players_summary(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_team_strategies_summary(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS JSONB AS $$
BEGIN
  RETURN mosaic.get_team_strategies_summary(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

-- Refresh permissions
GRANT EXECUTE ON FUNCTION mosaic.get_team_players_summary(TEXT, TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION mosaic.get_team_strategies_summary(TEXT, TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_team_players_summary(TEXT, TEXT[]) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_team_strategies_summary(TEXT, TEXT[]) TO authenticated, anon;

-- Add comment
COMMENT ON FUNCTION mosaic.get_team_players_summary IS 'Returns JSONB summary of all players on a team with core stats and top agents. Empty series_ids array means all series.';
COMMENT ON FUNCTION mosaic.get_team_strategies_summary IS 'Returns JSONB summary of team strategies including pistol, economy, and site preferences. Empty series_ids array means all series.';
