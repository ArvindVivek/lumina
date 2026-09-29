import { seriesOfGame, teamName, playerName, type Db } from "./db"
import type { Game, Round, Series } from "./fixture"

/*
 * Browse queries behind the list and detail pages and their API routes. Pure over the db, so
 * tests run them on synthetic tables.
 */

export function datasetStats(db: Db) {
  return {
    tournaments: db.tournaments.length,
    teams: db.teams.length,
    players: db.players.length,
    series: db.series.length,
    games: db.games.length,
    rounds: db.rounds.length,
    killEvents: db.kill_events.length,
    clutchSituations: db.player_round_stats.filter((p) => p.clutch_situation).length,
  }
}

/** Maps won by each side of a series. */
export function seriesScore(db: Db, s: Series) {
  const games = db.gamesBySeries.get(s.id) ?? []
  return {
    a: games.filter((g) => g.winner_id === s.team_a_id).length,
    b: games.filter((g) => g.winner_id === s.team_b_id).length,
  }
}

export interface SeriesRow {
  id: string
  start_time: string
  format: string | null
  team_a_id: string
  team_b_id: string
  team_a_name: string
  team_b_name: string
  team_a_score: number
  team_b_score: number
  winner_id: string | null
  tournament_id: string
  tournament_name: string
  maps: string[]
}

export function seriesRow(db: Db, s: Series): SeriesRow {
  const score = seriesScore(db, s)
  return {
    id: s.id,
    start_time: s.start_time,
    format: s.format,
    team_a_id: s.team_a_id,
    team_b_id: s.team_b_id,
    team_a_name: teamName(db, s.team_a_id),
    team_b_name: teamName(db, s.team_b_id),
    team_a_score: score.a,
    team_b_score: score.b,
    winner_id: s.winner_id,
    tournament_id: s.tournament_id,
    tournament_name: db.tournament.get(s.tournament_id)?.name ?? "Unknown tournament",
    maps: (db.gamesBySeries.get(s.id) ?? []).map((g) => g.map_name),
  }
}

/** Series newest first, optionally for one tournament or one team. */
export function listSeries(db: Db, opts: { limit?: number; tournamentId?: string | null; teamId?: string | null } = {}): SeriesRow[] {
  return db.series
    .filter((s) => !opts.tournamentId || s.tournament_id === opts.tournamentId)
    .filter((s) => !opts.teamId || s.team_a_id === opts.teamId || s.team_b_id === opts.teamId)
    .sort((a, b) => b.start_time.localeCompare(a.start_time))
    .slice(0, opts.limit ?? 100)
    .map((s) => seriesRow(db, s))
}

export function listTournaments(db: Db) {
  return db.tournaments
    .map((t) => {
      const series = db.series.filter((s) => s.tournament_id === t.id)
      const teams = new Set(series.flatMap((s) => [s.team_a_id, s.team_b_id]))
      const final = [...series].sort((a, b) => b.start_time.localeCompare(a.start_time))[0]
      return {
        ...t,
        series_count: series.length,
        team_count: teams.size,
        game_count: series.reduce((n, s) => n + (db.gamesBySeries.get(s.id)?.length ?? 0), 0),
        champion_id: final?.winner_id ?? null,
        champion_name: final?.winner_id ? teamName(db, final.winner_id) : null,
      }
    })
    .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""))
}

export type TournamentRow = ReturnType<typeof listTournaments>[number]

