import { getDb } from '@/lib/data'
import { teamName, type Db } from '@/lib/data/db'
import { teamCode } from '@/lib/data/names'

export interface ResolvedEntities {
  players: { id: string; name: string; team_id: string | null }[]
  teams: { id: string; name: string }[]
  series: { id: string; team_a_name: string; team_b_name: string; tournament_name: string }[]
  queryType: 'player' | 'team' | 'match' | 'general'
  confidence: number
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Whole-word, accent-insensitive match ("kru" finds "KRÜ Esports", "bang" doesn't find "bangbang"). */
function mentions(query: string, term: string): boolean {
  const q = ` ${normalize(query).replace(/[^a-z0-9/ ]+/g, ' ')} `
  const t = normalize(term).replace(/[^a-z0-9/ ]+/g, ' ').trim()
  return t.length >= 2 && q.includes(` ${t} `)
}

/** Players named in the text, longest names first so "Zellsis" wins over shorter overlaps. */
export function findPlayers(db: Db, text: string) {
  return db.players
    .filter((p) => mentions(text, p.name))
    .sort((a, b) => b.name.length - a.name.length)
    .slice(0, 5)
    .map((p) => ({ id: p.id, name: p.name, team_id: p.team_id }))
}

/** Teams named in the text by full name, name without "Esports", or short code (C9, SEN, 100T). */
export function findTeams(db: Db, text: string) {
  return db.teams
    .filter((t) => {
      const short = t.name.replace(/\s+esports$/i, '')
      return mentions(text, t.name) || mentions(text, short) || mentions(text, teamCode(t.name))
    })
    .slice(0, 5)
    .map((t) => ({ id: t.id, name: t.name }))
}

export function seriesBetween(db: Db, a: string, b: string) {
  return db.series
    .filter((s) => (s.team_a_id === a && s.team_b_id === b) || (s.team_a_id === b && s.team_b_id === a))
    .sort((x, y) => y.start_time.localeCompare(x.start_time))
    .slice(0, 5)
    .map((s) => ({
      id: s.id,
      team_a_name: teamName(db, s.team_a_id),
      team_b_name: teamName(db, s.team_b_id),
      tournament_name: db.tournament.get(s.tournament_id)?.name ?? '',
    }))
}

/** Finds the players, teams and matches a question is about. */
export function resolveEntitiesFrom(db: Db, query: string): ResolvedEntities {
  const players = findPlayers(db, query)
  const teams = findTeams(db, query)
  if (teams.length >= 2) {
    const series = seriesBetween(db, teams[0].id, teams[1].id)
    return { players, teams, series, queryType: 'match', confidence: series.length ? 0.9 : 0.6 }
  }
  if (players.length) return { players, teams, series: [], queryType: 'player', confidence: 0.8 }
  if (teams.length) return { players, teams, series: [], queryType: 'team', confidence: 0.8 }
  return { players, teams, series: [], queryType: 'general', confidence: 0.5 }
}

export async function resolveEntities(query: string) {
  return resolveEntitiesFrom(getDb(), query)
}

export function recentSeriesForTeam(db: Db, teamId: string, limit = 5) {
  return db.series
    .filter((s) => s.team_a_id === teamId || s.team_b_id === teamId)
    .sort((a, b) => b.start_time.localeCompare(a.start_time))
    .slice(0, limit)
    .map((s) => ({
      id: s.id,
      opponent_name: teamName(db, s.team_a_id === teamId ? s.team_b_id : s.team_a_id),
      result: s.winner_id === teamId ? 'win' : 'loss',
      tournament_name: db.tournament.get(s.tournament_id)?.name ?? '',
    }))
}

export function recentSeriesForPlayer(db: Db, playerId: string, limit = 5) {
  const seen = new Map<string, string>()
  for (const p of db.prsByPlayer.get(playerId) ?? []) {
    const r = db.round.get(p.round_id)
    const g = r && db.game.get(r.game_id)
    if (g && !seen.has(g.series_id)) seen.set(g.series_id, p.team_id)
  }
  return [...seen.entries()]
    .map(([id, team]) => ({ s: db.seriesById.get(id)!, team }))
    .sort((a, b) => b.s.start_time.localeCompare(a.s.start_time))
    .slice(0, limit)
    .map(({ s, team }) => ({
      series_id: s.id,
      team_id: team,
      team_name: teamName(db, team),
      opponent_name: teamName(db, s.team_a_id === team ? s.team_b_id : s.team_a_id),
    }))
}

export async function getRecentSeriesForTeam(teamId: string, limit = 5) {
  return recentSeriesForTeam(getDb(), teamId, limit)
}

export async function getRecentSeriesForPlayer(playerId: string, limit = 5) {
  return recentSeriesForPlayer(getDb(), playerId, limit)
}
