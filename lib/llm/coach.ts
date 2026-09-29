import "server-only"
import { AIError, generateJSON, toAIError } from "@/lib/kl/ai"
import type { CoachNote } from "./coach-types"

export type { CoachNote, CoachPoint } from "./coach-types"

/*
 * The AI coach: one strict-schema call to the org's OpenAI model, used by the chat, the match
 * review and the round and player write-ups. Token plan (docs/AI.md):
 * - the model only sees computed summaries (a few hundred tokens), never event logs;
 * - effort "low" and a 600-token output cap;
 * - every call has a written fallback built from the same numbers, so a missing key, an empty
 *   quota or a timeout still gives the reader a coaching note.
 */

export const COACH_SYSTEM =
  "You are a VALORANT esports coach reviewing pro match data. Use only the numbers given; never invent stats. " +
  "Write plain, direct English for players and coaches. Each point is one sentence that cites a number."

/** Strict mode: sealed objects, every field required, no maxItems (the prompt asks for 2 to 4). */
export const COACH_SCHEMA = {
  name: "coach_note",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["headline", "points", "next_step"],
    properties: {
      headline: { type: "string", description: "One sentence: the story of the data." },
      points: {
        type: "array",
        description: "2 to 4 findings.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["kind", "title", "detail"],
          properties: {
            kind: { type: "string", enum: ["strength", "weakness", "pattern"] },
            title: { type: "string", description: "Up to 6 words." },
            detail: { type: "string", description: "One sentence citing a number." },
          },
        },
      },
      next_step: { type: "string", description: "One concrete thing to practise next." },
    },
  },
} as const

export interface CoachResult {
  note: CoachNote
  source: "ai" | "fallback"
  model: string
  tokens_used: number
}

/** Output cap: a note is ~150 words; 600 leaves room for low-effort reasoning tokens. */
const MAX_OUTPUT_TOKENS = 600

/**
 * Asks the model for a coaching note on `facts`; on any failure returns `fallback()` instead.
 * `task` is one line saying what to write ("Review this series for Cloud9").
 */
export async function coachNote(opts: {
  task: string
  facts: string
  fallback: () => CoachNote
  label: string
  signal?: AbortSignal
}): Promise<CoachResult> {
  let tokens = 0
  try {
    const note = await generateJSON<CoachNote>({
      system: COACH_SYSTEM,
      user: `${opts.task}\n\nData:\n${opts.facts}`,
      schema: COACH_SCHEMA as unknown as { name: string; schema: Record<string, unknown> },
      reasoningEffort: "low",
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      timeoutMs: 15_000,
      label: opts.label,
      signal: opts.signal,
      onUsage: (u) => {
        tokens = u.input + u.output
      },
    })
    return { note: { ...note, points: note.points.slice(0, 4) }, source: "ai", model: "gpt-5.4-mini", tokens_used: tokens }
  } catch (err) {
    const e = err instanceof AIError ? err : toAIError(err)
    // Loud on purpose: a silent fallback hides an empty quota for weeks (kit docs/web/ai.md).
    console.warn(`[ai] fallback label=${opts.label} code=${e.code}`, e.detail)
    return { note: opts.fallback(), source: "fallback", model: "fallback", tokens_used: 0 }
  }
}

/** Renders a note as the short markdown the report and chat panels show. */
export function noteToMarkdown(note: CoachNote): string {
  const label = { strength: "Strength", weakness: "Fix", pattern: "Pattern" } as const
  return [
    note.headline,
    ...note.points.map((p) => `- **${label[p.kind]}: ${p.title}.** ${p.detail}`),
    `**Next:** ${note.next_step}`,
  ].join("\n")
}
