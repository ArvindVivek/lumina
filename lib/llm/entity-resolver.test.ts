import { describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { makeDb, C9, SEN } from "@/lib/data/testing"
import { findTeams, recentSeriesForPlayer, resolveEntitiesFrom } from "./entity-resolver"

const db = makeDb()

describe("entity resolver", () => {
  it("finds two teams and their match", () => {
    const r = resolveEntitiesFrom(db, "How did C9 beat Sentinels?")
    expect(r.queryType).toBe("match")
    expect(r.series[0].id).toBe("series1")
  })
  it("matches whole words only, ignoring accents and case", () => {
    expect(findTeams(db, "cloud9 fans").map((t) => t.id)).toEqual([C9])
    expect(findTeams(db, "sentinelsss")).toEqual([])
    expect(findTeams(db, "SEN")).toEqual([{ id: SEN, name: "Sentinels" }])
  })
  it("treats a question with no names as general", () => {
    expect(resolveEntitiesFrom(db, "who plays best?").queryType).toBe("general")
  })
  it("lists a player's recent series with their team", () => {
    expect(recentSeriesForPlayer(db, "s1")).toEqual([{ series_id: "series1", team_id: SEN, team_name: "Sentinels", opponent_name: "Cloud9" }])
  })
})
