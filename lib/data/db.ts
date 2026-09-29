import type {
  Game,
  KillEvent,
  Player,
  PlayerRoundStats,
  Round,
  Series,
  SpikeEvent,
  Tables,
  Team,
  Tournament,
} from "./fixture"
import { cleanTeamName } from "./names"

/**
 * In-memory indexes over the fixture tables. Everything the old SQL joined on (round → game →
 * series → tournament) is a map lookup here. Pure: tests build one from synthetic tables.
 */
export interface Db extends Tables {
  tournament: Map<string, Tournament>
  team: Map<string, Team>
  player: Map<string, Player>
  seriesById: Map<string, Series>
  game: Map<string, Game>
  round: Map<string, Round>
  gamesBySeries: Map<string, Game[]>
  roundsByGame: Map<string, Round[]>
  prsByRound: Map<string, PlayerRoundStats[]>
  prsByPlayer: Map<string, PlayerRoundStats[]>
  killsByRound: Map<string, KillEvent[]>
  spikesByRound: Map<string, SpikeEvent[]>
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const row of rows) {
    const k = key(row)
    const list = map.get(k)
    if (list) list.push(row)
    else map.set(k, [row])
  }
  return map
}

/**
 * Builds the indexes. Two fixes happen here: team names lose GRID's " (1)" suffix, and each
 * player's team is the one they played for most recently (the fixture keeps whichever series was
 * processed last, which isn't always the newest).
 */
export function buildDb(input: Tables): Db {
  const seriesStart = new Map(input.series.map((s) => [s.id, s.start_time]))
  const gameSeries = new Map(input.games.map((g) => [g.id, g.series_id]))
  const roundGame = new Map(input.rounds.map((r) => [r.id, r.game_id]))
  const latest = new Map<string, { team: string; at: string }>()
  for (const p of input.player_round_stats) {
    const at = seriesStart.get(gameSeries.get(roundGame.get(p.round_id) ?? "") ?? "") ?? ""
    const prev = latest.get(p.player_id)
    if (!prev || at > prev.at) latest.set(p.player_id, { team: p.team_id, at })
  }
  const t: Tables = {
    ...input,
    teams: input.teams.map((x) => ({ ...x, name: cleanTeamName(x.name) })),
    players: input.players.map((x) => ({ ...x, team_id: latest.get(x.id)?.team ?? x.team_id })),
  }
  const gamesBySeries = groupBy(t.games, (g) => g.series_id)
  for (const list of gamesBySeries.values()) list.sort((a, b) => a.sequence_number - b.sequence_number)
  const roundsByGame = groupBy(t.rounds, (r) => r.game_id)
  for (const list of roundsByGame.values()) list.sort((a, b) => a.round_number - b.round_number)
  const killsByRound = groupBy(t.kill_events, (k) => k.round_id)
  for (const list of killsByRound.values()) list.sort((a, b) => a.game_time_ms - b.game_time_ms)
  const spikesByRound = groupBy(t.spike_events, (s) => s.round_id)
  for (const list of spikesByRound.values()) list.sort((a, b) => a.game_time_ms - b.game_time_ms)
  return {
    ...t,
    tournament: new Map(t.tournaments.map((x) => [x.id, x])),
    team: new Map(t.teams.map((x) => [x.id, x])),
    player: new Map(t.players.map((x) => [x.id, x])),
    seriesById: new Map(t.series.map((x) => [x.id, x])),
    game: new Map(t.games.map((x) => [x.id, x])),
    round: new Map(t.rounds.map((x) => [x.id, x])),
    gamesBySeries,
    roundsByGame,
    prsByRound: groupBy(t.player_round_stats, (p) => p.round_id),
    prsByPlayer: groupBy(t.player_round_stats, (p) => p.player_id),
    killsByRound,
    spikesByRound,
  }
}

/** The series a game belongs to. */
export function seriesOfGame(db: Db, gameId: string): Series | undefined {
  const g = db.game.get(gameId)
  return g ? db.seriesById.get(g.series_id) : undefined
}

/** The series a round belongs to. */
export function seriesOfRound(db: Db, roundId: string): Series | undefined {
  const r = db.round.get(roundId)
  return r ? seriesOfGame(db, r.game_id) : undefined
}

export function teamName(db: Db, id: string | null | undefined): string {
  return (id && db.team.get(id)?.name) || "Unknown team"
}

export function playerName(db: Db, id: string | null | undefined): string {
  return (id && db.player.get(id)?.name) || "Unknown player"
}

