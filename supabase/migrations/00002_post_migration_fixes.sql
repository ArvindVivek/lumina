-- Post-migration type fixes for SQLite -> PostgreSQL
-- Boolean columns were already converted correctly by pgloader
-- This migration handles timestamp columns (were TEXT in SQLite)

-- tournaments table
ALTER TABLE tournaments ALTER COLUMN start_date TYPE TIMESTAMPTZ USING start_date::timestamptz;
ALTER TABLE tournaments ALTER COLUMN end_date TYPE TIMESTAMPTZ USING end_date::timestamptz;
ALTER TABLE tournaments ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

-- teams table
ALTER TABLE teams ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

-- players table
ALTER TABLE players ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

-- series table
ALTER TABLE series ALTER COLUMN start_time TYPE TIMESTAMPTZ USING start_time::timestamptz;
ALTER TABLE series ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

-- games table
ALTER TABLE games ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

-- rounds table
ALTER TABLE rounds ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

-- player_round_stats table
ALTER TABLE player_round_stats ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

-- kill_events table
ALTER TABLE kill_events ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

-- spike_events table
ALTER TABLE spike_events ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

-- orb_events table
ALTER TABLE orb_events ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

-- ability_events table
ALTER TABLE ability_events ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

-- kill_assists table
ALTER TABLE kill_assists ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;

-- scenario_index table
ALTER TABLE scenario_index ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at::timestamptz;
