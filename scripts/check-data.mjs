import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fbloukfgdjvwzdgrcnzt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibG91a2ZnZGp2d3pkZ3Jjbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2NTA0OCwiZXhwIjoyMDg1MjQxMDQ4fQ.l0ss4VLYgSxoABYqRszr9-w7cSyBHMbBYMo1KfMo5-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🔍 Checking database data...\n');

// Check public schema (VALORANT data from Lumina)
console.log('=== PUBLIC SCHEMA (VALORANT - Lumina) ===');
const tables = ['tournaments', 'teams', 'players', 'series', 'games', 'rounds', 'player_round_stats'];

for (const table of tables) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.log(`❌ ${table}: ERROR - ${error.message}`);
  } else {
    console.log(`✓ ${table}: ${count} rows`);
  }
}

// Check synapse schema (League of Legends data)
console.log('\n=== SYNAPSE SCHEMA (League of Legends) ===');
const synapseTables = ['tournaments', 'teams', 'players', 'series', 'games', 'drafts', 'champion_picks'];

for (const table of synapseTables) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .schema('synapse');

  if (error) {
    console.log(`❌ synapse.${table}: ERROR - ${error.message}`);
  } else {
    console.log(`✓ synapse.${table}: ${count} rows`);
  }
}

// Check mosaic schema (Analytics views)
console.log('\n=== MOSAIC SCHEMA (Analytics) ===');
const mosaicViews = ['team_map_stats', 'player_agent_stats', 'clutch_situations'];

for (const view of mosaicViews) {
  const { count, error } = await supabase
    .from(view)
    .select('*', { count: 'exact', head: true })
    .schema('mosaic');

  if (error) {
    console.log(`❌ mosaic.${view}: ERROR - ${error.message}`);
  } else {
    console.log(`✓ mosaic.${view}: ${count} rows`);
  }
}

// Sample some actual data
console.log('\n=== SAMPLE DATA CHECK ===');

// Check a sample team
const { data: sampleTeams, error: teamsError } = await supabase
  .from('teams')
  .select('id, name')
  .limit(3);

if (teamsError) {
  console.log('❌ Error fetching sample teams:', teamsError.message);
} else {
  console.log(`\nSample teams (${sampleTeams?.length || 0}):`);
  sampleTeams?.forEach(t => console.log(`  - ${t.name} (${t.id})`));
}

// Check a sample series
const { data: sampleSeries, error: seriesError } = await supabase
  .from('series')
  .select('id, tournament_id')
  .limit(3);

if (seriesError) {
  console.log('❌ Error fetching sample series:', seriesError.message);
} else {
  console.log(`\nSample series (${sampleSeries?.length || 0}):`);
  sampleSeries?.forEach(s => console.log(`  - Series ${s.id}`));
}

// Check a sample game
const { data: sampleGames, error: gamesError } = await supabase
  .from('games')
  .select('id, map_name, winner_id')
  .limit(3);

if (gamesError) {
  console.log('❌ Error fetching sample games:', gamesError.message);
} else {
  console.log(`\nSample games (${sampleGames?.length || 0}):`);
  sampleGames?.forEach(g => console.log(`  - Game ${g.id}: ${g.map_name}`));
}

console.log('\n✅ Data check complete!');
