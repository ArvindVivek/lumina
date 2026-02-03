import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fbloukfgdjvwzdgrcnzt.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibG91a2ZnZGp2d3pkZ3Jjbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2NTA0OCwiZXhwIjoyMDg1MjQxMDQ4fQ.l0ss4VLYgSxoABYqRszr9-w7cSyBHMbBYMo1KfMo5-8';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

console.log('🔍 Checking mosaic schema materialized views...\n');

// Try querying mosaic views using RPC
const { data: mosaicData, error: mosaicError } = await supabase.rpc('get_team_map_stats');

if (mosaicError) {
  console.log('Error accessing mosaic via RPC:', mosaicError.message);
  console.log('\nTrying direct query...');

  // Try a raw query to see if we can access the schema
  const { data, error } = await supabase
    .from('player_round_stats')
    .select('player_id, player_name, acs')
    .limit(5);

  if (error) {
    console.log('❌ Error querying player_round_stats:', error.message);
  } else {
    console.log('✓ Successfully queried player_round_stats');
    console.log('Sample data:', data);
  }
} else {
  console.log('✓ Mosaic RPC working');
  console.log('Data:', mosaicData);
}

// Check if materialized views need refreshing
console.log('\n🔄 Checking if views need refresh...');
const { error: refreshError } = await supabase.rpc('refresh_all_mosaic_views');

if (refreshError) {
  console.log('❌ Error refreshing views:', refreshError.message);
} else {
  console.log('✅ Successfully refreshed materialized views!');
}
