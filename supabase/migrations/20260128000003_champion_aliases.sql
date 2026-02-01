-- Seed champions table with aliases for name normalization
-- Migration: 20260128000003_champion_aliases.sql
-- Created: 2026-01-29

-- Ensure we're operating in the synapse schema
SET search_path TO synapse, public;

-- Insert champions with alias data
-- This covers the most common picks from professional play

INSERT INTO champions (name, grid_name, riot_id, aliases, primary_roles)
VALUES
  -- Multi-word names
  ('TwistedFate', 'Twisted Fate', 'TwistedFate', ARRAY['TF'], ARRAY['mid']),
  ('MissFortune', 'Miss Fortune', 'MissFortune', ARRAY['MF'], ARRAY['adc']),
  ('DrMundo', 'Dr. Mundo', 'DrMundo', ARRAY['Dr Mundo', 'Mundo'], ARRAY['top', 'jungle']),
  ('LeeSin', 'Lee Sin', 'LeeSin', ARRAY['Lee'], ARRAY['jungle']),
  ('MasterYi', 'Master Yi', 'MasterYi', ARRAY['Yi'], ARRAY['jungle']),
  ('XinZhao', 'Xin Zhao', 'XinZhao', ARRAY['Xin'], ARRAY['jungle']),
  ('AurelionSol', 'Aurelion Sol', 'AurelionSol', ARRAY['Asol', 'ASol'], ARRAY['mid']),
  ('TahmKench', 'Tahm Kench', 'TahmKench', ARRAY['Tahm', 'TK'], ARRAY['support', 'top']),

  -- Apostrophe variations
  ('Wukong', 'Wukong', 'MonkeyKing', ARRAY['MonkeyKing', 'Kong'], ARRAY['top', 'jungle']),
  ('RekSai', 'Rek''Sai', 'RekSai', ARRAY['Reksai'], ARRAY['jungle']),
  ('KhaZix', 'Kha''Zix', 'Khazix', ARRAY['Khazix'], ARRAY['jungle']),
  ('VelKoz', 'Vel''Koz', 'VelKoz', ARRAY['Velkoz'], ARRAY['mid', 'support']),
  ('ChoGath', 'Cho''Gath', 'Chogath', ARRAY['Chogath'], ARRAY['top', 'jungle']),
  ('KogMaw', 'Kog''Maw', 'KogMaw', ARRAY['Kogmaw'], ARRAY['adc']),
  ('KaiSa', 'Kai''Sa', 'Kaisa', ARRAY['Kaisa'], ARRAY['adc']),
  ('BelVeth', 'Bel''Veth', 'Belveth', ARRAY['Belveth'], ARRAY['jungle']),
  ('KSante', 'K''Sante', 'KSante', ARRAY['Ksante'], ARRAY['top']),

  -- Roman numerals
  ('JarvanIV', 'Jarvan IV', 'JarvanIV', ARRAY['Jarvan 4', 'J4', 'Jarvan'], ARRAY['jungle']),

  -- Special cases
  ('Renata', 'Renata Glasc', 'Renata', ARRAY['RenataGlasc'], ARRAY['support']),
  ('Nunu', 'Nunu & Willump', 'Nunu', ARRAY['Nunu and Willump'], ARRAY['jungle']),
  ('Fiddlesticks', 'Fiddlesticks', 'Fiddlesticks', ARRAY['Fiddle'], ARRAY['jungle', 'support']),

  -- Pure ADCs
  ('Jinx', 'Jinx', 'Jinx', ARRAY[]::TEXT[], ARRAY['adc']),
  ('Aphelios', 'Aphelios', 'Aphelios', ARRAY[]::TEXT[], ARRAY['adc']),
  ('Caitlyn', 'Caitlyn', 'Caitlyn', ARRAY['Cait'], ARRAY['adc']),
  ('Ashe', 'Ashe', 'Ashe', ARRAY[]::TEXT[], ARRAY['adc']),
  ('Vayne', 'Vayne', 'Vayne', ARRAY[]::TEXT[], ARRAY['adc']),
  ('Xayah', 'Xayah', 'Xayah', ARRAY[]::TEXT[], ARRAY['adc']),
  ('Ezreal', 'Ezreal', 'Ezreal', ARRAY['Ez'], ARRAY['adc', 'mid']),
  ('Lucian', 'Lucian', 'Lucian', ARRAY[]::TEXT[], ARRAY['adc', 'mid']),
  ('Kalista', 'Kalista', 'Kalista', ARRAY[]::TEXT[], ARRAY['adc']),
  ('Sivir', 'Sivir', 'Sivir', ARRAY[]::TEXT[], ARRAY['adc']),
  ('Zeri', 'Zeri', 'Zeri', ARRAY[]::TEXT[], ARRAY['adc']),
  ('Jhin', 'Jhin', 'Jhin', ARRAY[]::TEXT[], ARRAY['adc']),

  -- Pure Supports
  ('Thresh', 'Thresh', 'Thresh', ARRAY[]::TEXT[], ARRAY['support']),
  ('Nautilus', 'Nautilus', 'Nautilus', ARRAY['Naut'], ARRAY['support', 'top']),
  ('Leona', 'Leona', 'Leona', ARRAY[]::TEXT[], ARRAY['support']),
  ('Alistar', 'Alistar', 'Alistar', ARRAY['Ali'], ARRAY['support']),
  ('Rakan', 'Rakan', 'Rakan', ARRAY[]::TEXT[], ARRAY['support']),
  ('Bard', 'Bard', 'Bard', ARRAY[]::TEXT[], ARRAY['support']),
  ('Braum', 'Braum', 'Braum', ARRAY[]::TEXT[], ARRAY['support']),
  ('Lulu', 'Lulu', 'Lulu', ARRAY[]::TEXT[], ARRAY['support']),
  ('Nami', 'Nami', 'Nami', ARRAY[]::TEXT[], ARRAY['support']),
  ('Janna', 'Janna', 'Janna', ARRAY[]::TEXT[], ARRAY['support']),
  ('Yuumi', 'Yuumi', 'Yuumi', ARRAY[]::TEXT[], ARRAY['support']),
  ('Soraka', 'Soraka', 'Soraka', ARRAY['Raka'], ARRAY['support']),

  -- Pure Mid laners
  ('Azir', 'Azir', 'Azir', ARRAY[]::TEXT[], ARRAY['mid']),
  ('Orianna', 'Orianna', 'Orianna', ARRAY['Ori'], ARRAY['mid']),
  ('Viktor', 'Viktor', 'Viktor', ARRAY[]::TEXT[], ARRAY['mid']),
  ('Corki', 'Corki', 'Corki', ARRAY[]::TEXT[], ARRAY['mid']),
  ('Ahri', 'Ahri', 'Ahri', ARRAY[]::TEXT[], ARRAY['mid']),
  ('LeBlanc', 'LeBlanc', 'LeBlanc', ARRAY['LB'], ARRAY['mid']),
  ('Zoe', 'Zoe', 'Zoe', ARRAY[]::TEXT[], ARRAY['mid']),
  ('Kassadin', 'Kassadin', 'Kassadin', ARRAY['Kass'], ARRAY['mid']),
  ('Akali', 'Akali', 'Akali', ARRAY[]::TEXT[], ARRAY['mid', 'top']),
  ('Sylas', 'Sylas', 'Sylas', ARRAY[]::TEXT[], ARRAY['mid', 'top']),

  -- Pure Junglers
  ('Elise', 'Elise', 'Elise', ARRAY[]::TEXT[], ARRAY['jungle']),
  ('Nidalee', 'Nidalee', 'Nidalee', ARRAY['Nid'], ARRAY['jungle']),
  ('Graves', 'Graves', 'Graves', ARRAY[]::TEXT[], ARRAY['jungle']),
  ('Kindred', 'Kindred', 'Kindred', ARRAY[]::TEXT[], ARRAY['jungle']),
  ('Viego', 'Viego', 'Viego', ARRAY[]::TEXT[], ARRAY['jungle']),
  ('Vi', 'Vi', 'Vi', ARRAY[]::TEXT[], ARRAY['jungle']),
  ('Sejuani', 'Sejuani', 'Sejuani', ARRAY['Sej'], ARRAY['jungle', 'top']),

  -- Pure Top laners
  ('Gnar', 'Gnar', 'Gnar', ARRAY[]::TEXT[], ARRAY['top']),
  ('Jayce', 'Jayce', 'Jayce', ARRAY[]::TEXT[], ARRAY['top', 'mid']),
  ('Renekton', 'Renekton', 'Renekton', ARRAY['Renek'], ARRAY['top']),
  ('Camille', 'Camille', 'Camille', ARRAY[]::TEXT[], ARRAY['top']),
  ('Jax', 'Jax', 'Jax', ARRAY[]::TEXT[], ARRAY['top']),
  ('Fiora', 'Fiora', 'Fiora', ARRAY[]::TEXT[], ARRAY['top']),
  ('Gangplank', 'Gangplank', 'Gangplank', ARRAY['GP'], ARRAY['top']),
  ('Aatrox', 'Aatrox', 'Aatrox', ARRAY[]::TEXT[], ARRAY['top']),
  ('Ornn', 'Ornn', 'Ornn', ARRAY[]::TEXT[], ARRAY['top']),

  -- Flex picks
  ('Swain', 'Swain', 'Swain', ARRAY[]::TEXT[], ARRAY['support', 'mid', 'adc', 'top']),
  ('Seraphine', 'Seraphine', 'Seraphine', ARRAY['Sera'], ARRAY['support', 'mid', 'adc']),
  ('Syndra', 'Syndra', 'Syndra', ARRAY[]::TEXT[], ARRAY['mid', 'support']),
  ('Xerath', 'Xerath', 'Xerath', ARRAY[]::TEXT[], ARRAY['mid', 'support']),
  ('Zyra', 'Zyra', 'Zyra', ARRAY[]::TEXT[], ARRAY['support', 'mid']),
  ('Brand', 'Brand', 'Brand', ARRAY[]::TEXT[], ARRAY['support', 'mid']),
  ('Sett', 'Sett', 'Sett', ARRAY[]::TEXT[], ARRAY['top', 'jungle', 'support']),
  ('Shen', 'Shen', 'Shen', ARRAY[]::TEXT[], ARRAY['top', 'support']),
  ('Poppy', 'Poppy', 'Poppy', ARRAY[]::TEXT[], ARRAY['top', 'jungle', 'support']),
  ('Gragas', 'Gragas', 'Gragas', ARRAY[]::TEXT[], ARRAY['top', 'jungle', 'mid']),
  ('Rumble', 'Rumble', 'Rumble', ARRAY[]::TEXT[], ARRAY['top', 'mid']),
  ('Kennen', 'Kennen', 'Kennen', ARRAY[]::TEXT[], ARRAY['top', 'mid']),
  ('Trundle', 'Trundle', 'Trundle', ARRAY[]::TEXT[], ARRAY['top', 'jungle']),
  ('Nocturne', 'Nocturne', 'Nocturne', ARRAY['Noct'], ARRAY['jungle']),
  ('Taliyah', 'Taliyah', 'Taliyah', ARRAY[]::TEXT[], ARRAY['jungle', 'mid']),
  ('Qiyana', 'Qiyana', 'Qiyana', ARRAY[]::TEXT[], ARRAY['mid', 'jungle']),
  ('Diana', 'Diana', 'Diana', ARRAY[]::TEXT[], ARRAY['jungle', 'mid']),
  ('Tristana', 'Tristana', 'Tristana', ARRAY['Trist'], ARRAY['adc', 'mid']),
  ('Varus', 'Varus', 'Varus', ARRAY[]::TEXT[], ARRAY['adc', 'mid']),
  ('Galio', 'Galio', 'Galio', ARRAY[]::TEXT[], ARRAY['mid', 'top', 'support']),
  ('Pantheon', 'Pantheon', 'Pantheon', ARRAY[]::TEXT[], ARRAY['mid', 'top', 'support']),
  ('Pyke', 'Pyke', 'Pyke', ARRAY[]::TEXT[], ARRAY['support', 'mid'])

ON CONFLICT (name) DO UPDATE SET
  grid_name = EXCLUDED.grid_name,
  riot_id = EXCLUDED.riot_id,
  aliases = EXCLUDED.aliases,
  primary_roles = EXCLUDED.primary_roles;

-- Create index on aliases for faster lookups
CREATE INDEX IF NOT EXISTS idx_champions_aliases ON champions USING GIN (aliases);
