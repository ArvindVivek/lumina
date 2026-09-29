import { describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { makeDb, C9, SEN } from "@/lib/data/testing"
import {
  calculateVODPriority,
  detectAntiStratSignalsFrom,
  detectForcedMistakesFrom,
  findSimilarScenariosFrom,
  mapMetricsFrom,
  playerOpeningDuelsFrom,
  roundContextFrom,
  roundsForReviewFrom,
  seriesSummaryFrom,
} from "./coaching-queries"

const db = makeDb()

describe("coaching report", () => {
  it("summarises the series from the chosen team's side", () => {
    expect(seriesSummaryFrom(db, "series1", SEN)).toMatchObject({ result: "loss", score: "0-1", team_name: "Sentinels", opponent_name: "Cloud9", total_rounds: 4 })
    expect(seriesSummaryFrom(db, "series1", "nobody")).toBeNull()
  })

  it("computes per-map first blood, trades and post-plant", () => {
    const [m] = mapMetricsFrom(db, "series1", C9)
    expect(m).toMatchObject({ score: "3-1", fb_win_rate: 0.5, fb_conversion_rate: 0.5, untraded_deaths: 6, post_plant_win_rate: 0.5 })
    expect(m.trade_rate).toBeCloseTo(1 / 7)
  })

  it("orders opening duels by net", () => {
    const rows = playerOpeningDuelsFrom(db, "series1", SEN)
    expect(rows[0]).toMatchObject({ player_id: "s1", first_kills: 2, first_deaths: 1, net: 1 })
  })

  it("rates rounds for review with the real sides and running score", () => {
    const rows = roundsForReviewFrom(db, "series1", C9)
    expect(rows.map((r) => [r.round_number, r.side, r.score_before])).toEqual([
      [1, "attack", "0-0"], [2, "attack", "1-0"], [13, "defense", "1-1"], [14, "defense", "2-1"],
    ])
    expect(rows[1]).toMatchObject({ result: "loss", review_priority: "critical" })
  })

  it("flags lost post-plant defuses as critical (bug: compared to 'defuse', never matched)", () => {
    const rows = roundsForReviewFrom(db, "series1", SEN)
    const r13 = rows.find((r) => r.round_number === 13)!
    expect(r13.winning_condition).toBe("spike_defuse")
    expect(r13.review_priority).toBe("critical")
  })

  it("builds a round context with the attacker and the counts at the plant", () => {
    const r = roundContextFrom(db, "g1_13")!
    expect(r).toMatchObject({ attacker_team_id: SEN, alive_at_plant: { attackers: 5, defenders: 4 }, team_a_score: 1, team_b_score: 1 })
    expect(r.kill_timeline[0]).toMatchObject({ killer_name: "SEN Player 1", victim_agent: "jett", is_first_kill: true })
    expect(r.spike_events.map((e) => e.event_type)).toEqual(["plant", "defuse"])
    expect(roundContextFrom(db, "missing")).toBeNull()
  })

  it("finds similar situations, planted ones at the plant", () => {
    const m = findSimilarScenariosFrom(db, 4, 4, true)
    expect(m[0]).toMatchObject({ round_id: "g1_2", attacker_alive: 4, defender_alive: 4, similarity_score: 1 })
  })

  it("needs three first deaths on a map before calling it a pattern", () => {
    expect(detectAntiStratSignalsFrom(db, "series1", C9)).toEqual([])
  })

  it("reports maps with 3+ untraded deaths in a round", () => {
    expect(detectForcedMistakesFrom(db, "series1", C9)).toEqual([
      expect.objectContaining({ mistake: "Isolated deaths on Lotus", severity: "low", rounds_impacted: 1 }),
    ])
  })
})

describe("review priority", () => {
  it("doesn't call a plain wipe critical (it flagged 40% of real rounds)", () => {
    expect(calculateVODPriority(false, 5, false, true, [], false, "elimination").priority).toBe("high")
    expect(calculateVODPriority(false, 4, false, true, [], false, "elimination").priority).toBe("medium")
  })
  it("keeps winnable losses critical, in plain words", () => {
    expect(calculateVODPriority(false, 2, true, true, [], false, "elimination")).toEqual({ priority: "critical", reason: "Got the first kill but lost the round." })
  })
})
