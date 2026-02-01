/**
 * VALORANT ETL - Comprehensive data fetch from GRID.gg
 *
 * Fetches:
 * - Tournaments, Teams, Series (metadata)
 * - Games, Rounds (from Series State API)
 * - Players, Kill Events, Spike Events, Abilities (from Event Files)
 *
 * Usage: pnpm etl [--dry-run] [--skip-events] [--series-limit=N]
 */

import { config } from 'dotenv'
import path from 'path'
import { existsSync } from 'fs'
import { readdir } from 'fs/promises'

// Load env from project root
config({ path: path.resolve(process.cwd(), '../../.env.local') })
config({ path: path.resolve(process.cwd(), '.env') })

import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { GridAPIClient, Tournament, Series, SeriesState } from './grid-client.js'
import { EventProcessor, ProcessedSeries, buildScenarioIndices } from './event-processor.js'

// Config
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GRID_API_KEY = process.env.GRID_API_KEY
const EVENTS_DIR = path.resolve(process.cwd(), 'data/events')

if (!SUPABASE_URL || !SUPABASE_KEY || !GRID_API_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GRID_API_KEY')
  process.exit(1)
}

// CLI flags
const dryRun = process.argv.includes('--dry-run')
const skipEvents = process.argv.includes('--skip-events')
const seriesLimitArg = process.argv.find(a => a.startsWith('--series-limit='))
const seriesLimit = seriesLimitArg ? parseInt(seriesLimitArg.split('=')[1]) : undefined

// Stats
const stats = {
  tournaments: 0,
  series: 0,
  teams: new Set<string>(),
  players: new Set<string>(),
  games: 0,
  rounds: 0,
  playerStats: 0,
  killEvents: 0,
  spikeEvents: 0,
  abilityEvents: 0,
  orbEvents: 0,
  killAssists: 0,
  scenarios: 0,
  eventFiles: 0,
  errors: 0,
}

// ==========================================
// DATABASE OPERATIONS
// ==========================================

async function upsertTournament(supabase: SupabaseClient, t: Tournament) {
  if (dryRun) return
  const { error } = await supabase.from('tournaments').upsert({
    id: t.id,
    name: t.name,
    start_date: t.startDate,
    end_date: t.endDate,
  }, { onConflict: 'id' })
  if (error) { stats.errors++; console.error(`  [error] Tournament: ${error.message}`) }
}

async function upsertTeam(supabase: SupabaseClient, team: { id: string; name: string }) {
  if (dryRun || !team.name) return
  stats.teams.add(team.id)
  const { error } = await supabase.from('teams').upsert({
    id: team.id,
    name: team.name,
  }, { onConflict: 'id' })
  if (error && !error.message.includes('duplicate')) {
    console.error(`  [error] Team: ${error.message}`)
  }
}

async function upsertPlayer(supabase: SupabaseClient, player: { id: string; name: string; teamId?: string }) {
  if (dryRun || !player.name) return
  stats.players.add(player.id)
  const { error } = await supabase.from('players').upsert({
    id: player.id,
    name: player.name,
    team_id: player.teamId,
  }, { onConflict: 'id' })
  if (error && !error.message.includes('duplicate')) {
    console.error(`  [error] Player: ${error.message}`)
  }
}

async function upsertSeries(supabase: SupabaseClient, s: Series, winnerId?: string) {
  if (dryRun) return
  const { error } = await supabase.from('series').upsert({
    id: s.id,
    tournament_id: s.tournament.id,
    start_time: s.startTimeScheduled,
    format: s.format?.name,
    team_a_id: s.teams[0]?.baseInfo?.id,
    team_b_id: s.teams[1]?.baseInfo?.id,
    winner_id: winnerId,
    processed: true,
  }, { onConflict: 'id' })
  if (error) { stats.errors++; console.error(`  [error] Series: ${error.message}`) }
}

async function upsertGame(supabase: SupabaseClient, game: {
  id: string
  seriesId: string
  sequenceNumber: number
  mapName: string
  teamAScore: number
  teamBScore: number
  winnerId?: string
  durationMs?: number
}) {
  if (dryRun) return
  stats.games++
  const { error } = await supabase.from('games').upsert({
    id: game.id,
    series_id: game.seriesId,
    sequence_number: game.sequenceNumber,
    map_name: game.mapName,
    team_a_score: game.teamAScore,
    team_b_score: game.teamBScore,
    winner_id: game.winnerId,
    duration_ms: game.durationMs,
  }, { onConflict: 'id' })
  if (error) { stats.errors++; console.error(`  [error] Game: ${error.message}`) }
}

