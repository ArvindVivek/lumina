import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createServerClient()

    // Fetch all counts in parallel using Supabase client
    const [
      { count: tournaments },
      { count: teams },
      { count: players },
      { count: series },
      { count: games },
      { count: rounds },
      { count: killEvents },
      { count: clutchSituations }
    ] = await Promise.all([
      supabase.from('tournaments').select('*', { count: 'exact', head: true }),
      supabase.from('teams').select('*', { count: 'exact', head: true }),
      supabase.from('players').select('*', { count: 'exact', head: true }),
      supabase.from('series').select('*', { count: 'exact', head: true }).eq('processed', true),
      supabase.from('games').select('*', { count: 'exact', head: true }),
      supabase.from('rounds').select('*', { count: 'exact', head: true }),
      supabase.from('kill_events').select('*', { count: 'exact', head: true }),
      supabase.from('player_round_stats').select('*', { count: 'exact', head: true }).eq('clutch_situation', true)
    ])

    return NextResponse.json({
      tournaments: tournaments || 0,
      teams: teams || 0,
      players: players || 0,
      series: series || 0,
      games: games || 0,
      rounds: rounds || 0,
      killEvents: killEvents || 0,
      clutchSituations: clutchSituations || 0
    })
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    )
  }
}