export function listTeams(db: Db) {
  return db.teams
    .map((t) => {
      const series = db.series.filter((s) => s.team_a_id === t.id || s.team_b_id === t.id)
      let mapsWon = 0
      let mapsLost = 0
      let roundsWon = 0
      let roundsPlayed = 0
      for (const s of series) {
        for (const g of db.gamesBySeries.get(s.id) ?? []) {
          if (g.winner_id === t.id) mapsWon++
          else mapsLost++
          for (const r of db.roundsByGame.get(g.id) ?? []) {
            roundsPlayed++
            if (r.winning_team_id === t.id) roundsWon++
          }
        }
      }
      return {
        id: t.id,
        name: t.name,
        series_played: series.length,
        series_won: series.filter((s) => s.winner_id === t.id).length,
        maps_won: mapsWon,
        maps_lost: mapsLost,
        round_win_rate: roundsPlayed ? roundsWon / roundsPlayed : 0,
        roster: latestRoster(db, t.id, series),
      }
    })
    .sort((a, b) => b.series_won - a.series_won || a.name.localeCompare(b.name))
}

/** The five who played the team's most recent series (older players stay in the player list). */
function latestRoster(db: Db, teamId: string, series: Series[]): string[] {
  const latest = [...series].sort((a, b) => b.start_time.localeCompare(a.start_time))[0]
  if (!latest) return []
  const names = new Set<string>()
  for (const g of db.gamesBySeries.get(latest.id) ?? []) {
    const r = db.roundsByGame.get(g.id)?.[0]
    for (const p of (r && db.prsByRound.get(r.id)) ?? []) if (p.team_id === teamId) names.add(playerName(db, p.player_id))
  }
  return [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
}

export type TeamRow = ReturnType<typeof listTeams>[number]

export function listPlayers(db: Db) {
  return db.players
    .map((p) => {
      const rows = db.prsByPlayer.get(p.id) ?? []
      const kills = rows.reduce((n, r) => n + r.kills, 0)
      const deaths = rows.reduce((n, r) => n + r.deaths, 0)
      const agents = new Map<string, number>()
      for (const r of rows) agents.set(r.agent, (agents.get(r.agent) ?? 0) + 1)
      return {
        id: p.id,
        name: p.name,
        team_id: p.team_id,
        team_name: p.team_id ? teamName(db, p.team_id) : null,
        rounds: rows.length,
        kills,
        deaths,
        kd: deaths ? kills / deaths : kills,
        first_kills: rows.filter((r) => r.first_kill).length,
        clutches_won: rows.filter((r) => r.clutch_won).length,
        top_agents: [...agents.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a]) => a),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }))
}

export type PlayerRow = ReturnType<typeof listPlayers>[number]

export function gameDetail(db: Db, gameId: string) {
  const game = db.game.get(gameId)
  const series = game && seriesOfGame(db, gameId)
  if (!game || !series) return null
  return {
    ...game,
    team_a_id: series.team_a_id,
    team_b_id: series.team_b_id,
    team_a_name: teamName(db, series.team_a_id),
    team_b_name: teamName(db, series.team_b_id),
    tournament_id: series.tournament_id,
    tournament_name: db.tournament.get(series.tournament_id)?.name ?? "",
    series_game_count: db.gamesBySeries.get(series.id)?.length ?? 0,
  }
}

export type GameDetail = NonNullable<ReturnType<typeof gameDetail>>

export interface RoundRow extends Round {
  first_blood_player_id: string | null
  first_blood_player_name: string | null
  first_blood_team_id: string | null
  first_blood_timestamp_ms: number | null
  kills: number
}

export function gameRounds(db: Db, gameId: string): RoundRow[] {
  return (db.roundsByGame.get(gameId) ?? []).map((r) => {
    const kills = db.killsByRound.get(r.id) ?? []
    const fb = kills.find((k) => k.is_first_kill)
    const fbTeam = fb?.killer_id ? (db.prsByRound.get(r.id) ?? []).find((p) => p.player_id === fb.killer_id)?.team_id : undefined
    return {
      ...r,
      first_blood_player_id: fb?.killer_id ?? null,
      first_blood_player_name: fb?.killer_id ? playerName(db, fb.killer_id) : null,
      first_blood_team_id: fbTeam ?? null,
      first_blood_timestamp_ms: fb?.game_time_ms ?? null,
      kills: kills.length,
    }
  })
}

