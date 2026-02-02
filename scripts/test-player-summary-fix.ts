/**
 * Test player summary with actual series IDs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fbloukfgdjvwzdgrcnzt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibG91a2ZnZGp2d3pkZ3Jjbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2NTA0OCwiZXhwIjoyMDg1MjQxMDQ4fQ.l0ss4VLYgSxoABYqRszr9-w7cSyBHMbBYMo1KfMo5-8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Testing Player Summary Fix              ║');
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

  // Get series IDs for this team
  const { data: series } = await supabase
    .from('series')
    .select('id')
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .limit(10);

  const seriesIds = series?.map(s => s.id.toString()) ?? [];
  console.log(`Found ${seriesIds.length} series for this team\n`);

  // Test with empty series IDs (should fail)
  console.log('1. Testing with EMPTY series IDs:');
  try {
    const { data, error } = await supabase.rpc('get_team_players_summary', {
      p_team_id: teamId.toString(),
      p_series_ids: []
    });

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      const players = Array.isArray(data) ? data : (data || []);
      console.log(`   ✅ Got ${players.length} players`);
      if (players.length > 0) {
        console.log(`   Sample: ${JSON.stringify(players[0], null, 2)}`);
      }
    }
  } catch (e: any) {
    console.log(`   ❌ Exception: ${e.message}`);
  }

  // Test with actual series IDs (should succeed)
  console.log('\n2. Testing with ACTUAL series IDs:');
  try {
    const { data, error } = await supabase.rpc('get_team_players_summary', {
      p_team_id: teamId.toString(),
      p_series_ids: seriesIds
    });

    if (error) {
      console.log(`   ❌ Error: ${error.message}`);
    } else {
      const players = Array.isArray(data) ? data : (data || []);
      console.log(`   ✅ Got ${players.length} players`);
      if (players.length > 0) {
        console.log(`   Sample: ${JSON.stringify(players[0], null, 2)}`);
      }
    }
  } catch (e: any) {
    console.log(`   ❌ Exception: ${e.message}`);
  }

  console.log('\n=== Analysis ===');
  console.log('The issue is that get_team_players_summary uses:');
  console.log('  WHERE g.series_id = ANY(p_series_ids)');
  console.log('\nWhen p_series_ids is empty [], the ANY() returns no results.');
  console.log('This needs to be fixed to support empty array (meaning "all series").');
}

main().catch(console.error);
