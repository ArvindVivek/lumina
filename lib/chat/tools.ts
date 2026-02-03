/**
 * Chat tool implementations using Supabase client
 * Replaces direct postgres queries with Supabase-compatible queries
 */

import { createServerClient } from '@/lib/supabase/server'

export async function getPlayerByName(playerName: string): Promise<string> {
  try {
    const supabase = createServerClient()

    // Find the player
    const { data: players, error: playerError } = await supabase
      .from('players')
      .select('id, name, team_id, teams(id, name)')
      .ilike('name', `%${playerName}%`)
      .limit(1)

    if (playerError || !players || players.length === 0) {
      return JSON.stringify({
        error: `No player found matching "${playerName}"`,
        suggestion: "Try a different spelling or check the player name"
      })
    }

    const player = players[0] as any
    const playerId = player.id
    const teamData = player.teams as { id: string; name: string } | null

    // Get comprehensive stats using Supabase aggregations
    const { data: stats, error: statsError } = await supabase
      .from('player_round_stats')
      .select('*')
      .eq('player_id', playerId)

    if (statsError || !stats) {
      return JSON.stringify({
        player: {
          id: player.id,
          name: player.name,
          team: teamData?.name || "Free Agent",
          team_id: teamData?.id || null
        },
        error: "Failed to fetch player stats"
      })
    }

    // Calculate stats from raw data
    const roundsPlayed = new Set(stats.map(s => s.round_id)).size
    const totalKills = stats.reduce((sum, s) => sum + (s.kills || 0), 0)
    const totalDeaths = stats.reduce((sum, s) => sum + (s.deaths || 0), 0)
    const totalAssists = stats.reduce((sum, s) => sum + (s.assists || 0), 0)
    const kdRatio = totalDeaths > 0 ? totalKills / totalDeaths : totalKills
    const acsApprox = roundsPlayed > 0 ? Math.round((totalKills * 150 + totalAssists * 50) / roundsPlayed) : 0

    // First kills/deaths
    const firstKills = stats.filter(s => s.first_kill).length
    const firstDeaths = stats.filter(s => s.first_death).length

    // Clutch stats
    const clutchSituations = stats.filter(s => s.clutch_situation).length
    const clutchWins = stats.filter(s => s.clutch_won).length
    const clutchRate = clutchSituations > 0 ? (clutchWins / clutchSituations) * 100 : 0

    // Trading stats
    const deathStats = stats.filter(s => (s.deaths || 0) > 0)
    const tradedDeaths = deathStats.filter(s => s.traded).length
    const tradeRate = deathStats.length > 0 ? (tradedDeaths / deathStats.length) * 100 : 0

    // Agent pool
    const agentMap = new Map<string, { rounds: number; kills: number; deaths: number }>()
    stats.forEach(s => {
      if (!s.agent) return
      const current = agentMap.get(s.agent) || { rounds: 0, kills: 0, deaths: 0 }
      agentMap.set(s.agent, {
        rounds: current.rounds + 1,
        kills: current.kills + (s.kills || 0),
        deaths: current.deaths + (s.deaths || 0)
      })
    })

    const agents = Array.from(agentMap.entries())
      .sort((a, b) => b[1].rounds - a[1].rounds)
      .slice(0, 5)
      .map(([name, data]) => ({
        name,
        rounds: data.rounds,
        kd: data.deaths > 0 ? (data.kills / data.deaths).toFixed(2) : data.kills.toString()
      }))

    return JSON.stringify({
      player: {
        id: player.id,
        name: player.name,
        team: teamData?.name || "Free Agent",
        team_id: teamData?.id || null
      },
      stats: {
        rounds_played: roundsPlayed,
        total_kills: totalKills,
        total_deaths: totalDeaths,
        total_assists: totalAssists,
        kd_ratio: kdRatio.toFixed(2),
        acs_approx: acsApprox
      },
      clutch: clutchSituations > 0 ? {
        situations: clutchSituations,
        wins: clutchWins,
        rate: clutchRate.toFixed(1) + "%"
      } : null,
      trading: {
        rate: tradeRate.toFixed(1) + "%",
        total_deaths: deathStats.length
      },
      opening_duels: {
        first_kills: firstKills,
        first_deaths: firstDeaths,
        differential: firstKills - firstDeaths > 0 ? `+${firstKills - firstDeaths}` : (firstKills - firstDeaths).toString()
      },
      agents
    })
  } catch (error) {
    console.error("Error in getPlayerByName:", error)
    return JSON.stringify({ error: "Failed to fetch player data", details: String(error) })
  }
}

export async function getTeamByName(teamName: string): Promise<string> {
  try {
    const supabase = createServerClient()

    // Find the team
    const { data: teams, error: teamError } = await supabase
      .from('teams')
      .select('id, name, short_name')
      .or(`name.ilike.%${teamName}%,short_name.ilike.%${teamName}%`)
      .limit(1)

    if (teamError || !teams || teams.length === 0) {
      return JSON.stringify({
        error: `No team found matching "${teamName}"`,
        suggestion: "Try a different spelling or check the team name"
      })
    }

    const team = teams[0]
    const teamId = team.id

    // Get players on team
    const { data: players } = await supabase
      .from('players')
      .select('id, name')
      .eq('team_id', teamId)
      .order('name')
      .limit(10)

    // Get series stats
    const { data: seriesData } = await supabase
      .from('series')
      .select('id, team_a_id, team_b_id, winner_id, processed')
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
      .eq('processed', true)

    const totalSeries = seriesData?.length || 0
    const seriesWins = seriesData?.filter(s => s.winner_id === teamId).length || 0

    // Get games stats
    const seriesIds = seriesData?.map(s => s.id) || []
    let gamesData: any[] = []
    if (seriesIds.length > 0) {
      const { data } = await supabase
        .from('games')
        .select('id, winner_id')
        .in('series_id', seriesIds)
      gamesData = data || []
    }

    const totalGames = gamesData.length
    const gameWins = gamesData.filter(g => g.winner_id === teamId).length
    const mapWinRate = totalGames > 0 ? ((gameWins / totalGames) * 100).toFixed(1) : "0.0"

    return JSON.stringify({
      team: {
        id: team.id,
        name: team.name,
        short_name: team.short_name
      },
      overview: {
        total_series: totalSeries,
        series_wins: seriesWins,
        total_games: totalGames,
        game_wins: gameWins,
        map_win_rate: mapWinRate + "%"
      },
      players: players || [],
      recent_matches: [] // Simplified for now
    })
  } catch (error) {
    console.error("Error in getTeamByName:", error)
    return JSON.stringify({ error: "Failed to fetch team data", details: String(error) })
  }
}