async function upsertRound(supabase: SupabaseClient, round: {
  id: string
  gameId: string
  roundNumber: number
  phase: string
  winningTeamId?: string
  winningCondition?: string
  spikePlanted: boolean
  spikeDefused: boolean
  teamAAlive: number
  teamBAlive: number
  teamALoadoutValue: number
  teamBLoadoutValue: number
  durationMs?: number
}) {
  if (dryRun) return
  stats.rounds++
  const { error } = await supabase.from('rounds').upsert({
    id: round.id,
    game_id: round.gameId,
    round_number: round.roundNumber,
    phase: round.phase,
    winning_team_id: round.winningTeamId,
    winning_condition: round.winningCondition,
    spike_planted: round.spikePlanted,
    spike_defused: round.spikeDefused,
    team_a_alive: round.teamAAlive,
    team_b_alive: round.teamBAlive,
    team_a_loadout_value: round.teamALoadoutValue,
    team_b_loadout_value: round.teamBLoadoutValue,
    duration_ms: round.durationMs,
  }, { onConflict: 'id' })
  if (error) { stats.errors++; console.error(`  [error] Round: ${error.message}`) }
}

async function batchInsertPlayerStats(supabase: SupabaseClient, playerStats: any[]) {
  if (dryRun || playerStats.length === 0) return
  stats.playerStats += playerStats.length

  // Transform to DB format
  const rows = playerStats.map(ps => ({
    round_id: ps.roundId,
    player_id: ps.playerId,
    team_id: ps.teamId,
    agent: ps.agent,
    kills: ps.kills,
    deaths: ps.deaths,
    assists: ps.assists,
    damage_dealt: ps.damageDealt,
    damage_taken: ps.damageTaken,
    first_kill: ps.firstKill,
    first_death: ps.firstDeath,
    traded: ps.traded,
    got_trade: ps.gotTrade,
    clutch_situation: ps.clutchSituation,
    clutch_won: ps.clutchWon,
    loadout_value: ps.loadoutValue,
    armor: ps.armor,
    ultimate_points: ps.ultimatePoints,
    ultimate_used: ps.ultimateUsed,
    ability_casts: ps.abilityCasts,
  }))

  // Batch in chunks of 100
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await supabase.from('player_round_stats').upsert(chunk, {
      onConflict: 'round_id,player_id',
      ignoreDuplicates: true,
    })
    if (error) { stats.errors++; console.error(`  [error] PlayerStats batch: ${error.message}`) }
  }
}

async function batchInsertKillEvents(supabase: SupabaseClient, kills: any[]) {
  if (dryRun || kills.length === 0) return
  stats.killEvents += kills.length

  const rows = kills.map(k => ({
    round_id: k.roundId,
    game_time_ms: k.gameTimeMs,
    killer_id: k.killerId,
    victim_id: k.victimId,
    weapon: k.weapon,
    headshot: k.headshot,
    wallbang: k.wallbang,
    is_first_kill: k.isFirstKill,
    is_trade: k.isTrade,
    is_self_kill: k.isSelfKill,
    killer_pos_x: k.killerPosX,
    killer_pos_y: k.killerPosY,
    victim_pos_x: k.victimPosX,
    victim_pos_y: k.victimPosY,
    kill_distance: k.killDistance,
    assist_count: k.assistCount,
  }))

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await supabase.from('kill_events').insert(chunk)
    if (error && !error.message.includes('duplicate')) {
      stats.errors++
      console.error(`  [error] KillEvents batch: ${error.message}`)
    }
  }
}

async function batchInsertSpikeEvents(supabase: SupabaseClient, events: any[]) {
  if (dryRun || events.length === 0) return
  stats.spikeEvents += events.length

  const rows = events.map(e => ({
    round_id: e.roundId,
    game_time_ms: e.gameTimeMs,
    event_type: e.eventType,
    player_id: e.playerId,
    site: e.site,
    pos_x: e.posX,
    pos_y: e.posY,
  }))

  const { error } = await supabase.from('spike_events').insert(rows)
  if (error && !error.message.includes('duplicate')) {
    stats.errors++
    console.error(`  [error] SpikeEvents: ${error.message}`)
  }
}

async function batchInsertAbilityEvents(supabase: SupabaseClient, events: any[]) {
  if (dryRun || events.length === 0) return
  stats.abilityEvents += events.length

  const rows = events.map(e => ({
    round_id: e.roundId,
    player_id: e.playerId,
    ability_name: e.abilityName,
    ability_count: e.count,
  }))

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await supabase.from('ability_events').insert(chunk)
    if (error && !error.message.includes('duplicate')) {
      stats.errors++
      console.error(`  [error] AbilityEvents batch: ${error.message}`)
    }
  }
}

