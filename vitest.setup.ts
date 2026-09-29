import { beforeEach, vi } from "vitest"

// Owner rule (2026-09-29): unit tests never reach a real model. Any fetch a test hasn't stubbed
// fails loudly instead of going out to api.openai.com.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: unknown) => {
      throw new Error(`Unstubbed fetch in a unit test: ${String(input)}`)
    }),
  )
})
