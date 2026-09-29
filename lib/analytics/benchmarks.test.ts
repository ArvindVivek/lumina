import { describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { BENCH, band } from "./benchmarks"
import { tradingInsight } from "./player-insights"
import { getDb } from "@/lib/data"

describe("benchmarks", () => {
  it("bands a value against the sample's middle half", () => {
    expect(band(0.2, BENCH.player.tradeRate)).toBe("low")
    expect(band(0.25, BENCH.player.tradeRate)).toBe("typical")
    expect(band(0.3, BENCH.player.tradeRate)).toBe("high")
  })

  it("calls most real pros typical, not 'poor' (bug: 70% traded was the old bar)", async () => {
    const db = getDb()
    const levels = await Promise.all(db.players.map((p) => tradingInsight(p.id)))
    const low = levels.filter((l) => l?.insight.startsWith("Deaths are traded less")).length
    expect(low / levels.length).toBeLessThan(0.4)
  })
})