/** Every game in the series the team played, optionally inside one tournament or on one map. */
export function teamGames(db: Db, teamId: string, opts: { tournamentId?: string | null; mapName?: string | null } = {}) {
  const out: { game: Game; series: Series; isTeamA: boolean }[] = []
  for (const s of db.series) {
    if (s.team_a_id !== teamId && s.team_b_id !== teamId) continue
    if (opts.tournamentId && s.tournament_id !== opts.tournamentId) continue
    for (const g of db.gamesBySeries.get(s.id) ?? []) {
      if (opts.mapName && g.map_name !== opts.mapName) continue
      out.push({ game: g, series: s, isTeamA: s.team_a_id === teamId })
    }
  }
  return out
}

/** Every round the team played, with its game and series. */
export function teamRounds(db: Db, teamId: string, opts: { tournamentId?: string | null; mapName?: string | null } = {}) {
  const out: { round: Round; game: Game; series: Series; isTeamA: boolean }[] = []
  for (const tg of teamGames(db, teamId, opts)) {
    for (const round of db.roundsByGame.get(tg.game.id) ?? []) out.push({ round, ...tg })
  }
  return out
}

/** A player's round rows, with the round, game and series each belongs to. */
export function playerRounds(db: Db, playerId: string, opts: { tournamentId?: string | null; seriesId?: string | null } = {}) {
  const out: { stats: PlayerRoundStats; round: Round; game: Game; series: Series }[] = []
  for (const stats of db.prsByPlayer.get(playerId) ?? []) {
    const round = db.round.get(stats.round_id)
    const game = round && db.game.get(round.game_id)
    const series = game && db.seriesById.get(game.series_id)
    if (!round || !game || !series) continue
    if (opts.tournamentId && series.tournament_id !== opts.tournamentId) continue
    if (opts.seriesId && series.id !== opts.seriesId) continue
    out.push({ stats, round, game, series })
  }
  return out
}

/** Which side a team played in a round (from the logged sides, not a guess from the round number). */
export function sideOf(round: Round, isTeamA: boolean): "attack" | "defense" | null {
  if (!round.team_a_side) return null
  if (isTeamA) return round.team_a_side
  return round.team_a_side === "attack" ? "defense" : "attack"
}

/** The attacking team of a round, or null when the side wasn't logged. */
export function attackerOf(db: Db, round: Round): string | null {
  const s = seriesOfGame(db, round.game_id)
  if (!s || !round.team_a_side) return null
  return round.team_a_side === "attack" ? s.team_a_id : s.team_b_id
}

export interface RoundReplay {
  /** First moment a team was down to one player, per team. */
  clutches: { playerId: string; teamId: string; opponentsAlive: number; timeMs: number }[]
  /** Alive counts when the spike went down (null when it wasn't planted). */
  atPlant: { attackersAlive: number; defendersAlive: number; timeMs: number } | null
}

/**
 * Replays a round's kills to recover the moments the stored rows don't keep: who was left alone
 * against how many, and how many were alive at the plant. Revives aren't in the fixture, so a Sage
 * resurrection makes these counts one low for the rest of that round (rare in pro play).
 */
export function replayRound(db: Db, roundId: string): RoundReplay {
  const roster = db.prsByRound.get(roundId) ?? []
  const alive = new Map(roster.map((p) => [p.player_id, p.team_id]))
  const teams = [...new Set(roster.map((p) => p.team_id))]
  const count = (team: string) => [...alive.values()].filter((t) => t === team).length
  const round = db.round.get(roundId)
  const attacker = round ? attackerOf(db, round) : null
  const plant = (db.spikesByRound.get(roundId) ?? []).find((s) => s.event_type === "plant_complete")

  const result: RoundReplay = { clutches: [], atPlant: null }
  const snapshotPlant = () => {
    if (!plant || result.atPlant || !attacker) return
    const defender = teams.find((t) => t !== attacker)
    result.atPlant = {
      attackersAlive: count(attacker),
      defendersAlive: defender ? count(defender) : 0,
      timeMs: plant.game_time_ms,
    }
  }

  for (const k of db.killsByRound.get(roundId) ?? []) {
    if (plant && k.game_time_ms > plant.game_time_ms) snapshotPlant()
    alive.delete(k.victim_id)
    for (const team of teams) {
      if (result.clutches.some((c) => c.teamId === team)) continue
      const other = teams.find((t) => t !== team)
      if (count(team) === 1 && other && count(other) > 0) {
        const last = [...alive.entries()].find(([, t]) => t === team)?.[0]
        if (last) result.clutches.push({ playerId: last, teamId: team, opponentsAlive: count(other), timeMs: k.game_time_ms })
      }
    }
  }
  snapshotPlant()
  return result
}
