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

export async function queryPlayerStats(playerId: string, metric: string): Promise<string> {
  try {
    const supabase = createServerClient()

    // Get player info
    const { data: playerData } = await supabase
      .from('players')
      .select('id, name, teams(name)')
      .eq('id', playerId)
      .single()

    if (!playerData) {
      return JSON.stringify({ error: "Player not found" })
    }

    // Get all stats for player
    const { data: stats } = await supabase
      .from('player_round_stats')
      .select('*')
      .eq('player_id', playerId)

    if (!stats || stats.length === 0) {
      return JSON.stringify({ error: "No stats found for player" })
    }

    const player = playerData as any
    const teamName = player.teams?.name || "Free Agent"

    if (metric === "overview") {
      const roundsPlayed = new Set(stats.map(s => s.round_id)).size
      const totalKills = stats.reduce((sum, s) => sum + (s.kills || 0), 0)
      const totalDeaths = stats.reduce((sum, s) => sum + (s.deaths || 0), 0)
      const totalAssists = stats.reduce((sum, s) => sum + (s.assists || 0), 0)
      const firstKills = stats.filter(s => s.first_kill).length
      const firstDeaths = stats.filter(s => s.first_death).length
      const clutchSituations = stats.filter(s => s.clutch_situation).length
      const clutchesWon = stats.filter(s => s.clutch_won).length
      const deathsWithStat = stats.filter(s => s.deaths > 0)
      const timestraded = deathsWithStat.filter(s => s.traded).length

      return JSON.stringify({
        player_name: player.name,
        team_name: teamName,
        rounds_played: roundsPlayed,
        total_kills: totalKills,
        total_deaths: totalDeaths,
        total_assists: totalAssists,
        kd_ratio: totalDeaths > 0 ? (totalKills / totalDeaths).toFixed(2) : totalKills.toString(),
        first_kills: firstKills,
        first_deaths: firstDeaths,
        clutch_situations: clutchSituations,
        clutches_won: clutchesWon,
        clutch_rate: clutchSituations > 0 ? ((clutchesWon / clutchSituations) * 100).toFixed(1) + "%" : "N/A",
        times_traded: timestraded,
        trade_rate: deathsWithStat.length > 0 ? ((timestraded / deathsWithStat.length) * 100).toFixed(1) + "%" : "N/A"
      })
    }

    if (metric === "clutch") {
      const clutchSituations = stats.filter(s => s.clutch_situation).length
      const clutchWins = stats.filter(s => s.clutch_won).length
      return JSON.stringify({
        clutch_situations: clutchSituations,
        clutch_wins: clutchWins,
        clutch_rate: clutchSituations > 0 ? ((clutchWins / clutchSituations) * 100).toFixed(1) + "%" : "N/A"
      })
    }

    if (metric === "opening_duels") {
      const firstKills = stats.filter(s => s.first_kill).length
      const firstDeaths = stats.filter(s => s.first_death).length
      return JSON.stringify({
        first_kills: firstKills,
        first_deaths: firstDeaths,
        opening_diff: firstKills - firstDeaths,
        opening_success_rate: (firstKills + firstDeaths) > 0 ?
          ((firstKills / (firstKills + firstDeaths)) * 100).toFixed(1) + "%" : "N/A"
      })
    }

    if (metric === "trading") {
      const deathStats = stats.filter(s => s.deaths > 0)
      const timestraded = deathStats.filter(s => s.traded).length
      const gotTradeKills = stats.filter(s => s.traded_by_teammate).length
      return JSON.stringify({
        total_deaths: deathStats.length,
        times_traded: timestraded,
        trade_rate: deathStats.length > 0 ? ((timestraded / deathStats.length) * 100).toFixed(1) + "%" : "N/A",
        got_trade_kills: gotTradeKills
      })
    }

    if (metric === "agents") {
      const agentMap = new Map<string, { rounds: number; kills: number; deaths: number; firstKills: number }>()
      stats.forEach(s => {
        if (!s.agent) return
        const current = agentMap.get(s.agent) || { rounds: 0, kills: 0, deaths: 0, firstKills: 0 }
        agentMap.set(s.agent, {
          rounds: current.rounds + 1,
          kills: current.kills + (s.kills || 0),
          deaths: current.deaths + (s.deaths || 0),
          firstKills: current.firstKills + (s.first_kill ? 1 : 0)
        })
      })

      const agents = Array.from(agentMap.entries())
        .sort((a, b) => b[1].rounds - a[1].rounds)
        .map(([agent, data]) => ({
          agent,
          rounds_played: data.rounds,
          kills: data.kills,
          deaths: data.deaths,
          kd_ratio: data.deaths > 0 ? (data.kills / data.deaths).toFixed(2) : data.kills.toString(),
          first_kills: data.firstKills
        }))

      return JSON.stringify(agents)
    }

    return JSON.stringify({ error: "Unknown metric" })
  } catch (error) {
    console.error("Error in queryPlayerStats:", error)
    return JSON.stringify({ error: "Failed to query player stats", details: String(error) })
  }
}