/** One scoreboard line per player for a game (or a whole series). */
export function scoreboard(db: Db, games: Game[]) {
  const lines = new Map<string, { player_id: string; name: string; team_id: string; agents: Set<string>; rounds: number; kills: number; deaths: number; assists: number; first_kills: number; first_deaths: number; clutches_won: number }>()
  for (const g of games) {
    for (const r of db.roundsByGame.get(g.id) ?? []) {
      for (const p of db.prsByRound.get(r.id) ?? []) {
        const l = lines.get(p.player_id) ?? {
          player_id: p.player_id,
          name: playerName(db, p.player_id),
          team_id: p.team_id,
          agents: new Set<string>(),
          rounds: 0, kills: 0, deaths: 0, assists: 0, first_kills: 0, first_deaths: 0, clutches_won: 0,
        }
        l.agents.add(p.agent)
        l.rounds++
        l.kills += p.kills
        l.deaths += p.deaths
        l.assists += p.assists
        if (p.first_kill) l.first_kills++
        if (p.first_death) l.first_deaths++
        if (p.clutch_won) l.clutches_won++
        lines.set(p.player_id, l)
      }
    }
  }
  return [...lines.values()]
    .map(({ agents, ...l }) => ({ ...l, agents: [...agents], kpr: l.rounds ? l.kills / l.rounds : 0 }))
    .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
}

export type ScoreboardLine = ReturnType<typeof scoreboard>[number]

/** The compact page context the header and the chat use ("C9 vs SEN", "12 matches"). */
export function pageContext(db: Db, q: { page?: string | null; tournamentId?: string | null; seriesId?: string | null; teamId?: string | null; playerId?: string | null }) {
  if (q.page === "tournament" && q.tournamentId) {
    const t = db.tournament.get(q.tournamentId)
    if (!t) return {}
    const series = listSeries(db, { tournamentId: t.id })
    return {
      type: "tournament",
      tournamentName: t.name,
      matchCount: series.length,
      matches: series.map((s) => ({ teamA: s.team_a_name, teamB: s.team_b_name, completed: s.winner_id !== null })),
    }
  }
  if (q.page === "series" && q.seriesId) {
    const s = db.seriesById.get(q.seriesId)
    if (!s) return {}
    return {
      type: "series",
      tournamentName: db.tournament.get(s.tournament_id)?.name ?? "Unknown",
      teamA: teamName(db, s.team_a_id),
      teamB: teamName(db, s.team_b_id),
      format: s.format,
      completed: s.winner_id !== null,
      games: (db.gamesBySeries.get(s.id) ?? []).map((g) => ({
        map: g.map_name,
        scoreA: g.team_a_score,
        scoreB: g.team_b_score,
        completed: g.winner_id !== null,
      })),
    }
  }
  if (q.page === "team" && q.teamId) {
    const t = db.team.get(q.teamId)
    if (!t) return {}
    return {
      type: "team",
      teamName: t.name,
      players: db.players.filter((p) => p.team_id === t.id).map((p) => p.name),
      recentMatches: listSeries(db, { teamId: t.id, limit: 5 }).map((s) => ({
        opponent: s.team_a_id === t.id ? s.team_b_name : s.team_a_name,
        won: s.winner_id === t.id,
      })),
    }
  }
  if (q.page === "player" && q.playerId) {
    const p = db.player.get(q.playerId)
    if (!p) return {}
    const rows = db.prsByPlayer.get(p.id) ?? []
    return {
      type: "player",
      playerName: p.name,
      teamName: p.team_id ? teamName(db, p.team_id) : "Free agent",
      stats: {
        rounds_played: rows.length,
        total_kills: rows.reduce((n, r) => n + r.kills, 0),
        total_deaths: rows.reduce((n, r) => n + r.deaths, 0),
        first_kills: rows.filter((r) => r.first_kill).length,
        clutches_won: rows.filter((r) => r.clutch_won).length,
      },
    }
  }
  return {}
}
