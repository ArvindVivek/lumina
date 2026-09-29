import { describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { makeDb } from "@/lib/data/testing"
import { calculateSaveRetakeEV, matchClutchFrom, matchForceEcoFrom, matchSaveRetakeFrom, postPlantSituations } from "./scenario-queries"

const db = makeDb()

describe("post-plant situations (SCEN-01)", () => {
  it("records alive counts at the plant and the defenders' loadout", () => {
    expect(postPlantSituations(db).map((s) => [s.round_id, s.attacker_alive, s.defender_alive, s.defender_economy, s.defender_won])).toEqual([
      ["g1_2", 4, 4, 8000, true],
      ["g1_13", 5, 4, 3900, true],
    ])
  })
  it("ranks by the weighted distance and keeps those under 0.25", () => {
    const m = matchSaveRetakeFrom(db, { defender_economy: 8000, defender_alive: 4, attacker_alive: 4 })
    expect(m.map((x) => x.round_id)).toEqual(["g1_2", "g1_13"])
    expect(m[0].similarity_score).toBeCloseTo(1)
    expect(m[1].similarity_score).toBeCloseTo(1 - (4100 / 25000) * 0.35 - 0.05)
    expect(matchSaveRetakeFrom(db, { defender_economy: 8000, defender_alive: 4, attacker_alive: 4, map_name: "bind" })).toEqual([])
  })
})

describe("EV (SCEN-02)", () => {
  it("recommends saving when retakes rarely win", () => {
    const ev = calculateSaveRetakeEV([], 3000)
    expect(ev.recommended_decision).toBe("save")
    expect(ev.save.expected_value).toBe(4900)
  })
})

describe("force/eco (SCEN-03)", () => {
  it("looks from both teams' side of each round", () => {
    const m = matchForceEcoFrom(db, { team_economy: 21000, opponent_economy: 8000 })
    expect(m).toHaveLength(1)
    expect(m[0]).toMatchObject({ round_id: "g1_2", team_economy: 21000, economy_category: "full_buy", opponent_category: "eco", team_won: false })
  })
})

describe("clutches (SCEN-04)", () => {
  it("matches the enemies alive when the clutch began (bug: used round-end counts)", () => {
    expect(matchClutchFrom(db, { clutch_player_count: 1, opponent_count: 4 }).map((m) => m.round_id).sort()).toEqual(["g1_1", "g1_2"])
    expect(matchClutchFrom(db, { clutch_player_count: 1, opponent_count: 5 }).map((m) => m.player_id)).toEqual(["s2"])
    expect(matchClutchFrom(db, { clutch_player_count: 1, opponent_count: 1 })).toEqual([])
  })
})
