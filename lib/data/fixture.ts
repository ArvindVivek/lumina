import "server-only"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * The bundled match data. Lumina's database was deleted after the hackathon, so every page and
 * API route reads this fixture instead: 32 VCT Americas playoff series (2024-2025) rebuilt from
 * GRID's event logs by scripts/fixtures/build-fixtures.mjs.
 *
 * Read with fs rather than `import`, so TypeScript never type-checks a 2 MB JSON literal and the
 * data isn't copied into every route's bundle (next.config.ts traces the file into each function).
 */

export interface Tournament {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
}

export interface Team {
  id: string
  name: string
}

export interface Player {
  id: string
  name: string
  team_id: string | null
}

export interface Series {
  id: string
  tournament_id: string
  start_time: string
  format: string | null
  team_a_id: string
  team_b_id: string
  winner_id: string | null
}

export interface Game {
  id: string
  series_id: string
  sequence_number: number
  map_name: string
  team_a_score: number
  team_b_score: number
  winner_id: string | null
  duration_ms: number | null
}

export type RoundPhase = "pistol" | "eco" | "force" | "full"
export type WinCondition = "elimination" | "spike_defuse" | "spike_explode" | "time"

export interface Round {
  id: string
  game_id: string
  round_number: number
  phase: RoundPhase
  winning_team_id: string
  winning_condition: WinCondition
  spike_planted: boolean
  spike_defused: boolean
  /** Players still alive when the round ended. */
  team_a_alive: number
  team_b_alive: number
  /** Team equipment value when the buy phase ended. */
  team_a_loadout_value: number
  team_b_loadout_value: number
  duration_ms: number | null
  /** Which side the series' team A played this round. */
  team_a_side: "attack" | "defense" | null
}

export interface PlayerRoundStats {
  round_id: string
  player_id: string
  team_id: string
  agent: string
  kills: number
  deaths: number
  assists: number
  first_kill: boolean
  first_death: boolean
  /** A teammate killed this player's killer within 5 seconds. */
  traded: boolean
  /** One of this player's kills avenged a teammate who died in the previous 5 seconds. */
  got_trade: boolean
  clutch_situation: boolean
  clutch_won: boolean
  loadout_value: number
  armor: number
  /** The ultimate was charged when the buy phase ended. */
  ult_ready: boolean
  ultimate_used: boolean
}

export interface KillEvent {
  round_id: string
  /** Milliseconds after the buy phase ended. */
  game_time_ms: number
  killer_id: string | null
  victim_id: string
  weapon: string
  is_first_kill: boolean
  is_trade: boolean
  is_self_kill: boolean
  killer_pos_x: number | null
  killer_pos_y: number | null
  victim_pos_x: number | null
  victim_pos_y: number | null
  assist_count: number
}

export interface SpikeEvent {
  round_id: string
  game_time_ms: number
  event_type: "plant_complete" | "defuse_complete" | "explode"
  player_id: string | null
  pos_x: number | null
  pos_y: number | null
}

export interface Tables {
  tournaments: Tournament[]
  teams: Team[]
  players: Player[]
  series: Series[]
  games: Game[]
  rounds: Round[]
  player_round_stats: PlayerRoundStats[]
  kill_events: KillEvent[]
  spike_events: SpikeEvent[]
}

interface PackedTable {
  cols: string[]
  rows: unknown[][]
  bools?: string[]
  refs?: { round_id?: "rounds" }
}

type PackedFixture = { [K in keyof Tables]: PackedTable } & { source: string; builtFrom: string[] }

/** Expands one column-packed table (see pack() in the build script). */
export function unpackTable<T>(table: PackedTable, roundIds?: string[]): T[] {
  const bools = new Set(table.bools ?? [])
  const refRound = table.refs?.round_id === "rounds"
  return table.rows.map((row) => {
    const out: Record<string, unknown> = {}
    table.cols.forEach((col, i) => {
      let v = row[i]
      if (bools.has(col)) v = v === 1 || v === true
      else if (refRound && col === "round_id" && roundIds) v = roundIds[v as number]
      out[col] = v
    })
    return out as T
  })
}

export function unpackFixture(raw: PackedFixture): Tables {
  const rounds = unpackTable<Round>(raw.rounds)
  const roundIds = rounds.map((r) => r.id)
  return {
    tournaments: unpackTable<Tournament>(raw.tournaments),
    teams: unpackTable<Team>(raw.teams),
    players: unpackTable<Player>(raw.players),
    series: unpackTable<Series>(raw.series),
    games: unpackTable<Game>(raw.games),
    rounds,
    player_round_stats: unpackTable<PlayerRoundStats>(raw.player_round_stats, roundIds),
    kill_events: unpackTable<KillEvent>(raw.kill_events, roundIds),
    spike_events: unpackTable<SpikeEvent>(raw.spike_events, roundIds),
  }
}

export const FIXTURE_PATH = path.join(process.cwd(), "lib/data/fixtures/matches.json")

let cached: Tables | null = null

/** The fixture tables, parsed once per server instance. */
export function loadTables(): Tables {
  if (!cached) cached = unpackFixture(JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as PackedFixture)
  return cached
}
