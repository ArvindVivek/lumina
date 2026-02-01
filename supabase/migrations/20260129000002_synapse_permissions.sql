-- Grant permissions on synapse schema
-- Migration: 20260129000002_synapse_permissions.sql
-- Created: 2026-01-29

-- Grant usage on schema to service role
GRANT USAGE ON SCHEMA synapse TO service_role;
GRANT USAGE ON SCHEMA synapse TO anon;
GRANT USAGE ON SCHEMA synapse TO authenticated;

-- Grant all privileges on all tables in synapse schema to service role
GRANT ALL ON ALL TABLES IN SCHEMA synapse TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA synapse TO anon;
GRANT SELECT ON ALL TABLES IN SCHEMA synapse TO authenticated;

-- Grant all privileges on all sequences in synapse schema
GRANT ALL ON ALL SEQUENCES IN SCHEMA synapse TO service_role;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA synapse GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA synapse GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA synapse GRANT SELECT ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA synapse GRANT ALL ON SEQUENCES TO service_role;
