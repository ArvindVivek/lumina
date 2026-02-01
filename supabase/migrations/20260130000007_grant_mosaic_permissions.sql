-- Grant permissions for public schema wrappers to access mosaic schema functions
-- This allows PostgREST to execute mosaic analytics functions via public wrappers

-- Grant schema usage to all roles
GRANT USAGE ON SCHEMA mosaic TO anon, authenticated, service_role;

-- Grant execute permissions on all mosaic functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA mosaic TO anon, authenticated, service_role;

-- Ensure future functions in mosaic schema are also granted permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA mosaic GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
