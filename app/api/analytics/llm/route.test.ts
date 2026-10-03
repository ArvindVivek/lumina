import { afterEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { NextRequest } from "next/server"
import { POST } from "./route"

// The write-up route with the model mocked at fetch. Owner rule (2026-10-02): the browser never
// sees the AI vendor or model name, so the JSON carries `source` only.
const ROUND = "1bd3eda3-5917-4daf-978c-84c16b81bfc2_2"

describe("POST /api/analytics/llm", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("returns the model's note without naming the model or its vendor", async () => {
    process.env.OPENAI_API_KEY = "sk-test"
    const note = { headline: "Cloud9 held the plant.", points: [{ kind: "strength", title: "Fast retake read", detail: "3 of 4 players lived." }], next_step: "Drill the post-plant." }
    vi.stubGlobal("fetch", vi.fn(async () =>
      Response.json({ choices: [{ message: { content: JSON.stringify(note) }, finish_reason: "stop" }], usage: { prompt_tokens: 200, completion_tokens: 60 } }),
    ))
    const res = await POST(new NextRequest("http://x/api/analytics/llm", { method: "POST", body: JSON.stringify({ query_type: "round_analysis", round_id: ROUND }), headers: { "x-forwarded-for": "4.4.4.4" } }))
    const text = await res.text()
    const body = JSON.parse(text)
    expect(res.status).toBe(200)
    expect(body.source).toBe("ai")
    expect(body.note.headline).toBe("Cloud9 held the plant.")
    expect(body).not.toHaveProperty("model")
    expect(text).not.toMatch(/openai|gpt-/i)
  })
})
