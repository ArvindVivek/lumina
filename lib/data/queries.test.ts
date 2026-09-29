import { describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { makeDb, C9 } from "./testing"
import { datasetStats, gameDetail, gameRounds, listPlayers, listSeries, listTeams, listTournaments, pageContext, scoreboard } from "./queries"

const db = makeDb()

describe("browse queries", () => {
  it("counts the dataset", () => {
    expect(datasetStats(db)).toMatchObject({ series: 1, games: 1, rounds: 4, killEvents: 19, clutchSituations: 3 })
  })
  it("lists series with scores and names", () => {
    expect(listSeries(db)[0]).toMatchObject({ team_a_name: "Cloud9", team_b_name: "Sentinels", team_a_score: 1, team_b_score: 0, maps: ["lotus"] })
    expect(listSeries(db, { teamId: "nobody" })).toEqual([])
  })
  it("summarises tournaments with the final's winner", () => {
    expect(listTournaments(db)[0]).toMatchObject({ series_count: 1, team_count: 2, champion_name: "Cloud9" })
  })
  it("ranks teams by series won", () => {
    const [top] = listTeams(db)
    expect(top).toMatchObject({ id: C9, series_won: 1, maps_won: 1, maps_lost: 0, round_win_rate: 0.75 })
  })
  it("lists players alphabetically with K/D", () => {
    const players = listPlayers(db)
    expect(players[0].name).toBe("C9 Player 1")
    expect(players.find((p) => p.id === "c4")).toMatchObject({ kills: 4, deaths: 1, kd: 4 })
  })
  it("details a game, its rounds and a scoreboard", () => {
    expect(gameDetail(db, "g1")).toMatchObject({ team_a_name: "Cloud9", map_name: "lotus" })
    expect(gameDetail(db, "nope")).toBeNull()
    expect(gameRounds(db, "g1")[1]).toMatchObject({ first_blood_player_name: "C9 Player 1", first_blood_team_id: C9, kills: 6 })
    expect(scoreboard(db, [db.game.get("g1")!])[0]).toMatchObject({ player_id: "c4", kills: 4 })
  })
  it("builds page context for the header and chat", () => {
    expect(pageContext(db, { page: "series", seriesId: "series1" })).toMatchObject({ type: "series", teamA: "Cloud9", teamB: "Sentinels" })
    expect(pageContext(db, { page: "player", playerId: "c1" })).toMatchObject({ playerName: "C9 Player 1", teamName: "Cloud9" })
    expect(pageContext(db, { page: "team", teamId: "nope" })).toEqual({})
  })
})
