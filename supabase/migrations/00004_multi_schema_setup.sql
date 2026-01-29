-- Migration: Multi-Schema Setup for c9-jetbrains-hackathon
-- Creates isolated schemas for each hackathon project sharing this Supabase instance
-- Projects: lumina (VALORANT coaching), synapse, mosaic, thrifty

-- Create application schemas
CREATE SCHEMA IF NOT EXISTS lumina;
CREATE SCHEMA IF NOT EXISTS synapse;
CREATE SCHEMA IF NOT EXISTS mosaic;
CREATE SCHEMA IF NOT EXISTS thrifty;

-- Grant usage on schemas
GRANT USAGE ON SCHEMA lumina TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA synapse TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA mosaic TO postgres, anon, authenticated, service_role;
GRANT USAGE ON SCHEMA thrifty TO postgres, anon, authenticated, service_role;

-- Move all Lumina tables from public to lumina schema
ALTER TABLE public.ability_events SET SCHEMA lumina;
ALTER TABLE public.games SET SCHEMA lumina;
ALTER TABLE public.kill_assists SET SCHEMA lumina;
ALTER TABLE public.kill_events SET SCHEMA lumina;
ALTER TABLE public.orb_events SET SCHEMA lumina;
ALTER TABLE public.player_round_stats SET SCHEMA lumina;
ALTER TABLE public.players SET SCHEMA lumina;
ALTER TABLE public.rounds SET SCHEMA lumina;
ALTER TABLE public.scenario_index SET SCHEMA lumina;
ALTER TABLE public.series SET SCHEMA lumina;
ALTER TABLE public.spike_events SET SCHEMA lumina;
ALTER TABLE public.teams SET SCHEMA lumina;
ALTER TABLE public.tournaments SET SCHEMA lumina;

-- Note: Sequences are automatically moved with their owning tables

-- Grant default privileges for future tables in each schema
ALTER DEFAULT PRIVILEGES IN SCHEMA lumina GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA lumina GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA lumina GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA lumina GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA synapse GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA synapse GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA mosaic GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA mosaic GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA thrifty GRANT SELECT ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA thrifty GRANT ALL ON TABLES TO service_role;

-- Grant permissions on moved tables
GRANT SELECT ON ALL TABLES IN SCHEMA lumina TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA lumina TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA lumina TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA lumina TO service_role;

-- Update search_path for service role to include lumina by default
-- Note: This sets the default for new database connections
ALTER DATABASE postgres SET search_path TO public, lumina, extensions;

COMMENT ON SCHEMA lumina IS 'Lumina - VALORANT Assistant Coach (Cloud9 x JetBrains Hackathon)';
COMMENT ON SCHEMA synapse IS 'Synapse - (Cloud9 x JetBrains Hackathon)';
COMMENT ON SCHEMA mosaic IS 'Mosaic - (Cloud9 x JetBrains Hackathon)';
COMMENT ON SCHEMA thrifty IS 'Thrifty - (Cloud9 x JetBrains Hackathon)';
