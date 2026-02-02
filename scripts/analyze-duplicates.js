const { createClient } = require("@supabase/supabase-js");
const supabase = createClient(
  "http://127.0.0.1:54321",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
);

async function analyze() {
  console.log("=".repeat(80));
  console.log("COMPREHENSIVE DUPLICATE ANALYSIS - ALL SCHEMAS");
  console.log("=".repeat(80));

  // PUBLIC SCHEMA (VALORANT/Lumina)
  console.log("\n>>> PUBLIC SCHEMA (VALORANT/Lumina) <<<\n");

  const publicTables = [
    { name: "kill_events", keyFn: (r) => `${r.round_id}-${r.game_time_ms}-${r.killer_id}-${r.victim_id}` },
    { name: "kill_assists", keyFn: (r) => `${r.round_id}-${r.kill_index}-${r.assister_id}` },
    { name: "spike_events", keyFn: (r) => `${r.round_id}-${r.game_time_ms}-${r.event_type}-${r.player_id}` },
    { name: "ability_events", keyFn: (r) => `${r.round_id}-${r.player_id}-${r.ability_name}` },
    { name: "orb_events", keyFn: (r) => `${r.round_id}-${r.game_time_ms}-${r.player_id}` },
    { name: "scenario_index", keyFn: (r) => r.round_id },
  ];

  for (const t of publicTables) {
    await analyzeTable(t.name, t.keyFn);
  }

  // Check core tables that should have no dupes (PK enforced)
  console.log("\n--- Core Tables (PK enforced) ---");
  const coreTables = ["teams", "players", "series", "games", "rounds", "tournaments"];
  for (const name of coreTables) {
    const { count } = await supabase.from(name).select("*", { count: "exact", head: true });
    console.log(`${name}: ${count} rows ✓`);
  }

  // SYNAPSE SCHEMA (LoL)
  console.log("\n>>> SYNAPSE SCHEMA (LoL) <<<\n");

  // These are in synapse schema - need to check if accessible
  const synapseTables = [
    { name: "synapse.teams", keyFn: (r) => r.grid_id },
    { name: "synapse.players", keyFn: (r) => r.grid_id },
    { name: "synapse.series", keyFn: (r) => r.grid_id },
    { name: "synapse.games", keyFn: (r) => r.grid_id },
    { name: "synapse.drafts", keyFn: (r) => r.game_id },
    { name: "synapse.champion_picks", keyFn: (r) => `${r.draft_id}-${r.pick_order}` },
  ];

  for (const t of synapseTables) {
    try {
      const tableName = t.name.replace("synapse.", "");
      // Try to access via schema prefix
      const { data, count, error } = await supabase
        .schema("synapse")
        .from(tableName)
        .select("*", { count: "exact" })
        .limit(5000);

      if (error) {
        console.log(`${t.name}: Unable to access (${error.message})`);
        continue;
      }

      if (!data || data.length === 0) {
        console.log(`${t.name}: ${count || 0} rows (empty)`);
        continue;
      }

      const seen = new Map();
      data.forEach((row) => {
        const key = t.keyFn(row);
        seen.set(key, (seen.get(key) || 0) + 1);
      });

      let maxDupes = 0;
      seen.forEach((c) => { if (c > maxDupes) maxDupes = c; });

      const status = maxDupes > 1 ? `⚠️ ${maxDupes}x duplication` : "✓ OK";
      console.log(`${t.name}: ${count} rows, ${seen.size} unique in sample - ${status}`);
    } catch (e) {
      console.log(`${t.name}: Error - ${e.message}`);
    }
  }

  // MOSAIC SCHEMA (materialized views)
  console.log("\n>>> MOSAIC SCHEMA (Materialized Views) <<<\n");

  try {
    const mosaicViews = ["mv_player_core_stats", "mv_player_agent_pool", "mv_team_map_stats", "mv_team_compositions"];
    for (const view of mosaicViews) {
      const { count, error } = await supabase
        .schema("mosaic")
        .from(view)
        .select("*", { count: "exact", head: true });

      if (error) {
        console.log(`mosaic.${view}: Unable to access`);
      } else {
        console.log(`mosaic.${view}: ${count} rows`);
      }
    }
  } catch (e) {
    console.log("Mosaic schema: " + e.message);
  }
}

async function analyzeTable(name, keyFn) {
  try {
    const { count: total } = await supabase.from(name).select("*", { count: "exact", head: true });

    if (!total || total === 0) {
      console.log(`${name}: 0 rows (empty)`);
      return;
    }

    // Sample data to detect duplicates
    const { data: sample } = await supabase.from(name).select("*").limit(10000);

    if (!sample || sample.length === 0) {
      console.log(`${name}: ${total} rows (couldn't sample)`);
      return;
    }

    const seen = new Map();
    sample.forEach((row) => {
      const key = keyFn(row);
      seen.set(key, (seen.get(key) || 0) + 1);
    });

    const uniqueInSample = seen.size;
    let maxDupes = 0;
    seen.forEach((c) => { if (c > maxDupes) maxDupes = c; });

    const estimatedUnique = Math.round(total / maxDupes);
    const estimatedDupes = total - estimatedUnique;

    console.log(`${name}:`);
    console.log(`   Total: ${total} rows`);
    console.log(`   Sample: ${sample.length} rows → ${uniqueInSample} unique`);
    console.log(`   Max duplication factor: ${maxDupes}x`);
    console.log(`   Estimated unique: ~${estimatedUnique}`);
    console.log(`   Estimated duplicates: ~${estimatedDupes}`);

    if (maxDupes > 1) {
      console.log(`   ⚠️  NEEDS CLEANUP - ~${Math.round((1 - 1/maxDupes) * 100)}% are duplicates`);
    } else {
      console.log(`   ✓ OK`);
    }
    console.log("");
  } catch (e) {
    console.log(`${name}: Error - ${e.message}`);
  }
}

analyze().catch(console.error);
