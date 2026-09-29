import "server-only"
import { createRateLimiter, rateLimitKey, rateLimitedResponse } from "@/lib/kl/rate-limit"

/**
 * Per-visitor cap: 20 AI answers an hour covers a long review session and stops a script from
 * draining the shared key. In memory, so it's per server instance (a speed bump, not a vault).
 */
const perVisitor = createRateLimiter({ limit: 20, windowMs: 60 * 60 * 1000 })

/** Spend ceiling: at most 300 AI answers a day per server instance, whoever asks. */
const perInstance = createRateLimiter({ limit: 300, windowMs: 24 * 60 * 60 * 1000 })

/** Counts one AI request; returns a friendly 429 when a limit is hit, else null. */
export function checkAiLimit(req: Request): Response | null {
  const visitor = perVisitor.check(rateLimitKey(req))
  if (!visitor.ok) return rateLimitedResponse(visitor)
  const all = perInstance.check("all")
  if (!all.ok) {
    return rateLimitedResponse(all, "The AI coach has answered a lot of questions today. It'll be back tomorrow; the stats on every page still work.")
  }
  return null
}