export async function querySeriesStats(seriesId: string, teamId?: string): Promise<string> {
  try {
    const supabase = createServerClient()

    // Get series info
    const { data: series } = await supabase
      .from('series')
      .select(`
        id,
        team_a:teams!series_team_a_id_fkey(name),
        team_b:teams!series_team_b_id_fkey(name),
        tournament:tournaments(name)
      `)
      .eq('id', seriesId)
      .single()

    if (!series) {
      return JSON.stringify({ error: "Series not found" })
    }

    // Get games
    const { data: games } = await supabase
      .from('games')
      .select('id, winner_id, team_a_score, team_b_score')
      .eq('series_id', seriesId)

    const gamesPlayed = games?.length || 0
    const seriesData = series as any
    const teamAWins = games?.filter(g => g.winner_id === (seriesData as any).team_a_id).length || 0
    const teamBWins = games?.filter(g => g.winner_id === (seriesData as any).team_b_id).length || 0
    const totalRounds = games?.reduce((sum, g) => sum + (g.team_a_score || 0) + (g.team_b_score || 0), 0) || 0

    const result: any = {
      series: {
        id: seriesId,
        team_a_name: seriesData.team_a?.name || "Unknown",
        team_b_name: seriesData.team_b?.name || "Unknown",
        tournament_name: seriesData.tournament?.name || "Unknown",
        games_played: gamesPlayed,
        team_a_wins: teamAWins,
        team_b_wins: teamBWins,
        total_rounds: totalRounds
      }
    }

    // If team ID provided, get team-specific stats
    if (teamId && games && games.length > 0) {
      const gameIds = games.map(g => g.id)
      const { data: rounds } = await supabase
        .from('rounds')
        .select('id')
        .in('game_id', gameIds)

      if (rounds && rounds.length > 0) {
        const roundIds = rounds.map(r => r.id)
        const { data: playerStats } = await supabase
          .from('player_round_stats')
          .select('kills, deaths, first_kill, clutch_won')
          .in('round_id', roundIds)
          .eq('team_id', teamId)

        if (playerStats && playerStats.length > 0) {
          result.team_stats = {
            total_kills: playerStats.reduce((sum, s) => sum + (s.kills || 0), 0),
            total_deaths: playerStats.reduce((sum, s) => sum + (s.deaths || 0), 0),
            first_kills: playerStats.filter(s => s.first_kill).length,
            clutches: playerStats.filter(s => s.clutch_won).length
          }
        }
      }
    }

    return JSON.stringify(result)
  } catch (error) {
    console.error("Error in querySeriesStats:", error)
    return JSON.stringify({ error: "Failed to query series stats", details: String(error) })
  }
}

