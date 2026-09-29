/**
 * What "normal" looks like in pro play, measured on the bundled sample (players with 150+
 * rounds, all ten teams; 2026-09-29). Each pair is the 25th and 75th percentile: below `low` is
 * worth fixing, above `high` is a strength, anything between reads as typical. The old
 * hackathon thresholds (e.g. "70% of deaths traded is excellent") came from made-up data and
 * called every pro below average.
 */
export const BENCH = {
  player: {
    /** Share of the player's deaths a teammate traded within 5 s. */
    tradeRate: { low: 0.23, high: 0.28 },
    /** Share of opening duels won. */
    openingSuccess: { low: 0.44, high: 0.54 },
    /** Rounds lost after dying first with no kill or assist. */
    firstDeathLoss: { low: 0.67, high: 0.8 },
    /** Clutches won as the last player alive. */
    clutchRate: { low: 0.11, high: 0.17 },
    /** Share of rounds with 2+ kills. */
    multiKillRate: { low: 0.145, high: 0.193 },
  },
  team: {
    pistolWinRate: { low: 0.45, high: 0.56 },
    /** Rounds won after getting the first kill. */
    firstBloodConversion: { low: 0.66, high: 0.75 },
    /** Teams trade within a narrow range, so this pair is the 10th and 90th percentile. */
    tradeRate: { low: 0.232, high: 0.268 },
    ecoWinRate: { low: 0.32, high: 0.39 },
    fullBuyWinRate: { low: 0.505, high: 0.566 },
    /** Seconds from the end of the buy phase to the first kill. */
    firstKillSeconds: { low: 30.6, high: 34 },
    /** Rounds won when at least one ultimate was charged. */
    ultWinRate: { low: 0.446, high: 0.528 },
  },
} as const

export type Band = "low" | "typical" | "high"

export function band(value: number, b: { low: number; high: number }): Band {
  if (value < b.low) return "low"
  if (value > b.high) return "high"
  return "typical"
}

export const pctText = (x: number) => `${Math.round(x * 100)}%`
