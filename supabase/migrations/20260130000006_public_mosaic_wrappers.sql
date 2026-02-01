-- Public schema wrappers for mosaic analytics functions
-- This allows PostgREST to expose the mosaic functions via the REST API

-- Team Strategies
CREATE OR REPLACE FUNCTION public.get_team_attack_pistol_patterns(
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
  RETURN QUERY SELECT * FROM mosaic.get_team_attack_pistol_patterns(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_team_economy_patterns(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  buy_type TEXT,
  rounds_played BIGINT,
  win_rate NUMERIC,
  avg_loadout_value NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_team_economy_patterns(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_team_site_preferences(
  p_team_id TEXT,
  p_series_ids TEXT[],
  p_map_name TEXT DEFAULT NULL
)
RETURNS TABLE(
  map_name TEXT,
  site TEXT,
  attacks BIGINT,
  preference_pct NUMERIC,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_team_site_preferences(p_team_id, p_series_ids, p_map_name);
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

-- Player Analytics
CREATE OR REPLACE FUNCTION public.get_player_core_stats(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  player_id TEXT,
  matches_played BIGINT,
  kills BIGINT,
  deaths BIGINT,
  assists BIGINT,
  kd_ratio NUMERIC,
  adr NUMERIC,
  acs NUMERIC,
  headshot_pct NUMERIC,
  first_bloods BIGINT,
  first_deaths BIGINT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_player_core_stats(p_player_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_player_agent_pool(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  agent_name TEXT,
  matches_played BIGINT,
  rounds_played BIGINT,
  win_rate NUMERIC,
  kd_ratio NUMERIC,
  acs NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_player_agent_pool(p_player_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_player_first_blood_stats(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  first_bloods BIGINT,
  first_deaths BIGINT,
  fb_success_rate NUMERIC,
  avg_fb_time NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_player_first_blood_stats(p_player_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_player_clutch_stats(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  total_clutches BIGINT,
  clutches_won BIGINT,
  clutch_success_rate NUMERIC,
  one_v_one JSONB,
  one_v_two JSONB,
  one_v_three_plus JSONB
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_player_clutch_stats(p_player_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_player_performance_trend(
  p_player_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  match_date DATE,
  acs NUMERIC,
  kd_ratio NUMERIC,
  adr NUMERIC,
  headshot_pct NUMERIC,
  rolling_avg_acs NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_player_performance_trend(p_player_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_team_players_summary(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS JSONB AS $$
BEGIN
  RETURN mosaic.get_team_players_summary(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

-- Composition Analytics
CREATE OR REPLACE FUNCTION public.get_team_compositions(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  composition JSONB,
  matches_played BIGINT,
  rounds_played BIGINT,
  win_rate NUMERIC,
  most_played_map TEXT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_team_compositions(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_composition_win_rates_by_map(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  composition JSONB,
  map_name TEXT,
  rounds_played BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_composition_win_rates_by_map(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_meta_adaptation_timeline(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  match_date DATE,
  composition JSONB,
  consecutive_uses BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_meta_adaptation_timeline(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_role_distribution(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  role TEXT,
  agent_name TEXT,
  rounds_played BIGINT,
  usage_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_role_distribution(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

-- Map Analytics
CREATE OR REPLACE FUNCTION public.get_map_win_rates(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  map_name TEXT,
  matches_played BIGINT,
  wins BIGINT,
  losses BIGINT,
  win_rate NUMERIC,
  attack_win_rate NUMERIC,
  defense_win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_map_win_rates(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_map_composition_preferences(
  p_team_id TEXT,
  p_series_ids TEXT[],
  p_map_name TEXT
)
RETURNS TABLE(
  composition JSONB,
  rounds_played BIGINT,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_map_composition_preferences(p_team_id, p_series_ids, p_map_name);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_map_site_patterns(
  p_team_id TEXT,
  p_series_ids TEXT[],
  p_map_name TEXT
)
RETURNS TABLE(
  site TEXT,
  attacks BIGINT,
  preference_pct NUMERIC,
  win_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_map_site_patterns(p_team_id, p_series_ids, p_map_name);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_map_pool_analysis(
  p_team_id TEXT,
  p_series_ids TEXT[]
)
RETURNS TABLE(
  map_name TEXT,
  classification TEXT,
  win_rate NUMERIC,
  matches_played BIGINT
) AS $$
BEGIN
  RETURN QUERY SELECT * FROM mosaic.get_map_pool_analysis(p_team_id, p_series_ids);
END;
$$ LANGUAGE plpgsql;