export async function getRoundDetails(seriesId: string, roundNumber: number, gameNumber?: number): Promise<string> {
  try {
    const supabase = createServerClient()

    // Get games in series
    const { data: games } = await supabase
      .from('games')
      .select('id, sequence_number, map_name')
      .eq('series_id', seriesId)
      .order('sequence_number')

    if (!games || games.length === 0) {
      return JSON.stringify({ error: "No games found for series" })
    }

    // Filter to specific game if provided
    const targetGames = gameNumber ? games.filter(g => g.sequence_number === gameNumber) : games

    if (targetGames.length === 0) {
      return JSON.stringify({ error: "Game not found" })
    }

    const gameIds = targetGames.map(g => g.id)

    // Get the specific round
    const { data: rounds } = await supabase
      .from('rounds')
      .select(`
        id,
        round_number,
        winning_team_id,
        winning_condition,
        spike_planted,
        spike_defused,
        team_a_loadout_value,
        team_b_loadout_value,
        games(map_name, sequence_number),
        winning_team:teams(name)
      `)
      .in('game_id', gameIds)
      .eq('round_number', roundNumber)
      .limit(1)

    if (!rounds || rounds.length === 0) {
      return JSON.stringify({ error: "Round not found" })
    }

    const round = rounds[0] as any
    const roundId = round.id

    // Get player stats for this round
    const { data: playerStats } = await supabase
      .from('player_round_stats')
      .select(`
        agent,
        kills,
        deaths,
        first_kill,
        first_death,
        clutch_situation,
        clutch_won,
        loadout_value,
        traded,
        player:players(name),
        team:teams(name)
      `)
      .eq('round_id', roundId)
      .order('kills', { ascending: false })

    // Get kill events
    const { data: killEvents } = await supabase
      .from('kill_events')
      .select(`
        weapon,
        is_headshot,
        is_first_kill,
        game_time_ms,
        killer:players!kill_events_killer_id_fkey(name),
        victim:players!kill_events_victim_id_fkey(name)
      `)
      .eq('round_id', roundId)
      .order('game_time_ms')

    return JSON.stringify({
      round: {
        number: round.round_number,
        game_number: round.games?.sequence_number || 1,
        map: round.games?.map_name || "Unknown",
        winner: round.winning_team?.name || "Unknown",
        winning_condition: round.winning_condition,
        spike_planted: round.spike_planted,
        spike_defused: round.spike_defused,
        team_a_economy: round.team_a_loadout_value,
        team_b_economy: round.team_b_loadout_value
      },
      players: playerStats || [],
      kill_sequence: killEvents || []
    })
  } catch (error) {
    console.error("Error in getRoundDetails:", error)
    return JSON.stringify({ error: "Failed to get round details", details: String(error) })
  }
}

export async function getMatchSummary(seriesId: string): Promise<string> {
  try {
    const supabase = createServerClient()

    // Get series info
    const { data: series } = await supabase
      .from('series')
      .select(`
        id,
        format,
        team_a:teams!series_team_a_id_fkey(name, id),
        team_b:teams!series_team_b_id_fkey(name, id),
        winner:teams!series_winner_id_fkey(name),
        tournament:tournaments(name)
      `)
      .eq('id', seriesId)
      .single()

    if (!series) {
      return JSON.stringify({ error: "Series not found" })
    }

    const seriesData = series as any

    // Get games
    const { data: games } = await supabase
      .from('games')
      .select(`
        map_name,
        team_a_score,
        team_b_score,
        winner:teams(name)
      `)
      .eq('series_id', seriesId)
      .order('sequence_number')

    // Get all rounds for series
    const gameIds = games?.map(g => (g as any).id) || []
    let topPerformers: any[] = []

    if (games && games.length > 0) {
      // Get round IDs
      const { data: rounds } = await supabase
        .from('rounds')
        .select('id, game_id')
        .in('game_id', games.map((_, i) => i.toString()))

      if (rounds && rounds.length > 0) {
        const roundIds = rounds.map(r => r.id)

        // Get player stats aggregated
        const { data: playerStats } = await supabase
          .from('player_round_stats')
          .select(`
            player_id,
            kills,
            deaths,
            first_kill,
            player:players(name),
            team:teams(name)
          `)
          .in('round_id', roundIds)

        if (playerStats) {
          // Aggregate by player
          const playerMap = new Map<string, any>()
          playerStats.forEach((stat: any) => {
            const pid = stat.player_id
            if (!playerMap.has(pid)) {
              playerMap.set(pid, {
                player_name: stat.player?.name || "Unknown",
                team_name: stat.team?.name || "Unknown",
                kills: 0,
                deaths: 0,
                first_kills: 0
              })
            }
            const p = playerMap.get(pid)
            p.kills += stat.kills || 0
            p.deaths += stat.deaths || 0
            p.first_kills += stat.first_kill ? 1 : 0
          })

          topPerformers = Array.from(playerMap.values())
            .map(p => ({
              ...p,
              kd_ratio: p.deaths > 0 ? (p.kills / p.deaths).toFixed(2) : p.kills.toString()
            }))
            .sort((a, b) => parseFloat(b.kd_ratio) - parseFloat(a.kd_ratio))
            .slice(0, 5)
        }
      }
    }

    return JSON.stringify({
      series: {
        id: seriesId,
        format: seriesData.format,
        team_a_name: seriesData.team_a?.name || "Unknown",
        team_b_name: seriesData.team_b?.name || "Unknown",
        winner_name: seriesData.winner?.name || "Unknown",
        tournament_name: seriesData.tournament?.name || "Unknown"
      },
      games: games || [],
      top_performers: topPerformers
    })
  } catch (error) {
    console.error("Error in getMatchSummary:", error)
    return JSON.stringify({ error: "Failed to get match summary", details: String(error) })
  }
}

