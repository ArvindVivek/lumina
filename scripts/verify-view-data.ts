/**
 * Verify that materialized views actually have data
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fbloukfgdjvwzdgrcnzt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibG91a2ZnZGp2d3pkZ3Jjbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2NTA0OCwiZXhwIjoyMDg1MjQxMDQ4fQ.l0ss4VLYgSxoABYqRszr9-w7cSyBHMbBYMo1KfMo5-8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkView(viewName: string, limit: number = 5) {
  console.log(`\n=== ${viewName} ===`);

  const tableName = viewName.replace('mosaic.', '');

  // Try to fetch actual data
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(limit);

  if (error) {
    console.log(`❌ Error: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    console.log(`⚠️  View exists but has no data (${data?.length || 0} rows)`);
    return;
  }

  console.log(`✅ Has ${data.length} rows`);
  console.log('Sample data:');
  console.log(JSON.stringify(data[0], null, 2));
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Verifying Materialized View Data        ║');
  console.log('╚════════════════════════════════════════════╝');

  await checkView('mosaic.mv_round_acs');
  await checkView('mosaic.mv_player_core_stats');
  await checkView('mosaic.mv_player_agent_pool');
  await checkView('mosaic.mv_team_map_stats');
  await checkView('mosaic.mv_team_compositions');

  console.log('\n=== Testing Raw Data Queries ===\n');

  // Test if the underlying data would produce results
  console.log('Testing player_round_stats aggregation:');
  const { data: prsTest, error: prsError } = await supabase
    .from('player_round_stats')
    .select('player_id, team_id, kills, deaths, assists, damage_dealt')
    .limit(5);

  if (prsError) {
    console.log(`❌ Error: ${prsError.message}`);
  } else {
    console.log(`✅ player_round_stats has data: ${prsTest?.length} sample rows`);
    console.log(JSON.stringify(prsTest?.[0], null, 2));
  }
}

main().catch(console.error);
