import { describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { attackerOf, buildDb, playerRounds, replayRound, sideOf, teamRounds } from "./db"
import { C9, SEN, makeDb, makeTables } from "./testing"

describe("buildDb", () => {
  it("drops GRID's (1) suffix from team names", () => {
    expect(makeDb().team.get(SEN)?.name).toBe("Sentinels")
  })

  it("gives each player the team of their newest series, not the last one processed", () => {
    const t = makeTables()
    // c1 also played an older series for Sentinels; the newer Cloud9 series must win.
    t.series.push({ id: "old", tournament_id: "tour1", start_time: "2024-01-01T00:00:00Z", format: null, team_a_id: SEN, team_b_id: C9, winner_id: SEN })
    t.games.push({ id: "g0", series_id: "old", sequence_number: 1, map_name: "bind", team_a_score: 13, team_b_score: 0, winner_id: SEN, duration_ms: null })
    t.rounds.push({ ...t.rounds[0], id: "g0_1", game_id: "g0" })
    t.player_round_stats.push({ ...t.player_round_stats[0], round_id: "g0_1", team_id: SEN })
    t.players[0].team_id = SEN
    expect(buildDb(t).player.get("c1")?.team_id).toBe(C9)
  })

  it("sorts rounds and kills in play order", () => {
    const db = makeDb()
    expect(db.roundsByGame.get("g1")?.map((r) => r.round_number)).toEqual([1, 2, 13, 14])
    const times = db.killsByRound.get("g1_1")!.map((k) => k.game_time_ms)
    expect(times).toEqual([...times].sort((a, b) => a - b))
  })
})

describe("sides", () => {
  it("reads the logged side instead of guessing from the round number", () => {
    const db = makeDb()
    const r13 = db.round.get("g1_13")!
    expect(sideOf(r13, true)).toBe("defense")
    expect(sideOf(r13, false)).toBe("attack")
    expect(attackerOf(db, r13)).toBe(SEN)
  })
})

describe("replayRound", () => {
  it("finds the 1v4 clutch when it starts, not at round end", () => {
    const clutches = replayRound(makeDb(), "g1_1").clutches
    expect(clutches).toEqual([{ playerId: "s5", teamId: SEN, opponentsAlive: 4, timeMs: 50000 }])
  })

  it("counts players alive at the plant", () => {
    expect(replayRound(makeDb(), "g1_2").atPlant).toEqual({ attackersAlive: 4, defendersAlive: 4, timeMs: 20000 })
    expect(replayRound(makeDb(), "g1_13").atPlant).toEqual({ attackersAlive: 5, defendersAlive: 4, timeMs: 30000 })
    expect(replayRound(makeDb(), "g1_14").atPlant).toBeNull()
  })
})

describe("joins", () => {
  it("lists a team's rounds with its side of the series", () => {
    const rows = teamRounds(makeDb(), SEN)
    expect(rows).toHaveLength(4)
    expect(rows.every((r) => r.isTeamA === false)).toBe(true)
    expect(teamRounds(makeDb(), C9, { mapName: "bind" })).toHaveLength(0)
  })

  it("filters a player's rounds by tournament and series", () => {
    expect(playerRounds(makeDb(), "c1")).toHaveLength(4)
    expect(playerRounds(makeDb(), "c1", { tournamentId: "nope" })).toHaveLength(0)
    expect(playerRounds(makeDb(), "c1", { seriesId: "series1" })).toHaveLength(4)
  })
})
