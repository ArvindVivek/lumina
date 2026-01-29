-- Migration: Shared GRID.gg Data Schema (VALORANT)
-- Central tables for VALORANT data from GRID.gg API
-- Used by lumina and mosaic projects

-- ==========================================
-- SHARED TABLES (public schema)
-- ==========================================

-- Tournaments (VALORANT only for this project)
CREATE TABLE IF NOT EXISTS public.grid_tournaments (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    game TEXT NOT NULL DEFAULT 'valorant',
    region TEXT,
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.grid_tournaments IS 'GRID.gg VALORANT tournament metadata';

-- Teams
CREATE TABLE IF NOT EXISTS public.grid_teams (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT,
    logo_url TEXT,
    region TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.grid_teams IS 'GRID.gg team data';

-- Players
CREATE TABLE IF NOT EXISTS public.grid_players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    team_id TEXT REFERENCES public.grid_teams(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.grid_players IS 'GRID.gg player data';

-- Series (matches/matchups)
CREATE TABLE IF NOT EXISTS public.grid_series (
    id TEXT PRIMARY KEY,
    tournament_id TEXT REFERENCES public.grid_tournaments(id),
    title TEXT,
    start_time TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    team_a_id TEXT REFERENCES public.grid_teams(id),
    team_b_id TEXT REFERENCES public.grid_teams(id),
    winner_team_id TEXT REFERENCES public.grid_teams(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.grid_series IS 'GRID.gg series (match) data';

-- Games (individual maps within series)
CREATE TABLE IF NOT EXISTS public.grid_games (
    id TEXT PRIMARY KEY,
    series_id TEXT REFERENCES public.grid_series(id),
    game_number INTEGER,
    map_name TEXT,
    duration_ms INTEGER,
    team_a_score INTEGER,
    team_b_score INTEGER,
    winner_team_id TEXT REFERENCES public.grid_teams(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.grid_games IS 'Individual games/maps within a series';

-- ==========================================
-- INDEXES
-- ==========================================

CREATE INDEX IF NOT EXISTS idx_grid_tournaments_game ON public.grid_tournaments(game);
CREATE INDEX IF NOT EXISTS idx_grid_series_tournament ON public.grid_series(tournament_id);
CREATE INDEX IF NOT EXISTS idx_grid_series_start ON public.grid_series(start_time);
CREATE INDEX IF NOT EXISTS idx_grid_games_series ON public.grid_games(series_id);
CREATE INDEX IF NOT EXISTS idx_grid_players_team ON public.grid_players(team_id);

-- ==========================================
-- PERMISSIONS
-- ==========================================

GRANT SELECT ON public.grid_tournaments TO anon, authenticated;
GRANT SELECT ON public.grid_teams TO anon, authenticated;
GRANT SELECT ON public.grid_players TO anon, authenticated;
GRANT SELECT ON public.grid_series TO anon, authenticated;
GRANT SELECT ON public.grid_games TO anon, authenticated;

GRANT ALL ON public.grid_tournaments TO service_role;
GRANT ALL ON public.grid_teams TO service_role;
GRANT ALL ON public.grid_players TO service_role;
GRANT ALL ON public.grid_series TO service_role;
GRANT ALL ON public.grid_games TO service_role;
