/**
 * Manually fix the functions by recreating them through RPC calls
 * This is a workaround since we can't execute raw SQL migrations
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://fbloukfgdjvwzdgrcnzt.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZibG91a2ZnZGp2d3pkZ3Jjbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY2NTA0OCwiZXhwIjoyMDg1MjQxMDQ4fQ.l0ss4VLYgSxoABYqRszr9-w7cSyBHMbBYMo1KfMo5-8';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║   Manual Fix: Testing Mosaic Functions           ║');
  console.log('╚═══════════════════════════════════════════════════╝\n');

  console.log('⚠️  To properly fix this issue, the migration needs to be applied via Supabase Dashboard.\n');
  console.log('Steps to apply the fix:');
  console.log('1. Go to: https://supabase.com/dashboard/project/fbloukfgdjvwzdgrcnzt/sql');
  console.log('2. Open the SQL Editor');
  console.log('3. Copy the contents of:');
  console.log('   /Users/arvind/Documents/Hackathons/Cloud9 x JetBrains 2026/lumina/supabase/migrations/20260202000001_fix_mosaic_empty_series_arrays.sql');
  console.log('4. Paste and execute the SQL\n');

  console.log('In the meantime, testing with workaround (passing actual series IDs)...\n');

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
  console.log(`Testing with team: ${teamName} (ID: ${teamId})`);

  // Get ALL series IDs for this team (workaround for empty array issue)
  const { data: series } = await supabase
    .from('series')
    .select('id')
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`);

  const allSeriesIds = series?.map(s => s.id.toString()) ?? [];
  console.log(`Found ${allSeriesIds.length} total series for this team\n`);

  // Test get_team_players_summary with ALL series IDs (workaround)
  console.log('Testing get_team_players_summary (workaround with all series):');
  try {
    const { data, error } = await supabase.rpc('get_team_players_summary', {
      p_team_id: teamId.toString(),
      p_series_ids: allSeriesIds
    });

    if (error) {
      console.log(`❌ Error: ${error.message}`);
    } else {
      const players = Array.isArray(data) ? data : (data || []);
      console.log(`✅ Got ${players.length} players`);
      if (players.length > 0) {
        console.log(`Sample player: ${players[0].player_name} - ACS: ${players[0].acs}`);
      }
    }
  } catch (e: any) {
    console.log(`❌ Exception: ${e.message}`);
  }

  // Test get_team_strategies_summary
  console.log('\nTesting get_team_strategies_summary (workaround with all series):');
  try {
    const { data, error } = await supabase.rpc('get_team_strategies_summary', {
      p_team_id: teamId.toString(),
      p_series_ids: allSeriesIds
    });

    if (error) {
      console.log(`❌ Error: ${error.message}`);
    } else {
      console.log(`✅ Success!`);
      if (data && data.pistol_patterns) {
        console.log(`  Pistol patterns: ${data.pistol_patterns.length}`);
      }
      if (data && data.economy_patterns) {
        console.log(`  Economy patterns: ${data.economy_patterns.length}`);
      }
      if (data && data.site_preferences) {
        console.log(`  Site preferences: ${data.site_preferences.length}`);
      }
    }
  } catch (e: any) {
    console.log(`❌ Exception: ${e.message}`);
  }

  console.log('\n=== Summary ===');
  console.log('✅ Workaround: Pass all series IDs instead of empty array');
  console.log('🔧 Proper fix: Apply the migration via Supabase Dashboard SQL Editor');
  console.log('📝 Migration file: supabase/migrations/20260202000001_fix_mosaic_empty_series_arrays.sql\n');
}

main().catch(console.error);