async function batchInsertScenarios(supabase: SupabaseClient, scenarios: any[]) {
  if (dryRun || scenarios.length === 0) return
  stats.scenarios += scenarios.length

  const rows = scenarios.map(s => ({
    round_id: s.roundId,
    game_id: s.gameId,
    round_number: s.roundNumber,
    attacker_alive: s.attackerAlive,
    defender_alive: s.defenderAlive,
    spike_planted: s.spikePlanted,
    time_remaining_ms: s.timeRemainingMs,
    attacker_economy: s.attackerEconomy,
    defender_economy: s.defenderEconomy,
    attacker_won: s.attackerWon,
    map_name: s.mapName,
    tournament_id: s.tournamentId,
  }))

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await supabase.from('scenario_index').insert(chunk)
    if (error && !error.message.includes('duplicate')) {
      stats.errors++
      console.error(`  [error] Scenarios batch: ${error.message}`)
    }
  }
}

async function batchInsertOrbEvents(supabase: SupabaseClient, orbEvents: any[]) {
  if (dryRun || orbEvents.length === 0) return
  stats.orbEvents += orbEvents.length

  const rows = orbEvents.map(e => ({
    round_id: e.roundId,
    game_time_ms: e.gameTimeMs,
    player_id: e.playerId,
    orb_type: e.orbType,
    pos_x: e.posX,
    pos_y: e.posY,
  }))

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await supabase.from('orb_events').insert(chunk)
    if (error && !error.message.includes('duplicate')) {
      stats.errors++
      console.error(`  [error] OrbEvents batch: ${error.message}`)
    }
  }
}

async function batchInsertKillAssists(supabase: SupabaseClient, killAssists: any[]) {
  if (dryRun || killAssists.length === 0) return
  stats.killAssists += killAssists.length

  const rows = killAssists.map(a => ({
    round_id: a.roundId,
    kill_index: a.killIndex,
    killer_id: a.killerId,
    assister_id: a.assisterId,
  }))

  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100)
    const { error } = await supabase.from('kill_assists').insert(chunk)
    if (error && !error.message.includes('duplicate')) {
      stats.errors++
      console.error(`  [error] KillAssists batch: ${error.message}`)
    }
  }
}

// ==========================================
// MAIN ETL
// ==========================================

