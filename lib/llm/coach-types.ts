/** A short coaching note: what the AI coach returns, and what the written fallbacks build. */
export interface CoachPoint {
  kind: "strength" | "weakness" | "pattern"
  title: string
  detail: string
}

export interface CoachNote {
  headline: string
  points: CoachPoint[]
  next_step: string
}