export async function queryTeamStats(teamId: string, metric: string): Promise<string> {
  try {
    const supabase = createServerClient()

    // Get team name
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()

    if (!team) {
      return JSON.stringify({ error: "Team not found" })
    }

    if (metric === "overview") {
      // Get series data
      const { data: seriesData } = await supabase
        .from('series')
        .select('id, winner_id, processed')
        .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
        .eq('processed', true)

      const totalSeries = seriesData?.length || 0
      const seriesWins = seriesData?.filter(s => s.winner_id === teamId).length || 0

      // Get games
      const seriesIds = seriesData?.map(s => s.id) || []
      let totalGames = 0
      let gameWins = 0

      if (seriesIds.length > 0) {
        const { data: games } = await supabase
          .from('games')
          .select('id, winner_id')
          .in('series_id', seriesIds)

        totalGames = games?.length || 0
        gameWins = games?.filter(g => g.winner_id === teamId).length || 0
      }

      return JSON.stringify({
        team_name: team.name,
        total_series: totalSeries,
        series_wins: seriesWins,
        total_games: totalGames,
        game_wins: gameWins
      })
    }

    if (metric === "pistol_rounds") {
      // Get all series for team
      const { data: seriesData } = await supabase
        .from('series')
        .select('id')
        .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
        .eq('processed', true)

      if (!seriesData || seriesData.length === 0) {
        return JSON.stringify({ total_pistol_rounds: 0, wins: 0, win_rate: "N/A" })
      }

      const seriesIds = seriesData.map(s => s.id)
      const { data: games } = await supabase
        .from('games')
        .select('id')
        .in('series_id', seriesIds)

      if (!games || games.length === 0) {
        return JSON.stringify({ total_pistol_rounds: 0, wins: 0, win_rate: "N/A" })
      }

      const gameIds = games.map(g => g.id)
      const { data: rounds } = await supabase
        .from('rounds')
        .select('winning_team_id')
        .in('game_id', gameIds)
        .in('round_number', [1, 13])

      const totalPistol = rounds?.length || 0
      const wins = rounds?.filter(r => r.winning_team_id === teamId).length || 0
      const winRate = totalPistol > 0 ? ((wins / totalPistol) * 100).toFixed(1) : "N/A"

      return JSON.stringify({
        total_pistol_rounds: totalPistol,
        wins: wins,
        win_rate: winRate + "%"
      })
    }

    if (metric === "trading") {
      const { data: stats } = await supabase
        .from('player_round_stats')
        .select('deaths, traded')
        .eq('team_id', teamId)
        .gt('deaths', 0)

      const totalDeaths = stats?.length || 0
      const tradedDeaths = stats?.filter(s => s.traded).length || 0
      const tradeRate = totalDeaths > 0 ? ((tradedDeaths / totalDeaths) * 100).toFixed(1) : "N/A"

      return JSON.stringify({
        total_deaths: totalDeaths,
        traded_deaths: tradedDeaths,
        trade_rate: tradeRate + "%"
      })
    }

    if (metric === "first_blood") {
      const { data: stats } = await supabase
        .from('player_round_stats')
        .select('first_kill, first_death')
        .eq('team_id', teamId)

      const firstKills = stats?.filter(s => s.first_kill).length || 0
      const firstDeaths = stats?.filter(s => s.first_death).length || 0

      return JSON.stringify({
        first_kills: firstKills,
        first_deaths: firstDeaths,
        first_blood_diff: firstKills - firstDeaths
      })
    }

    return JSON.stringify({ error: "Unknown metric" })
  } catch (error) {
    console.error("Error in queryTeamStats:", error)
    return JSON.stringify({ error: "Failed to query team stats", details: String(error) })
  }
}

