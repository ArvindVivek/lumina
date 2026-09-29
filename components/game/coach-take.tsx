"use client"

import { useState } from "react"
import { Info, Sparkles } from "lucide-react"
import { Button, Icon } from "@/components/kl"
import type { CoachNote } from "@/lib/llm/coach-types"

const KIND_LABEL = { strength: "Strength", weakness: "Fix", pattern: "Pattern" } as const

/** The coach's note, shown after the reader asks for it. */
export function CoachNoteView({ note, source }: { note: CoachNote; source: "ai" | "fallback" }) {
  return (
    <div className="space-y-3 rounded-md bg-accent-soft p-4">
      {source === "fallback" && (
        <p className="flex items-center gap-1.5 text-[13px] font-bold text-ink-2">
          <Icon icon={Info} size={15} />
          AI unavailable right now: this note is written from the numbers.
        </p>
      )}
      <p className="font-bold text-ink">{note.headline}</p>
      <ul className="space-y-2">
        {note.points.map((p, i) => (
          <li key={i} className="text-[15px] text-ink">
            <span className="font-bold">{KIND_LABEL[p.kind]}: {p.title}.</span> {p.detail}
          </li>
        ))}
      </ul>
      <p className="text-[15px] text-ink">
        <span className="font-bold">Next: </span>
        {note.next_step}
      </p>
    </div>
  )
}

/**
 * A button that asks /api/analytics/llm for a write-up. Nothing is sent until it's pressed,
 * so browsing never spends AI tokens.
 */
export function CoachTake({ body, label = "Coach's take" }: { body: Record<string, string>; label?: string }) {
  const [state, setState] = useState<{ status: "idle" | "loading" | "done" | "error"; note?: CoachNote; source?: "ai" | "fallback"; message?: string }>({ status: "idle" })

  async function ask() {
    setState({ status: "loading" })
    try {
      const res = await fetch("/api/analytics/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.note) {
        setState({ status: "error", message: data?.error?.message ?? "The coach couldn't write this one. Try again in a minute." })
        return
      }
      setState({ status: "done", note: data.note, source: data.source })
    } catch (err) {
      console.error("[coach] request failed", err)
      setState({ status: "error", message: "We couldn't reach the coach. Check your connection and try again." })
    }
  }

  if (state.status === "done" && state.note) return <CoachNoteView note={state.note} source={state.source ?? "ai"} />
  return (
    <div className="space-y-2">
      <Button variant="secondary" size="sm" icon={Sparkles} loading={state.status === "loading"} onClick={ask}>
        {label}
      </Button>
      {state.status === "error" && <p className="text-[15px] text-danger-text">{state.message}</p>}
    </div>
  )
}
