import { describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { statSync } from "node:fs"
import { FIXTURE_PATH, loadTables, unpackTable } from "./fixture"
import { buildDb } from "./db"
import { listTeams } from "./queries"

// Invariants of the shipped fixture (lib/data/fixtures/matches.json), so a rebuild that breaks
// the data fails the gate instead of showing wrong numbers.
const t = loadTables()
const db = buildDb(t)

describe("bundled fixture", () => {
  it("stays small enough to ship with the app", () => {
    expect(statSync(FIXTURE_PATH).size).toBeLessThan(5_000_000)
  })

  it("covers three playoff tournaments of real series", () => {
    expect(t.tournaments).toHaveLength(3)
    expect(t.series.length).toBeGreaterThanOrEqual(30)
    expect(t.teams).toHaveLength(10)
  })

  it("has ten player rows per round and one opening kill per round with kills", () => {
    for (const r of t.rounds) {
      const rows = db.prsByRound.get(r.id) ?? []
      expect(rows).toHaveLength(10)
      if ((db.killsByRound.get(r.id) ?? []).length) expect(rows.filter((p) => p.first_kill || p.first_death).length).toBeGreaterThanOrEqual(1)
      expect(r.team_a_alive).toBeGreaterThanOrEqual(0)
      expect(r.team_a_alive).toBeLessThanOrEqual(5)
    }
  })

  it("scores every game from its rounds and every series from its games", () => {
    for (const g of t.games) {
      const rounds = db.roundsByGame.get(g.id) ?? []
      expect(g.team_a_score + g.team_b_score).toBe(rounds.length)
      expect(Math.max(g.team_a_score, g.team_b_score)).toBeGreaterThanOrEqual(13)
    }
    for (const s of t.series) {
      const games = db.gamesBySeries.get(s.id) ?? []
      const a = games.filter((g) => g.winner_id === s.team_a_id).length
      const b = games.filter((g) => g.winner_id === s.team_b_id).length
      expect(s.winner_id).toBe(a > b ? s.team_a_id : s.team_b_id)
    }
  })

  it("logs a side for almost every round and a first kill time after the buy phase", () => {
    const withSide = t.rounds.filter((r) => r.team_a_side).length
    expect(withSide / t.rounds.length).toBeGreaterThan(0.95)
    for (const k of t.kill_events) expect(k.game_time_ms).toBeGreaterThanOrEqual(0)
  })

  it("shows Cloud9 among the teams, with a sane round win rate", () => {
    const c9 = listTeams(db).find((x) => x.name === "Cloud9")
    expect(c9).toBeDefined()
    expect(c9!.round_win_rate).toBeGreaterThan(0.3)
    expect(c9!.round_win_rate).toBeLessThan(0.7)
  })
})

describe("unpackTable", () => {
  it("restores booleans and round ids", () => {
    const rows = unpackTable<{ round_id: string; ok: boolean }>({ cols: ["round_id", "ok"], bools: ["ok"], refs: { round_id: "rounds" }, rows: [[1, 1], [0, 0]] }, ["r0", "r1"])
    expect(rows).toEqual([{ round_id: "r1", ok: true }, { round_id: "r0", ok: false }])
  })
})
