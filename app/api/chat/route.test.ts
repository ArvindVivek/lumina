import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("server-only", () => ({}))
import { NextRequest } from "next/server"
import { POST } from "./route"

// The chat route against the real fixture, with OpenAI mocked at fetch: the org key is out of
// credits, so the fallback path is what production serves until it's topped up.
const ask = (body: unknown, ip = "1.1.1.1") =>
  POST(new NextRequest("http://x/api/chat", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": ip } }))

const question = (content: string, page = {}) => ({ messages: [{ role: "user", content }], page })

describe("POST /api/chat", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "sk-test"
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("answers from the model with one compact, strict request", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        choices: [{ message: { content: JSON.stringify({ answer: "Cloud9 won 3 of 4.", follow_up: null }) }, finish_reason: "stop" }],
        usage: { prompt_tokens: 300, completion_tokens: 40 },
      }),
    )
    vi.stubGlobal("fetch", fetchMock)
    const res = await ask(question("How is Cloud9 doing?"), "2.2.2.2")
    const body = await res.json()
    expect(body).toMatchObject({ answer: "Cloud9 won 3 of 4.", source: "ai" })
    expect(body.stats.length).toBeGreaterThan(0)
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(sent.model).toBe("gpt-5.4-mini")
    expect(sent.reasoning_effort).toBe("low")
    expect(sent.response_format.json_schema.strict).toBe(true)
    // Token budget: the whole prompt stays small (no schema dump, no event logs).
    expect(sent.messages[1].content.length).toBeLessThan(3000)
  })

  it("falls back to the numbers when the quota is empty, without retrying", async () => {
    const fetchMock = vi.fn(async () => new Response('{"error":{"code":"insufficient_quota"}}', { status: 429 }))
    vi.stubGlobal("fetch", fetchMock)
    vi.spyOn(console, "warn").mockImplementation(() => {})
    const res = await ask(question("Tell me about aspas"), "3.3.3.3")
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.source).toBe("fallback")
    expect(body.answer).toMatch(/^The AI coach can't answer right now, so here are the numbers for aspas\./)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("rejects an empty or assistant-last conversation before spending anything", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    expect((await ask({ messages: [] })).status).toBe(400)
    expect((await ask({ messages: [{ role: "assistant", content: "hi" }] })).status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("limits each visitor to 20 answers an hour", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 500 })))
    vi.spyOn(console, "warn").mockImplementation(() => {})
    for (let i = 0; i < 20; i++) expect((await ask(question("hi"), "9.9.9.9")).status).toBe(200)
    const res = await ask(question("hi"), "9.9.9.9")
    expect(res.status).toBe(429)
    expect((await res.json()).error.code).toBe("rate_limited")
  })
})
