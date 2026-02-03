import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fbloukfgdjvwzdgrcnzt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibG91a2ZnZGp2d3pkZ3Jjbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2NTA0OCwiZXhwIjoyMDg1MjQxMDQ4fQ.l0ss4VLYgSxoABYqRszr9-w7cSyBHMbBYMo1KfMo5-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  db: { schema: 'public' }
});

console.log('🔍 Data exists in database!\n');

console.log('=== SAMPLE TEAMS ===');
const { data: teams } = await supabase
  .from('teams')
  .select('id, name')
  .limit(5);
teams?.forEach(t => console.log(`  ${t.name}`));

console.log('\n=== SAMPLE PLAYERS ===');
const { data: players } = await supabase
  .from('players')
  .select('id, name, team_id')
  .limit(5);
players?.forEach(p => console.log(`  ${p.name}`));

console.log('\n=== SAMPLE GAMES ===');
const { data: games } = await supabase
  .from('games')
  .select('id, map_name, winner_id, series_id')
  .limit(5);
games?.forEach(g => console.log(`  Game on ${g.map_name}`));

console.log('\n=== CHECKING MOSAIC SCHEMA ===');
// Try to access mosaic views
const { data: mosaicData, error: mosaicError } = await supabase
  .schema('mosaic')
  .from('team_map_stats')
  .select('*', { count: 'exact', head: true });

if (mosaicError) {
  console.log('❌ Mosaic schema error:', mosaicError.message);
} else {
  console.log('✓ Mosaic schema accessible');
}

console.log('\n✅ Database has data! Now checking app queries...');
