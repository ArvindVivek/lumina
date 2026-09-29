"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/kl"
import { cn } from "@/lib/kl/cn"
import { credits, pct } from "@/components/lumina/format"

interface Decision {
  applicable: boolean
  message?: string
  round_context: { defender_alive?: number; attacker_alive?: number; defender_economy?: number }
  analysis?: {
    historical_matches: number
    ev_analysis: {
      retake: { expected_value: number; win_probability: number }
      save: { expected_value: number; guaranteed_retention: number }
      recommended_decision: "retake" | "save"
      ev_difference: number
    }
    actual_outcome: "success" | "failure"
    was_optimal: boolean
  }
}

/**
 * For a planted round: should the defenders have retaken or saved their guns? Numbers come from
 * /api/analytics/round-decision (similar post-plant rounds in the sample); no AI involved.
 */
export function RetakeCheck({ roundId }: { roundId: string }) {
  const [data, setData] = useState<Decision | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    fetch(`/api/analytics/round-decision/${roundId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`status ${r.status}`))))
      .then((d: Decision) => live && setData(d))
      .catch((err) => {
        console.error("[retake] failed", err)
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [roundId])

  if (failed) return <p className="text-[15px] text-ink-2">The save-or-retake numbers didn&apos;t load. Try opening the round again.</p>
  if (!data) return <p className="text-[15px] text-ink-2" aria-busy="true">Checking similar post-plant rounds…</p>
  if (!data.applicable || !data.analysis) return <p className="text-[15px] text-ink-2">{data.message ?? "No retake decision in this round."}</p>

  const { ev_analysis: ev, historical_matches, actual_outcome } = data.analysis
  const def = data.round_context.defender_alive
  const atk = data.round_context.attacker_alive
  const options = [
    { key: "retake", title: "Retake", lines: [`Won ${pct(ev.retake.win_probability)} of ${historical_matches} similar rounds`, "A win pays 3,000 credits each"] },
    { key: "save", title: "Save guns", lines: [`Keeps about ${credits(ev.save.guaranteed_retention)} credits of weapons`, "Plus the 1,900 loss bonus"] },
  ] as const

  return (
    <div className="space-y-3">
      <p className="text-[15px] text-ink">
        When the spike went down it was <span className="font-bold">{def} defenders against {atk} attackers</span>. The defenders retook, and it{" "}
        <span className={cn("font-bold", actual_outcome === "success" ? "text-success-text" : "text-danger-text")}>
          {actual_outcome === "success" ? "worked" : "failed"}
        </span>
        .
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((o) => {
          const best = ev.recommended_decision === o.key
          return (
            <Card key={o.key} tone={best ? "accent" : "inset"} padding="sm" className={cn(best && "ring-2 ring-inset ring-accent-text")}>
              <p className="flex items-center justify-between font-display text-title3 text-ink">
                {o.title}
                {best && <span className="text-xs font-extrabold uppercase tracking-[0.08em] text-accent-text">Better odds</span>}
              </p>
              <ul className="mt-2 space-y-1 text-[15px] text-ink">
                {o.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </Card>
          )
        })}
      </div>
      <p className="text-[13px] text-ink-2">
        Value compares the chance of winning the round bonus with the guns you&apos;d lose. Based on {historical_matches} post-plant rounds with a similar count and loadout.
      </p>
    </div>
  )
}