async function runETL() {
  console.log('========================================')
  console.log('VALORANT ETL - GRID.gg to Supabase')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`Events: ${skipEvents ? 'SKIPPED' : 'ENABLED'}`)
  if (seriesLimit) console.log(`Series Limit: ${seriesLimit}`)
  console.log('========================================\n')

  const grid = new GridAPIClient(GRID_API_KEY!)
  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!)
  const eventProcessor = new EventProcessor()

  // Step 1: Get all VCT Americas tournaments
  console.log('Step 1: Fetching VCT Americas tournaments...')
  const tournaments = await grid.getVCTTournaments()
  console.log(`Found ${tournaments.length} tournaments\n`)

  // Step 2: Collect all series from tournaments
  console.log('Step 2: Collecting series from tournaments...')
  const allSeries: { series: Series; tournamentId: string }[] = []

  for (const tournament of tournaments) {
    console.log(`  [${tournament.id}] ${tournament.name}`)
    stats.tournaments++
    await upsertTournament(supabase, tournament)

    let cursor: string | undefined
    do {
      const result = await grid.getSeriesForTournament(tournament.id, cursor)
      for (const series of result.series) {
        allSeries.push({ series, tournamentId: tournament.id })
        // Upsert teams
        for (const team of series.teams) {
          if (team.baseInfo) await upsertTeam(supabase, team.baseInfo)
        }
      }
      cursor = result.hasNext ? result.endCursor : undefined
    } while (cursor)
  }

  console.log(`\nCollected ${allSeries.length} total series\n`)

  // Apply series limit if specified
  const seriesToProcess = seriesLimit ? allSeries.slice(0, seriesLimit) : allSeries

  // Step 3: Process each series (Series State API + Event Files)
  console.log(`Step 3: Processing ${seriesToProcess.length} series (detailed data)...\n`)

  for (let i = 0; i < seriesToProcess.length; i++) {
    const { series, tournamentId } = seriesToProcess[i]
    const progress = `[${i + 1}/${seriesToProcess.length}]`
    stats.series++

    // Get team names for display
    const teamA = series.teams[0]?.baseInfo?.name || 'TBD'
    const teamB = series.teams[1]?.baseInfo?.name || 'TBD'
    console.log(`${progress} Series ${series.id}: ${teamA} vs ${teamB}`)

    // 3a: Get Series State (games, players, scores)
    const seriesState = await grid.getSeriesState(series.id)

    if (seriesState) {
      // Extract winner
      const winner = seriesState.teams.find(t => t.won)

      // Upsert series with winner
      await upsertSeries(supabase, series, winner?.id)

      // Process players from series state
      for (const team of seriesState.teams) {
        for (const player of team.players || []) {
          await upsertPlayer(supabase, {
            id: player.id,
            name: player.name || player.id,
            teamId: team.id,
          })
        }
      }

      // Process games from series state
      for (const game of seriesState.games || []) {
        const gameTeamA = game.teams[0]
        const gameTeamB = game.teams[1]
        const gameWinner = game.teams.find(t => t.won)

        await upsertGame(supabase, {
          id: game.id,
          seriesId: series.id,
          sequenceNumber: game.sequenceNumber,
          mapName: game.map?.name || 'unknown',
          teamAScore: gameTeamA?.score || 0,
          teamBScore: gameTeamB?.score || 0,
          winnerId: gameWinner?.id,
        })

        // Process players from game
        for (const team of game.teams) {
          for (const player of team.players || []) {
            await upsertPlayer(supabase, {
              id: player.id,
              name: player.name || player.id,
              teamId: team.id,
            })
          }
        }
      }

      console.log(`  -> ${seriesState.games?.length || 0} games from Series State`)
    } else {
      // No series state, just upsert basic series info
      await upsertSeries(supabase, series)
      console.log(`  -> No Series State available`)
    }

    // 3b: Download and process event file (if not skipped)
    if (!skipEvents) {
      try {
        const eventFile = await grid.downloadEventsFile(series.id, EVENTS_DIR)

        if (eventFile) {
          stats.eventFiles++
          console.log(`  -> Downloaded event file`)

          // Process event file
          const processed = await eventProcessor.processFile(eventFile, series.id, tournamentId)

          // Load players from events
          for (const [playerId, player] of processed.players) {
            await upsertPlayer(supabase, player)
          }

          // Load detailed game/round data
          for (const game of processed.games) {
            // Update game with more details
            await upsertGame(supabase, {
              id: game.id,
              seriesId: series.id,
              sequenceNumber: game.sequenceNumber,
              mapName: game.mapName,
              teamAScore: game.teamAScore,
              teamBScore: game.teamBScore,
              winnerId: game.winnerId,
              durationMs: game.durationMs,
            })

            // Insert rounds
            for (const round of game.rounds) {
              await upsertRound(supabase, {
                id: round.id,
                gameId: game.id,
                roundNumber: round.roundNumber,
                phase: round.phase,
                winningTeamId: round.winningTeamId,
                winningCondition: round.winningCondition,
                spikePlanted: round.spikePlanted,
                spikeDefused: round.spikeDefused,
                teamAAlive: round.teamAAlive,
                teamBAlive: round.teamBAlive,
                teamALoadoutValue: round.teamALoadoutValue,
                teamBLoadoutValue: round.teamBLoadoutValue,
                durationMs: round.durationMs,
              })

              // Batch insert events
              await batchInsertPlayerStats(supabase, round.playerStats)
              await batchInsertKillEvents(supabase, round.killEvents)
              await batchInsertSpikeEvents(supabase, round.spikeEvents)
              await batchInsertAbilityEvents(supabase, round.abilityEvents)
              await batchInsertOrbEvents(supabase, round.orbEvents)
              await batchInsertKillAssists(supabase, round.killAssists)
            }
          }

          // Build and insert scenario indices
          const scenarios = buildScenarioIndices(processed.games, tournamentId)
          await batchInsertScenarios(supabase, scenarios)

          console.log(`  -> Processed: ${processed.games.length} games, ${processed.games.reduce((sum, g) => sum + g.rounds.length, 0)} rounds`)
        } else {
          console.log(`  -> No event file available`)
        }
      } catch (e) {
        console.error(`  [error] Event processing: ${(e as Error).message}`)
        stats.errors++
      }
    }
  }

  await grid.disconnect()

  // Print stats
  console.log('\n========================================')
  console.log('ETL COMPLETE')
  console.log('========================================')
  console.log(`Tournaments:    ${stats.tournaments}`)
  console.log(`Series:         ${stats.series}`)
  console.log(`Teams:          ${stats.teams.size}`)
  console.log(`Players:        ${stats.players.size}`)
  console.log(`Games:          ${stats.games}`)
  console.log(`Rounds:         ${stats.rounds}`)
  console.log(`Player Stats:   ${stats.playerStats}`)
  console.log(`Kill Events:    ${stats.killEvents}`)
  console.log(`Kill Assists:   ${stats.killAssists}`)
  console.log(`Spike Events:   ${stats.spikeEvents}`)
  console.log(`Ability Events: ${stats.abilityEvents}`)
  console.log(`Orb Events:     ${stats.orbEvents}`)
  console.log(`Scenarios:      ${stats.scenarios}`)
  console.log(`Event Files:    ${stats.eventFiles}`)
  console.log(`Errors:         ${stats.errors}`)
  console.log(`API Stats:      ${grid.getStats().requests} requests, ${grid.getStats().errors} errors, ${grid.getStats().downloads} downloads`)
  console.log('========================================\n')
}

runETL().catch(e => { console.error('Fatal:', e); process.exit(1) })
