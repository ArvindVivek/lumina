/**
 * Test public schema wrapper functions
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fbloukfgdjvwzdgrcnzt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibG91a2ZnZGp2d3pkZ3Jjbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2NTA0OCwiZXhwIjoyMDg1MjQxMDQ4fQ.l0ss4VLYgSxoABYqRszr9-w7cSyBHMbBYMo1KfMo5-8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Testing Mosaic Wrapper Functions        ║');
  console.log('╚════════════════════════════════════════════╝\n');

  // Get a sample team
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .limit(1);

  if (!teams || teams.length === 0) {
    console.log('❌ No teams found');
    return;
  }

  const teamId = teams[0].id;
  const teamName = teams[0].name;
  console.log(`Testing with team: ${teamName} (ID: ${teamId})\n`);

  // Test get_team_strategies_summary
  console.log('1. Testing get_team_strategies_summary...');
  try {
    const { data, error } = await supabase.rpc('get_team_strategies_summary', {
      p_team_id: teamId.toString(),
      p_series_ids: []
    });

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Success!`);
      console.log(`   Result: ${JSON.stringify(data, null, 2)}`);
    }
  } catch (e: any) {
    console.log(`   ❌ Exception: ${e.message}`);
  }

  // Test get_team_players_summary
  console.log('\n2. Testing get_team_players_summary...');
  try {
    const { data, error } = await supabase.rpc('get_team_players_summary', {
      p_team_id: teamId.toString(),
      p_series_ids: []
    });

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Success!`);
      if (data && typeof data === 'object' && data.players) {
        console.log(`   Found ${data.players.length} players`);
        if (data.players.length > 0) {
          console.log(`   Sample player: ${JSON.stringify(data.players[0], null, 2)}`);
        }
      } else {
        console.log(`   Result: ${JSON.stringify(data, null, 2)}`);
      }
    }
  } catch (e: any) {
    console.log(`   ❌ Exception: ${e.message}`);
  }

  // Test get_map_win_rates
  console.log('\n3. Testing get_map_win_rates...');
  try {
    const { data, error } = await supabase.rpc('get_map_win_rates', {
      p_team_id: teamId.toString(),
      p_series_ids: []
    });

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Success!`);
      console.log(`   Found ${data?.length || 0} maps`);
      if (data && data.length > 0) {
        console.log(`   Sample: ${JSON.stringify(data[0], null, 2)}`);
      }
    }
  } catch (e: any) {
    console.log(`   ❌ Exception: ${e.message}`);
  }

  // Test refresh_all_mosaic_views
  console.log('\n4. Testing refresh_all_mosaic_views...');
  try {
    const startTime = Date.now();
    const { data, error } = await supabase.rpc('refresh_all_mosaic_views', {});

    const duration = Date.now() - startTime;

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Success! (took ${duration}ms)`);
    }
  } catch (e: any) {
    console.log(`   ❌ Exception: ${e.message}`);
  }

  // Now test queries after refresh
  console.log('\n5. Testing get_team_strategies_summary again (after refresh)...');
  try {
    const { data, error } = await supabase.rpc('get_team_strategies_summary', {
      p_team_id: teamId.toString(),
      p_series_ids: []
    });

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      console.log(`   ✅ Success!`);
      console.log(`   Result: ${JSON.stringify(data, null, 2)}`);
    }
  } catch (e: any) {
    console.log(`   ❌ Exception: ${e.message}`);
  }

  console.log('\n=== Test Complete ===\n');
}

main().catch(console.error);
