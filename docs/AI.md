# AI in Lumina

One model, one org key, called only when a reader asks. Everything else in Lumina is computed from
the bundled match data and works with no AI at all.

## Where it's used

| Surface | Route | Label in logs | Trigger |
|---|---|---|---|
| Ask the coach (chat panel, every page) | `POST /api/chat` | `chat` | Send button |
| Coach's take on a round (map page) | `POST /api/analytics/llm` `round_analysis` | `round_analysis` | Button |
| Coach's review (Match report) | `POST /api/analytics/llm` `match_review` | `match_review` | Button |
| API only: player write-up, free question, `/api/ask` | `/api/analytics/llm`, `/api/ask` | `player_analysis`, `question` | Request |
| API only: `include_llm=true` on coaching-report, hypothetical, round-decision | those routes | `match_review`, `hypothetical`, `round_decision` | Request flag |

No cron, no background job and no page load ever calls the model (web release standard, "No
recurring costs").

## Token plan

- **Model:** `gpt-5.4-mini` through `lib/kl/ai.ts` (KL Web), `reasoning_effort: "low"`, strict JSON
  schemas (`COACH_SCHEMA` in `lib/llm/coach.ts`, `CHAT_SCHEMA` in `lib/llm/chat-facts.ts`; both
  pinned by `lib/llm/facts.test.ts`).
- **Input is computed summaries, never event logs.** Measured on the fixture (characters / 4):
  system prompt ~52 tokens; chat facts 130-310 tokens (a series page with two named entities is
  the largest); match review facts ~285; round facts ~95; schemas 80-170. A whole request stays
  under ~700 input tokens. The old hackathon chat sent a database schema, 15 tool definitions and
  the raw on-screen data, then made a second call with tool results.
- **Output caps:** 600 tokens for coach notes (a note is ~150 words), 500 for chat (answer ≤ 90
  words). Chat history is the last 4 turns, 400 characters each.
- **One call per action**, no retries: the kit client makes a single request, and any failure
  goes straight to the fallback.
- **Limits** (`lib/llm/limits.ts`): 20 AI answers per visitor per hour, 300 per server instance
  per day. In memory, so they're a speed bump per instance, not a global quota.

## Fallbacks

Every AI surface has a rule-written answer from the same numbers (`lib/llm/facts.ts`,
`chatFallbackAnswer` in `lib/llm/chat-facts.ts`). The UI labels it ("AI unavailable: showing the
numbers") and the server logs `[ai] fallback label=… code=…`. A successful call logs
`[ai] provider: openai label=… in=… out=…`.

## Status (2026-09-29)

The org key is out of credits (`429 insufficient_quota`). Production serves the fallbacks until it's
topped up. The live AI path is **pending**: unit tests cover the request shape against a mocked
OpenAI response (`app/api/chat/route.test.ts`), but no real call has been recorded yet. After the
top-up, ask one chat question on the live site and check the Vercel runtime log for
`[ai] provider: openai label=chat`.
