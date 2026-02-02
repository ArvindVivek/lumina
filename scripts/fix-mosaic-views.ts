/**
 * Script to diagnose and fix Mosaic materialized views
 *
 * This script will:
 * 1. Check if materialized views exist
 * 2. Check if they have data
 * 3. Try to refresh them in smaller batches
 * 4. Report on the results
 */

import { createClient } from '@supabase/supabase-js';

// Hardcode for now since dotenv is not available
const supabaseUrl = 'https://fbloukfgdjvwzdgrcnzt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibG91a2ZnZGp2d3pkZ3Jjbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2NTA0OCwiZXhwIjoyMDg1MjQxMDQ4fQ.l0ss4VLYgSxoABYqRszr9-w7cSyBHMbBYMo1KfMo5-8';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface ViewInfo {
  schemaname: string;
  matviewname: string;
}

interface ViewCount {
  count: number;
}

async function checkViews() {
  console.log('\n=== Checking Materialized Views ===\n');

  // Check if views exist
  const { data: views, error: viewsError } = await supabase.rpc('pg_catalog.pg_matviews', {}) as any;

  // Try a different approach - query information_schema
  const { data: viewsList, error: viewsListError } = await supabase
    .from('pg_matviews')
    .select('schemaname, matviewname')
    .eq('schemaname', 'mosaic');

  if (viewsListError) {
    console.log('Cannot query pg_matviews directly, trying SQL query...');

    // Try direct SQL
    const { data: sqlResult, error: sqlError } = await supabase.rpc('exec_sql', {
      sql: "SELECT schemaname, matviewname FROM pg_matviews WHERE schemaname = 'mosaic' ORDER BY matviewname"
    });

    if (sqlError) {
      console.log('Cannot execute SQL directly. Checking via alternative method...');
    }
  }

  console.log('Checking view data by querying directly...\n');

  const viewsToCheck = [
    'mosaic.mv_round_acs',
    'mosaic.mv_player_core_stats',
    'mosaic.mv_player_agent_pool',
    'mosaic.mv_team_map_stats',
    'mosaic.mv_team_compositions'
  ];

  for (const viewName of viewsToCheck) {
    const schema = viewName.split('.')[0];
    const table = viewName.split('.')[1];

    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .limit(1);

      if (error) {
        console.log(`❌ ${viewName}: Does not exist or cannot be queried`);
        console.log(`   Error: ${error.message}`);
      } else {
        console.log(`✅ ${viewName}: Exists with ${count || 0} rows`);
      }
    } catch (e: any) {
      console.log(`❌ ${viewName}: Error - ${e.message}`);
    }
  }
}

async function checkDataSources() {
  console.log('\n=== Checking Data Sources ===\n');

  const tables = [
    { name: 'series', expected: 196 },
    { name: 'games', expected: 500 },
    { name: 'rounds', expected: 10357 },
    { name: 'player_round_stats', expected: 103570 },
    { name: 'players', expected: null },
    { name: 'teams', expected: null },
    { name: 'kill_events', expected: null }
  ];

  for (const table of tables) {
    const { count, error } = await supabase
      .from(table.name)
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.log(`❌ ${table.name}: Error - ${error.message}`);
    } else {
      const status = table.expected ? (count === table.expected ? '✅' : '⚠️') : '✅';
      console.log(`${status} ${table.name}: ${count} rows ${table.expected ? `(expected ${table.expected})` : ''}`);
    }
  }
}

async function refreshViewsIndividually() {
  console.log('\n=== Attempting to Refresh Views Individually ===\n');

  const views = [
    'mosaic.mv_round_acs',
    'mosaic.mv_player_core_stats',
    'mosaic.mv_player_agent_pool',
    'mosaic.mv_team_map_stats',
    'mosaic.mv_team_compositions'
  ];

  for (const viewName of views) {
    console.log(`\nRefreshing ${viewName}...`);
    const startTime = Date.now();

    try {
      const { data, error } = await supabase.rpc('refresh_materialized_view', {
        view_name: viewName
      });

      const duration = Date.now() - startTime;

      if (error) {
        console.log(`❌ Failed: ${error.message}`);
      } else {
        console.log(`✅ Success! (took ${duration}ms)`);

        // Check row count after refresh
        const table = viewName.split('.')[1];
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        console.log(`   View now has ${count} rows`);
      }
    } catch (e: any) {
      console.log(`❌ Error: ${e.message}`);
    }
  }
}

async function testMosaicQueries() {
  console.log('\n=== Testing Mosaic Queries ===\n');

  // Get a sample team and series
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name')
    .limit(1);

  if (!teams || teams.length === 0) {
    console.log('❌ No teams found');
    return;
  }

  const teamId = teams[0].id;
  console.log(`Testing with team: ${teams[0].name} (${teamId})`);

  // Test get_player_core_stats
  console.log('\nTesting get_player_core_stats...');
  try {
    const { data, error } = await supabase.rpc('get_player_core_stats', {
      p_team_id: teamId,
      p_series_ids: []
    });

    if (error) {
      console.log(`❌ Error: ${error.message}`);
    } else {
      console.log(`✅ Success! Got ${data?.length || 0} player stats`);
      if (data && data.length > 0) {
        console.log(`   Sample: ${JSON.stringify(data[0], null, 2)}`);
      }
    }
  } catch (e: any) {
    console.log(`❌ Error: ${e.message}`);
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Mosaic Materialized Views Diagnostic    ║');
  console.log('╚════════════════════════════════════════════╝');

  await checkDataSources();
  await checkViews();
  await refreshViewsIndividually();
  await testMosaicQueries();

  console.log('\n=== Diagnostic Complete ===\n');
}

main().catch(console.error);