export async function queryRoundBreakdown(seriesId: string, roundType?: string): Promise<string> {
  try {
    const supabase = createServerClient()

    // Get games in series
    const { data: games } = await supabase
      .from('games')
      .select('id, map_name, sequence_number')
      .eq('series_id', seriesId)
      .order('sequence_number')

    if (!games || games.length === 0) {
      return JSON.stringify({ error: "No games found" })
    }

    const gameIds = games.map(g => g.id)

    // Get rounds
    const { data: rounds } = await supabase
      .from('rounds')
      .select(`
        game_id,
        round_number,
        winning_team_id,
        winning_condition,
        spike_planted,
        team_a_loadout_value,
        team_b_loadout_value
      `)
      .in('game_id', gameIds)
      .order('game_id')
      .order('round_number')
      .limit(50)

    if (!rounds) {
      return JSON.stringify([])
    }

    // Classify and filter rounds
    const classified = rounds.map(r => {
      let type = 'buy'
      if ([1, 13].includes(r.round_number)) {
        type = 'pistol'
      } else if (r.team_a_loadout_value < 10000 || r.team_b_loadout_value < 10000) {
        type = 'eco'
      }

      const gameInfo = games.find(g => g.id === r.game_id)
      return {
        map_name: gameInfo?.map_name || "Unknown",
        round_number: r.round_number,
        winning_team_id: r.winning_team_id,
        winning_condition: r.winning_condition,
        spike_planted: r.spike_planted,
        team_a_loadout_value: r.team_a_loadout_value,
        team_b_loadout_value: r.team_b_loadout_value,
        round_type: type
      }
    })

    // Filter by round type if specified
    const filtered = roundType && roundType !== 'all'
      ? classified.filter(r => r.round_type === roundType)
      : classified

    return JSON.stringify(filtered)
  } catch (error) {
    console.error("Error in queryRoundBreakdown:", error)
    return JSON.stringify({ error: "Failed to query rounds", details: String(error) })
  }
}

export async function comparePlayers(playerIds: string[], metrics?: string[]): Promise<string> {
  try {
    const supabase = createServerClient()

    const results: any[] = []

    for (const playerId of playerIds) {
      // Get player info
      const { data: player } = await supabase
        .from('players')
        .select('id, name, teams(name)')
        .eq('id', playerId)
        .single()

      if (!player) continue

      // Get stats
      const { data: stats } = await supabase
        .from('player_round_stats')
        .select('*')
        .eq('player_id', playerId)

      if (!stats || stats.length === 0) continue

      const playerData = player as any
      const rounds = new Set(stats.map(s => s.round_id)).size
      const kills = stats.reduce((sum, s) => sum + (s.kills || 0), 0)
      const deaths = stats.reduce((sum, s) => sum + (s.deaths || 0), 0)
      const firstKills = stats.filter(s => s.first_kill).length
      const clutchWins = stats.filter(s => s.clutch_won).length

      results.push({
        player_name: playerData.name,
        team_name: playerData.teams?.name || "Free Agent",
        rounds,
        kills,
        deaths,
        kd: deaths > 0 ? (kills / deaths).toFixed(2) : kills.toString(),
        first_kills: firstKills,
        clutches: clutchWins
      })
    }

    results.sort((a, b) => parseFloat(b.kd) - parseFloat(a.kd))

    return JSON.stringify(results)
  } catch (error) {
    console.error("Error in comparePlayers:", error)
    return JSON.stringify({ error: "Failed to compare players", details: String(error) })
  }
}

export async function searchData(query: string, type?: string): Promise<string> {
  try {
    const supabase = createServerClient()
    const results: Record<string, any[]> = {}

    if (!type || type === "all" || type === "teams") {
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name, short_name')
        .or(`name.ilike.%${query}%,short_name.ilike.%${query}%`)
        .limit(5)

      results.teams = teams || []
    }

    if (!type || type === "all" || type === "players") {
      const { data: players } = await supabase
        .from('players')
        .select('id, name, teams(name)')
        .ilike('name', `%${query}%`)
        .limit(5)

      results.players = players?.map((p: any) => ({
        id: p.id,
        name: p.name,
        team_name: p.teams?.name || "Free Agent"
      })) || []
    }

    if (!type || type === "all" || type === "tournaments") {
      const { data: tournaments } = await supabase
        .from('tournaments')
        .select('id, name')
        .ilike('name', `%${query}%`)
        .limit(5)

      results.tournaments = tournaments || []
    }

    return JSON.stringify(results)
  } catch (error) {
    console.error("Error in searchData:", error)
    return JSON.stringify({ error: "Failed to search", details: String(error) })
  }
}

