import { expect, test } from "@playwright/test"

// Opt-in: spends real OpenAI tokens (about 4 calls, under 3k tokens in all). Run once, after the
// org key has credits:  E2E_LIVE_AI=1 npx playwright test e2e/live-ai.spec.ts --project=desktop
test.skip(process.env.E2E_LIVE_AI !== "1", "live AI checks are opt-in (E2E_LIVE_AI=1)")

const SERIES = "2843060"
const C9 = "79"
const ROUND = "1bd3eda3-5917-4daf-978c-84c16b81bfc2_2"

test("chat answers from the model", async ({ request }) => {
  const res = await request.post("/api/chat", { data: { messages: [{ role: "user", content: "Who won the opening duels?" }], page: { page: "series", seriesId: SERIES } } })
  const body = await res.json()
  expect(res.status()).toBe(200)
  expect(body.source).toBe("ai")
  expect(body.answer.length).toBeGreaterThan(20)
})

test("match review and round take come from the model", async ({ request }) => {
  for (const data of [{ query_type: "match_review", series_id: SERIES, team_focus: C9 }, { query_type: "round_analysis", round_id: ROUND }]) {
    const body = await (await request.post("/api/analytics/llm", { data })).json()
    expect(body.source, data.query_type).toBe("ai")
    expect(body.note.points.length).toBeGreaterThanOrEqual(1)
  }
})
