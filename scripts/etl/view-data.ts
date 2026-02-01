/**
 * Quick script to view data counts from Supabase
 */
import { config } from 'dotenv'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

// Load env
config({ path: path.resolve(process.cwd(), '../../.env.local') })

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function viewData() {
  console.log('\n========================================')
  console.log('LUMINA DATABASE CONTENTS')
  console.log('========================================\n')

  // Get counts for each table
  const tables = [
    'tournaments',
    'series',
    'teams',
    'players',
    'games',
    'rounds',
    'player_round_stats',
    'kill_events',
    'kill_assists',
    'spike_events',
    'ability_events',
    'scenario_index',
  ]

  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) {
      console.log(`${table.padEnd(20)}: Error - ${error.message}`)
    } else {
      console.log(`${table.padEnd(20)}: ${count?.toLocaleString() || 0}`)
    }
  }

  console.log('\n========================================')
  console.log('Sample Queries')
  console.log('========================================\n')

  // Get recent series
  const { data: recentSeries } = await supabase
    .from('series')
    .select(`
      id,
      start_time,
      tournaments(name),
      team_a:teams!series_team_a_id_fkey(name),
      team_b:teams!series_team_b_id_fkey(name),
      winner:teams!series_winner_id_fkey(name)
    `)
    .order('start_time', { ascending: false })
    .limit(5)

  console.log('Recent Series:')
  if (recentSeries) {
    for (const series of recentSeries) {
      const teamA = (series.team_a as any)?.name || 'TBD'
      const teamB = (series.team_b as any)?.name || 'TBD'
      const winner = (series.winner as any)?.name || 'Ongoing'
      const date = new Date(series.start_time).toLocaleDateString()
      console.log(`  [${date}] ${teamA} vs ${teamB} - Winner: ${winner}`)
    }
  }

  // Get top players by kills
  console.log('\nTop 10 Players by Total Kills:')
  const { data: topPlayers } = await supabase
    .from('player_round_stats')
    .select('player_id, players(name), kills')
    .order('kills', { ascending: false })
    .limit(10)

  if (topPlayers) {
    const playerKills = new Map<string, { name: string; kills: number }>()
    for (const stat of topPlayers) {
      const playerId = stat.player_id
      const playerName = (stat.players as any)?.name || playerId
      const kills = stat.kills || 0

      if (!playerKills.has(playerId)) {
        playerKills.set(playerId, { name: playerName, kills: 0 })
      }
      playerKills.get(playerId)!.kills += kills
    }

    const sorted = Array.from(playerKills.values())
      .sort((a, b) => b.kills - a.kills)
      .slice(0, 10)

    for (let i = 0; i < sorted.length; i++) {
      console.log(`  ${(i + 1).toString().padStart(2)}. ${sorted[i].name.padEnd(20)} - ${sorted[i].kills} kills`)
    }
  }

  console.log('\n========================================')
  console.log('Access Data:')
  console.log('========================================')
  console.log(`Supabase Studio: http://localhost:54323`)
  console.log(`Database URL:    postgresql://postgres:postgres@127.0.0.1:54322/postgres`)
  console.log('========================================\n')
}

viewData().catch(console.error)