export async function getTeamRosterStats(teamId: string): Promise<string> {
  try {
    const supabase = createServerClient()

    // Get team info
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()

    if (!team) {
      return JSON.stringify({ error: "Team not found" })
    }

    // Get players
    const { data: players } = await supabase
      .from('players')
      .select('id, name')
      .eq('team_id', teamId)

    if (!players || players.length === 0) {
      return JSON.stringify({
        team_name: team.name,
        players: []
      })
    }

    const roster: any[] = []

    for (const player of players) {
      const { data: stats } = await supabase
        .from('player_round_stats')
        .select('*')
        .eq('player_id', player.id)

      if (!stats || stats.length === 0) {
        roster.push({
          id: player.id,
          name: player.name,
          rounds_played: 0,
          total_kills: 0,
          total_deaths: 0,
          kd_ratio: "N/A",
          first_kills: 0,
          first_deaths: 0,
          clutches_won: 0,
          trade_rate: "N/A"
        })
        continue
      }

      const rounds = new Set(stats.map(s => s.round_id)).size
      const kills = stats.reduce((sum, s) => sum + (s.kills || 0), 0)
      const deaths = stats.reduce((sum, s) => sum + (s.deaths || 0), 0)
      const firstKills = stats.filter(s => s.first_kill).length
      const firstDeaths = stats.filter(s => s.first_death).length
      const clutchesWon = stats.filter(s => s.clutch_won).length
      const deathStats = stats.filter(s => s.deaths > 0)
      const traded = deathStats.filter(s => s.traded).length
      const tradeRate = deathStats.length > 0 ? ((traded / deathStats.length) * 100).toFixed(1) : "N/A"

      roster.push({
        id: player.id,
        name: player.name,
        rounds_played: rounds,
        total_kills: kills,
        total_deaths: deaths,
        kd_ratio: deaths > 0 ? (kills / deaths).toFixed(2) : kills.toString(),
        first_kills: firstKills,
        first_deaths: firstDeaths,
        clutches_won: clutchesWon,
        trade_rate: typeof tradeRate === 'string' ? tradeRate : tradeRate + "%"
      })
    }

    roster.sort((a, b) => {
      const aKd = a.kd_ratio === "N/A" ? 0 : parseFloat(a.kd_ratio)
      const bKd = b.kd_ratio === "N/A" ? 0 : parseFloat(b.kd_ratio)
      return bKd - aKd
    })

    return JSON.stringify({
      team_name: team.name,
      players: roster
    })
  } catch (error) {
    console.error("Error in getTeamRosterStats:", error)
    return JSON.stringify({ error: "Failed to get roster", details: String(error) })
  }
}

export async function getEconomyAnalysis(seriesId: string, teamId: string): Promise<string> {
  try {
    const supabase = createServerClient()

    // Get games
    const { data: games } = await supabase
      .from('games')
      .select('id, map_name')
      .eq('series_id', seriesId)

    if (!games || games.length === 0) {
      return JSON.stringify({ error: "No games found" })
    }

    // Get series info to determine which team
    const { data: series } = await supabase
      .from('series')
      .select('team_a_id, team_b_id')
      .eq('id', seriesId)
      .single()

    if (!series) {
      return JSON.stringify({ error: "Series not found" })
    }

    const isTeamA = series.team_a_id === teamId

    // Get all rounds
    const gameIds = games.map(g => g.id)
    const { data: rounds } = await supabase
      .from('rounds')
      .select(`
        round_number,
        winning_team_id,
        team_a_loadout_value,
        team_b_loadout_value,
        game_id
      `)
      .in('game_id', gameIds)
      .order('game_id')
      .order('round_number')

    if (!rounds || rounds.length === 0) {
      return JSON.stringify({ rounds: [], buy_type_summary: [] })
    }

    // Process rounds
    const economyRounds = rounds.map(r => {
      const teamLoadout = isTeamA ? r.team_a_loadout_value : r.team_b_loadout_value
      const opponentLoadout = isTeamA ? r.team_b_loadout_value : r.team_a_loadout_value
      const won = r.winning_team_id === teamId

      let buyType = 'full_buy'
      if ([1, 13].includes(r.round_number)) {
        buyType = 'pistol'
      } else if (teamLoadout < 5000) {
        buyType = 'eco'
      } else if (teamLoadout < 15000) {
        buyType = 'force'
      }

      const gameInfo = games.find(g => g.id === r.game_id)

      return {
        map_name: gameInfo?.map_name || "Unknown",
        round_number: r.round_number,
        team_loadout: teamLoadout,
        opponent_loadout: opponentLoadout,
        won,
        buy_type: buyType
      }
    })

    // Aggregate by buy type
    const buyTypes = ['pistol', 'eco', 'force', 'full_buy']
    const summary = buyTypes.map(type => {
      const typeRounds = economyRounds.filter(r => r.buy_type === type)
      const total = typeRounds.length
      const wins = typeRounds.filter(r => r.won).length
      const winRate = total > 0 ? ((wins / total) * 100).toFixed(1) : "N/A"

      return {
        buy_type: type,
        total_rounds: total,
        wins,
        win_rate: winRate + "%"
      }
    })

    return JSON.stringify({
      rounds: economyRounds,
      buy_type_summary: summary
    })
  } catch (error) {
    console.error("Error in getEconomyAnalysis:", error)
    return JSON.stringify({ error: "Failed to analyze economy", details: String(error) })
  }
}

