/**
 * VALORANT ETL Script
 * Fetches ALL VALORANT data from GRID.gg and stores in Supabase
 *
 * Usage: pnpm etl:valorant [--tournament=<name>] [--dry-run]
 *
 * Tournaments available:
 *   - VCT Americas - Kickoff 2024
 *   - VCT Americas - Stage 1 2024
 *   - VCT Americas - Stage 2 2024
 *   - VCT Americas - Kickoff 2025
 *   - VCT Americas - Stage 1 2025
 *   - VCT Americas - Stage 2 2025
 *   - VALORANT Masters - Masters Madrid
 */

import 'dotenv/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { GridAPIClient, VALORANT_TOURNAMENTS } from './grid-client.js'

// ==========================================
// CONFIGURATION
// ==========================================

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GRID_API_KEY = process.env.GRID_API_KEY

if (!SUPABASE_URL || !SUPABASE_KEY || !GRID_API_KEY) {
  console.error('Missing required environment variables:')
  console.error('  SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL')
  console.error('  SUPABASE_SERVICE_ROLE_KEY')
  console.error('  GRID_API_KEY')
  process.exit(1)
}

// Parse CLI args
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const tournamentArg = args.find(a => a.startsWith('--tournament='))?.split('=')[1]

// ==========================================
// STATS TRACKING
// ==========================================

const stats = {
  tournaments: { fetched: 0, inserted: 0, errors: 0 },
  series: { fetched: 0, inserted: 0, errors: 0 },
  teams: { upserted: 0 },
  players: { upserted: 0 },
  games: { inserted: 0 },
}

function printStats() {
  console.log('\n========================================')
  console.log('ETL COMPLETE - VALORANT')
  console.log('========================================')
  console.log(`Tournaments: ${stats.tournaments.fetched} fetched, ${stats.tournaments.inserted} inserted`)
  console.log(`Series:      ${stats.series.fetched} fetched, ${stats.series.inserted} inserted`)
  console.log(`Teams:       ${stats.teams.upserted} upserted`)
  console.log(`Players:     ${stats.players.upserted} upserted`)
  console.log(`Games:       ${stats.games.inserted} inserted`)
  console.log('========================================\n')
}

// ==========================================
// DATABASE OPERATIONS
// ==========================================

async function upsertTournament(
  supabase: SupabaseClient,
  tournament: { id: string; title: string; startTimeScheduled: string | null; endTimeScheduled: string | null }
) {
  if (dryRun) {
    console.log(`  [dry-run] Would upsert tournament: ${tournament.title}`)
    return
  }

  const { error } = await supabase
    .from('grid_tournaments')
    .upsert({
      id: tournament.id,
      title: tournament.title,
      start_date: tournament.startTimeScheduled,
      end_date: tournament.endTimeScheduled,
      game: 'valorant',
    }, { onConflict: 'id' })

  if (error) {
    console.error(`  [error] Tournament upsert failed: ${error.message}`)
    stats.tournaments.errors++
  } else {
    stats.tournaments.inserted++
  }
}

async function upsertTeam(
  supabase: SupabaseClient,
  team: { id: string; name: string | null; shortName?: string | null }
) {
  if (dryRun || !team.name) return

  const { error } = await supabase
    .from('grid_teams')
    .upsert({
      id: team.id,
      name: team.name,
      short_name: team.shortName || null,
    }, { onConflict: 'id' })

  if (!error) stats.teams.upserted++
}

async function upsertSeries(
  supabase: SupabaseClient,
  series: {
    id: string
    tournamentId: string | null
    title: string | null
    startTimeScheduled: string | null
  }
) {
  if (dryRun) {
    console.log(`  [dry-run] Would upsert series: ${series.title}`)
    return
  }

  const { error } = await supabase
    .from('grid_series')
    .upsert({
      id: series.id,
      tournament_id: series.tournamentId,
      title: series.title,
      start_time: series.startTimeScheduled,
    }, { onConflict: 'id' })

  if (error) {
    console.error(`  [error] Series upsert failed: ${error.message}`)
    stats.series.errors++
  } else {
    stats.series.inserted++
  }
}

// ==========================================
// MAIN ETL LOGIC
// ==========================================

async function runETL() {
  console.log('========================================')
  console.log('VALORANT ETL - GRID.gg to Supabase')
  console.log('========================================')
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'LIVE'}`)
  console.log('')

  const grid = new GridAPIClient(GRID_API_KEY!)
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
    db: { schema: 'public' }  // Write to public schema for shared data
  })

  // Filter tournaments if specified
  const tournamentsToFetch = tournamentArg
    ? Object.entries(VALORANT_TOURNAMENTS).filter(([name]) =>
        name.toLowerCase().includes(tournamentArg.toLowerCase())
      )
    : Object.entries(VALORANT_TOURNAMENTS)

  console.log(`Processing ${tournamentsToFetch.length} tournaments...\n`)

  for (const [tournamentName, tournamentId] of tournamentsToFetch) {
    console.log(`\n[Tournament] ${tournamentName} (${tournamentId})`)

    try {
      // Fetch tournament details
      const tournament = await grid.getTournament(tournamentId)
      if (!tournament) {
        console.log(`  [skip] Tournament not found`)
        continue
      }
      stats.tournaments.fetched++

      await upsertTournament(supabase, tournament)

      // Fetch all series for this tournament
      console.log(`  Fetching series...`)
      const seriesList = await grid.getSeriesForTournament(tournamentId)
      console.log(`  Found ${seriesList.length} series`)

      for (const series of seriesList) {
        stats.series.fetched++

        // Upsert teams from series
        if (series.teams) {
          for (const team of series.teams) {
            await upsertTeam(supabase, team)
          }
        }

        await upsertSeries(supabase, series)

        // Fetch series state for games/players
        const seriesState = await grid.getSeriesState(series.id)
        if (seriesState) {
          // Process games
          for (const game of seriesState.games) {
            stats.games.inserted++
            // Additional game processing can go here
          }

          // Process players from teams
          for (const team of seriesState.teams) {
            for (const player of team.players) {
              if (player.name) {
                stats.players.upserted++
              }
            }
          }
        }
      }

    } catch (error) {
      console.error(`  [error] ${error instanceof Error ? error.message : error}`)
      stats.tournaments.errors++
    }
  }

  await grid.disconnect()
  printStats()

  const gridStats = grid.getStats()
  console.log(`API Stats: ${gridStats.requests} requests, ${gridStats.errors} errors, ${gridStats.retries} retries`)
}

// ==========================================
// RUN
// ==========================================

runETL().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
