import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { AIError, generateJSON, toAIError } from "@/lib/kl/ai"
import { getDb } from "@/lib/data"
import { buildChatFacts, chatFallbackAnswer, CHAT_SCHEMA } from "@/lib/llm/chat-facts"
import { COACH_SYSTEM } from "@/lib/llm/coach"
import { checkAiLimit } from "@/lib/llm/limits"

export const maxDuration = 30

const id = z.string().max(80).optional()
const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }))
    .min(1)
    .max(30),
  page: z.object({ page: z.string().max(40).optional(), seriesId: id, teamId: id, playerId: id, tournamentId: id, gameId: id }).optional(),
})

/** Recent turns only, trimmed: older context costs tokens and rarely changes the answer. */
const HISTORY_TURNS = 4
const HISTORY_CHARS = 400
/** Output cap: a 90-word answer is ~130 tokens; the rest is room for low-effort reasoning. */
const MAX_OUTPUT_TOKENS = 500

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  const last = parsed.success ? parsed.data.messages.at(-1) : undefined
  if (!parsed.success || last?.role !== "user") {
    return NextResponse.json({ error: { code: "bad_request", message: "Send a question to ask." } }, { status: 400 })
  }
  const limited = checkAiLimit(req)
  if (limited) return limited

  const question = last.content.slice(0, 500)
  const facts = buildChatFacts(getDb(), parsed.data.page ?? {}, question)
  const history = parsed.data.messages
    .slice(-1 - HISTORY_TURNS, -1)
    .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.content.slice(0, HISTORY_CHARS)}`)
    .join("\n")

  try {
    const out = await generateJSON<{ answer: string; follow_up: string | null }>({
      system: `${COACH_SYSTEM} If the data can't answer, say so and suggest what to open in the app.`,
      user: `Data:\n${facts.lines.join("\n")}\n${history ? `\nEarlier:\n${history}\n` : ""}\nQuestion: ${question}`,
      schema: CHAT_SCHEMA,
      reasoningEffort: "low",
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      timeoutMs: 15_000,
      label: "chat",
      signal: req.signal,
    })
    return NextResponse.json({ answer: out.answer, follow_up: out.follow_up, stats: facts.stats, source: "ai" })
  } catch (err) {
    const e = err instanceof AIError ? err : toAIError(err)
    console.warn(`[ai] fallback label=chat code=${e.code}`, e.detail)
    return NextResponse.json({ answer: chatFallbackAnswer(facts, question), follow_up: null, stats: facts.stats, source: "fallback" })
  }
}