export async function getCounterStrategies(teamId: string, focus?: string): Promise<string> {
  try {
    const supabase = createServerClient()

    // Get team name
    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', teamId)
      .single()

    if (!team) {
      return JSON.stringify({ error: "Team not found" })
    }

    const strategies: Record<string, any> = {
      team_name: team.name
    }

    // First blood analysis
    if (!focus || focus === "all" || focus === "first_blood") {
      const { data: players } = await supabase
        .from('players')
        .select('id, name')
        .eq('team_id', teamId)

      if (players && players.length > 0) {
        const playerFbStats: any[] = []

        for (const player of players) {
          const { data: stats } = await supabase
            .from('player_round_stats')
            .select('first_kill, first_death')
            .eq('player_id', player.id)

          if (stats) {
            const firstKills = stats.filter(s => s.first_kill).length
            const firstDeaths = stats.filter(s => s.first_death).length
            playerFbStats.push({
              player_name: player.name,
              first_kills: firstKills,
              first_deaths: firstDeaths,
              differential: firstKills - firstDeaths
            })
          }
        }

        playerFbStats.sort((a, b) => a.differential - b.differential)

        strategies.first_blood = {
          vulnerable_players: playerFbStats.filter(p => p.differential < 0).slice(0, 3),
          total_fb_attempts: playerFbStats.reduce((sum, p) => sum + p.first_kills + p.first_deaths, 0)
        }
      }
    }

    // Trading efficiency
    if (!focus || focus === "all" || focus === "trading") {
      const { data: stats } = await supabase
        .from('player_round_stats')
        .select('deaths, traded')
        .eq('team_id', teamId)
        .gt('deaths', 0)

      if (stats) {
        const totalDeaths = stats.length
        const tradedDeaths = stats.filter(s => s.traded).length
        const tradeRate = totalDeaths > 0 ? ((tradedDeaths / totalDeaths) * 100).toFixed(1) : "N/A"

        strategies.trading = {
          total_deaths: totalDeaths,
          traded_deaths: tradedDeaths,
          trade_rate: tradeRate + "%",
          recommendation: parseFloat(tradeRate) < 35
            ? "Team has poor trading - isolate players and prevent trades"
            : "Team trades well - need multiple kills before engagement"
        }
      }
    }

    return JSON.stringify(strategies)
  } catch (error) {
    console.error("Error in getCounterStrategies:", error)
    return JSON.stringify({ error: "Failed to generate counter-strategies", details: String(error) })
  }
}

