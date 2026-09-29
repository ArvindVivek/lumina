import { describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { makeDb, C9 } from "@/lib/data/testing"
import { detectAntiStratSignalsFrom, detectForcedMistakesFrom, mapMetricsFrom, playerOpeningDuelsFrom, roundContextFrom, seriesSummaryFrom } from "@/lib/analytics/coaching-queries"
import { matchReviewFacts, matchReviewFallback, playerFallback, roundFacts, roundFallback } from "./facts"
import { buildChatFacts, chatFallbackAnswer } from "./chat-facts"
import { COACH_SCHEMA, noteToMarkdown } from "./coach"
import { CHAT_SCHEMA } from "./chat-facts"
import { strictSchemaProblems } from "@/lib/kl/ai"

const db = makeDb()
const summary = seriesSummaryFrom(db, "series1", C9)!
const metrics = mapMetricsFrom(db, "series1", C9)
const duels = playerOpeningDuelsFrom(db, "series1", C9)

describe("AI contracts", () => {
  it("keeps both schemas inside OpenAI strict mode", () => {
    expect(strictSchemaProblems(COACH_SCHEMA.schema)).toEqual([])
    expect(strictSchemaProblems(CHAT_SCHEMA.schema)).toEqual([])
  })

  it("sends computed summaries, not event logs (token budget)", () => {
    const facts = matchReviewFacts(summary, metrics, duels, detectAntiStratSignalsFrom(db, "series1", C9), detectForcedMistakesFrom(db, "series1", C9))
    expect(facts).toContain("Cloud9 vs Sentinels: won 1-0")
    // ~4 characters a token: a whole series stays well under 500 input tokens.
    expect(facts.length).toBeLessThan(2000)
  })
})

describe("written fallbacks", () => {
  it("reviews a series from the numbers alone", () => {
    const note = matchReviewFallback(summary, metrics, duels, [], detectForcedMistakesFrom(db, "series1", C9))
    expect(note.headline).toBe("Cloud9 beat Sentinels 1-0 over 4 rounds.")
    expect(note.points.length).toBeGreaterThanOrEqual(2)
    expect(note.points.length).toBeLessThanOrEqual(4)
    expect(noteToMarkdown(note)).toContain("**Next:**")
  })

  it("describes a player and a round", () => {
    const d = duels.find((x) => x.player_id === "c1")!
    expect(playerFallback("C9 Player 1", d, { situations: 0, wins: 0 }, 1 / 3).points[1].detail).toBe("Teammates traded 33% of C9 Player 1's deaths.")
    const r = roundContextFrom(db, "g1_2")!
    expect(roundFallback(r).headline).toBe("Round 2 on Lotus ended: team wiped.")
    expect(roundFacts(r)).toContain("5s C9 Player 1 (jett) killed SEN Player 1 (jett)")
  })
})

describe("chat facts", () => {
  it("describes the series on screen", () => {
    const f = buildChatFacts(db, { page: "series", seriesId: "series1" }, "why did they win?")
    expect(f.subject).toBe("Cloud9 vs Sentinels")
    expect(f.stats[0]).toEqual({ label: "Series", value: "1-0" })
  })

  it("adds a player the question names", () => {
    const f = buildChatFacts(db, { page: "dashboard" }, "Tell me about C9 Player 4")
    expect(f.subject).toBe("C9 Player 4")
    expect(f.lines.some((l) => l.startsWith("C9 Player 4 (Cloud9)"))).toBe(true)
  })

  it("answers with numbers when the AI can't", () => {
    const f = buildChatFacts(db, { page: "team", teamId: C9 }, "how are they?")
    expect(chatFallbackAnswer(f)).toMatch(/^The AI coach can't answer right now, so here are the numbers for Cloud9\. Cloud9: series 1-0/)
  })
})
