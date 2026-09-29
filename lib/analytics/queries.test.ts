import { describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { makeDb, C9, SEN } from "@/lib/data/testing"
import {
  agentPerformanceFrom,
  clutchPerformanceFrom,
  ecoRoundPerformanceFrom,
  firstDeathImpactFrom,
  multiKillRoundsFrom,
  openingDuelsFrom,
  tradingEfficiencyFrom,
} from "./queries"
import {
  economyManagementFrom,
  firstBloodConversionFrom,
  openingDuelsByPlayerFrom,
  pistolAnalysisFrom,
  roundBreakdownFrom,
  roundsForCriticalMomentsFrom,
  timingPatternsFrom,
  tradeDisciplineFrom,
  ultimateEconomyFrom,
} from "./macro-queries"

const db = makeDb()

describe("player insights (PLAY-01..07)", () => {
  it("counts rounds lost after a first death with no kill or assist", () => {
    expect(firstDeathImpactFrom(db, "c1")).toEqual({ losses: "0", total: "2" })
  })
  it("counts traded deaths", () => {
    expect(tradingEfficiencyFrom(db, "c1")).toEqual({ traded: "1", total_deaths: "3" })
  })
  it("counts opening duels", () => {
    expect(openingDuelsFrom(db, "c1")).toEqual({ first_kills: "1", first_deaths: "2", total_rounds: "4" })
  })
  it("counts clutches", () => {
    expect(clutchPerformanceFrom(db, "c5")).toEqual({ clutches_won: "0", clutch_situations: "1" })
  })
  it("groups by agent", () => {
    expect(agentPerformanceFrom(db, "c1")).toEqual([
      { agent: "jett", rounds_played: "4", total_kills: "1", total_deaths: "3", first_kills: "1", first_deaths: "2", rounds_won: "3" },
    ])
  })
  it("counts multi-kill rounds", () => {
    expect(multiKillRoundsFrom(db, "c4")).toEqual({
      two_plus_kills: "1", three_plus_kills: "1", four_plus_kills: "0", aces: "0", total_rounds: "4", total_kills: "4",
    })
  })
  it("groups by round type, alphabetically", () => {
    expect(ecoRoundPerformanceFrom(db, "c4").map((r) => [r.phase, r.rounds, r.total_kills, r.rounds_won])).toEqual([
      ["force", "1", "0", "0"],
      ["full", "1", "3", "1"],
      ["pistol", "2", "1", "2"],
    ])
  })
  it("filters by tournament", () => {
    expect(openingDuelsFrom(db, "c1", "other")).toEqual({ first_kills: "0", first_deaths: "0", total_rounds: "0" })
  })
})

describe("team insights (MACRO-01..08)", () => {
  it("scores pistol and bonus rounds", () => {
    expect(pistolAnalysisFrom(db, C9)).toEqual({
      pistol_rounds: "2", pistol_wins: "2", bonus_wins: "1", total_bonus_rounds: "2", pistol_win_rate: "100.00",
    })
    expect(pistolAnalysisFrom(db, C9, undefined, "bind").pistol_rounds).toBe("0")
  })
  it("converts first bloods", () => {
    expect(firstBloodConversionFrom(db, C9)).toEqual({ first_bloods: "2", first_blood_wins: "1", first_blood_conversion_rate: "50.00" })
  })
  it("measures trade discipline", () => {
    expect(tradeDisciplineFrom(db, C9)).toEqual({
      total_deaths: "7", traded_deaths: "1", first_deaths: "2", first_deaths_traded: "1",
      overall_trade_rate: "14.29", first_death_trade_rate: "50.00",
    })
  })
  it("orders players by first kills", () => {
    const rows = openingDuelsByPlayerFrom(db, C9)
    expect(rows[0]).toMatchObject({ first_kills: "1" })
    expect(rows).toHaveLength(5)
  })
  it("splits rounds by buy", () => {
    expect(economyManagementFrom(db, C9)).toEqual([
      { economy_decision: "eco", rounds: "2", wins: "2", win_rate: "1.000", avg_loadout_value: "3900" },
      { economy_decision: "full_buy", rounds: "2", wins: "1", win_rate: "0.500", avg_loadout_value: "21500" },
    ])
  })
  it("averages round length and first-kill time", () => {
    expect(timingPatternsFrom(db, C9)).toEqual({ avg_round_duration_ms: "44250", avg_first_kill_time_ms: "12500", rounds_analyzed: "4" })
  })
  it("tracks ultimates", () => {
    expect(ultimateEconomyFrom(db, C9)).toEqual({
      total_rounds: "20", ultimates_used: "2", usage_rate: "0.100", rounds_with_ult_available: "2", ult_availability_win_rate: "0.500",
    })
  })
  it("reads loadouts from the team's own side of each series (bug: first game in the database decided it)", () => {
    const rows = roundBreakdownFrom(db, SEN)
    expect(rows[0]).toMatchObject({ round_number: "1", team_loadout_value: "3800", opponent_loadout_value: "3900", first_blood_team_id: SEN })
    expect(roundBreakdownFrom(db, "nobody")).toEqual([])
  })
  it("flags whether the first death was traded", () => {
    const rows = roundsForCriticalMomentsFrom(db, C9)
    expect(rows.find((r) => r.round_number === 1)?.first_death_traded).toBe(true)
    expect(rows.find((r) => r.round_number === 13)?.first_death_traded).toBe(false)
    expect(rows.find((r) => r.round_number === 2)?.is_eco_round).toBe(false)
  })
})

import { classifyCriticalMoment } from "./priority-classifier"

describe("critical moments", () => {
  const base = { round_id: "r", round_number: 5, game_id: "g", winning_team_id: C9, team_a_alive: 1, team_b_alive: 0, team_loadout_value: 20000, spike_planted: false, first_death_traded: true, is_pistol_round: false, is_eco_round: false }
  it("makes a close lost pistol must-watch", () => {
    const m = classifyCriticalMoment({ ...base, round_number: 1, is_pistol_round: true, winning_team_id: SEN }, C9)
    expect(m).toMatchObject({ priority: "HIGH", description: "Lost the pistol round. Finished with at most one player between the teams." })
  })
  it("doesn't call a won pistol an eco win (bug: pistols are under 10k)", () => {
    const rows = roundsForCriticalMomentsFrom(db, C9)
    expect(rows.find((r) => r.round_number === 1)?.is_eco_round).toBe(false)
  })
  it("leaves an ordinary untraded first death low", () => {
    expect(classifyCriticalMoment({ ...base, team_a_alive: 4, first_death_traded: false }, C9)?.priority ?? "none").not.toBe("HIGH")
  })
})
