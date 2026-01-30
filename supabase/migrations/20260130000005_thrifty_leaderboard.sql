-- Thrifty leaderboard schema
-- Migration: 20260130000005_thrifty_leaderboard.sql
-- Created: 2026-01-30

-- Create schema (idempotent)
CREATE SCHEMA IF NOT EXISTS thrifty;

-- Create leaderboard table
CREATE TABLE thrifty.leaderboard (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(15) NOT NULL,
  score INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast score ordering (descending for top scores)
CREATE INDEX idx_thrifty_leaderboard_score ON thrifty.leaderboard(score DESC);

-- Enable Row Level Security
ALTER TABLE thrifty.leaderboard ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read leaderboard
CREATE POLICY "Anyone can read leaderboard"
  ON thrifty.leaderboard
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Policy: Anyone can insert scores (anon users allowed)
CREATE POLICY "Anyone can insert scores"
  ON thrifty.leaderboard
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Grant schema usage to roles
GRANT USAGE ON SCHEMA thrifty TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA thrifty TO service_role;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA thrifty TO anon, authenticated;

-- Default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA thrifty
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA thrifty
  GRANT SELECT, INSERT ON TABLES TO anon, authenticated;

-- Enable realtime for live leaderboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE thrifty.leaderboard;