export async function getUntradedDeaths(seriesId: string, teamId: string): Promise<string> {
  try {
    const supabase = createServerClient()

    // Get games
    const { data: games } = await supabase
      .from('games')
      .select('id, map_name')
      .eq('series_id', seriesId)

    if (!games || games.length === 0) {
      return JSON.stringify({ error: "No games found" })
    }

    const gameIds = games.map(g => g.id)

    // Get rounds
    const { data: rounds } = await supabase
      .from('rounds')
      .select('id, game_id')
      .in('game_id', gameIds)

    if (!rounds || rounds.length === 0) {
      return JSON.stringify({ overall: { total_deaths: 0, untraded: 0, rate: "N/A" }, by_player_map: [] })
    }

    const roundIds = rounds.map(r => r.id)

    // Get player stats
    const { data: stats } = await supabase
      .from('player_round_stats')
      .select('player_id, round_id, deaths, traded, players(name)')
      .in('round_id', roundIds)
      .eq('team_id', teamId)
      .gt('deaths', 0)

    if (!stats || stats.length === 0) {
      return JSON.stringify({ overall: { total_deaths: 0, untraded: 0, rate: "N/A" }, by_player_map: [] })
    }

    const totalDeaths = stats.length
    const untradedDeaths = stats.filter(s => !s.traded).length
    const untradedRate = ((untradedDeaths / totalDeaths) * 100).toFixed(1)

    // Group by player and map
    const playerMapStats = new Map<string, any>()
    stats.forEach((s: any) => {
      const round = rounds.find(r => r.id === s.round_id)
      const game = games.find(g => g.id === round?.game_id)
      const key = `${s.player_id}-${game?.map_name || 'Unknown'}`

      if (!playerMapStats.has(key)) {
        playerMapStats.set(key, {
          player_name: s.players?.name || "Unknown",
          map_name: game?.map_name || "Unknown",
          total_deaths: 0,
          untraded_deaths: 0
        })
      }

      const entry = playerMapStats.get(key)
      entry.total_deaths++
      if (!s.traded) entry.untraded_deaths++
    })

    const byPlayerMap = Array.from(playerMapStats.values())
      .map(entry => ({
        ...entry,
        untraded_rate: ((entry.untraded_deaths / entry.total_deaths) * 100).toFixed(1) + "%"
      }))
      .sort((a, b) => parseFloat(b.untraded_rate) - parseFloat(a.untraded_rate))

    return JSON.stringify({
      overall: {
        total_deaths: totalDeaths,
        untraded: untradedDeaths,
        rate: untradedRate + "%"
      },
      by_player_map: byPlayerMap
    })
  } catch (error) {
    console.error("Error in getUntradedDeaths:", error)
    return JSON.stringify({ error: "Failed to analyze untraded deaths", details: String(error) })
  }
}

export async function getSiteAnalysis(teamId: string, mapName?: string): Promise<string> {
  try {
    const supabase = createServerClient()

    // Get spike events for team
    const { data: seriesData } = await supabase
      .from('series')
      .select('id')
      .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
      .eq('processed', true)

    if (!seriesData || seriesData.length === 0) {
      return JSON.stringify({ site_stats: [] })
    }

    const seriesIds = seriesData.map(s => s.id)

    // Get games
    let gameQuery = supabase
      .from('games')
      .select('id, map_name')
      .in('series_id', seriesIds)

    if (mapName) {
      gameQuery = gameQuery.eq('map_name', mapName)
    }

    const { data: games } = await gameQuery

    if (!games || games.length === 0) {
      return JSON.stringify({ site_stats: [] })
    }

    const gameIds = games.map(g => g.id)

    // Get rounds
    const { data: rounds } = await supabase
      .from('rounds')
      .select('id, game_id, winning_team_id')
      .in('game_id', gameIds)

    if (!rounds || rounds.length === 0) {
      return JSON.stringify({ site_stats: [] })
    }

    const roundIds = rounds.map(r => r.id)

    // Get spike plant events
    const { data: spikeEvents } = await supabase
      .from('spike_events')
      .select('site, round_id')
      .in('round_id', roundIds)
      .eq('event_type', 'plant')

    if (!spikeEvents || spikeEvents.length === 0) {
      return JSON.stringify({ site_stats: [] })
    }

    // Group by map and site
    const siteMap = new Map<string, any>()

    spikeEvents.forEach(event => {
      const round = rounds.find(r => r.id === event.round_id)
      const game = games.find(g => g.id === round?.game_id)
      const key = `${game?.map_name || 'Unknown'}-${event.site}`

      if (!siteMap.has(key)) {
        siteMap.set(key, {
          map_name: game?.map_name || "Unknown",
          site: event.site,
          total_attacks: 0,
          wins: 0
        })
      }

      const entry = siteMap.get(key)
      entry.total_attacks++
      if (round && round.winning_team_id === teamId) {
        entry.wins++
      }
    })

    const siteStats = Array.from(siteMap.values())
      .map(entry => ({
        ...entry,
        success_rate: ((entry.wins / entry.total_attacks) * 100).toFixed(1) + "%"
      }))
      .sort((a, b) => a.map_name.localeCompare(b.map_name) || a.site.localeCompare(b.site))

    return JSON.stringify({ site_stats: siteStats })
  } catch (error) {
    console.error("Error in getSiteAnalysis:", error)
    return JSON.stringify({ error: "Failed to analyze sites", details: String(error) })
  }
}
