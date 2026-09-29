"use client"

import { useState } from "react"
import { Bomb, ChevronDown } from "lucide-react"
import { Card, Icon } from "@/components/kl"
import { cn } from "@/lib/kl/cn"
import { agentLabel, PHASE_LABELS, winConditionLabel } from "@/lib/data/names"
import { credits } from "@/components/lumina/format"
import { RetakeCheck } from "./retake-check"
import { CoachTake } from "./coach-take"

export interface RoundKill {
  t: number
  killer: string
  killerAgent: string
  killerIsA: boolean
  victim: string
  victimAgent: string
  trade: boolean
}

export interface RoundItem {
  id: string
  number: number
  winnerIsA: boolean
  condition: string
  planted: boolean
  defused: boolean
  aLoadout: number
  bLoadout: number
  aSide: "attack" | "defense" | null
  kills: RoundKill[]
}

/** Buy bands shared with the economy report (team loadout: under 10k eco, under 20k force). */
function buy(loadout: number, round: number) {
  if (round === 1 || round === 13) return "Pistol"
  if (loadout >= 20000) return PHASE_LABELS.full
  if (loadout >= 10000) return PHASE_LABELS.force
  return PHASE_LABELS.eco
}

function Side({ side }: { side: "attack" | "defense" | null }) {
  if (!side) return null
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-[0.06em]", side === "attack" ? "bg-attack-soft text-attack-text" : "bg-defense-soft text-defense-text")}>
      {side}
    </span>
  )
}

/**
 * The round strip (one square per round, coloured by who won it) and the list of rounds. Opening
 * a round shows its kill feed, the save-or-retake check for planted rounds, and a button for
 * the AI coach's take.
 */
export function RoundList({ rounds, teamA, teamB }: { rounds: RoundItem[]; teamA: string; teamB: string }) {
  const [open, setOpen] = useState<string | null>(null)

  function openRound(id: string) {
    setOpen(id)
    requestAnimationFrame(() => document.getElementById(`round-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-ink-2">
          <span className="flex items-center gap-2">
            <span className="size-3.5 rounded-[4px] bg-accent-strong" /> {teamA} won
          </span>
          <span className="flex items-center gap-2">
            <span className="size-3.5 rounded-[4px] bg-ink" /> {teamB} won
          </span>
          <span>Tap a round to open it.</span>
        </div>
        <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Rounds">
          {rounds.map((r) => (
            <li key={r.id} className={cn(r.number === 13 && "ml-2 sm:ml-3")}>
              <button
                type="button"
                onClick={() => openRound(r.id)}
                aria-label={`Round ${r.number}: ${r.winnerIsA ? teamA : teamB} won`}
                className={cn(
                  "tabular grid size-9 place-items-center rounded-xs font-display text-[15px] font-semibold",
                  r.winnerIsA ? "bg-accent-strong text-on-accent" : "bg-ink text-bg",
                  open === r.id && "ring-2 ring-accent-text ring-offset-2 ring-offset-surface",
                )}
              >
                {r.number}
              </button>
            </li>
          ))}
        </ol>
      </Card>

      <ol className="space-y-2">
        {rounds.map((r) => {
          const isOpen = open === r.id
          const first = r.kills[0]
          return (
            <li key={r.id} id={`round-${r.id}`} className="scroll-mt-24">
              <Card padding="none" className="overflow-hidden">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? null : r.id)}
                  className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
                >
                  <span className="tabular w-8 shrink-0 font-display text-title3 text-ink-2">{r.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={cn("font-bold", r.winnerIsA ? "text-accent-text" : "text-ink")}>{r.winnerIsA ? teamA : teamB}</span>
                      <span className="text-[15px] text-ink-2">{winConditionLabel(r.condition)}</span>
                      {r.planted && r.condition !== "spike_defuse" && r.condition !== "spike_explode" && (
                        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-ink-2">
                          <Icon icon={Bomb} size={14} />
                          Planted
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-ink-2">
                      {buy(r.aLoadout, r.number)} ({credits(r.aLoadout)}) vs {buy(r.bLoadout, r.number)} ({credits(r.bLoadout)})
                      {first && ` · ${first.killer} opened at ${Math.round(first.t / 1000)}s`}
                    </span>
                  </span>
                  <Icon icon={ChevronDown} size={20} className={cn("shrink-0 text-ink-2 transition-transform duration-150", isOpen && "rotate-180")} />
                </button>

                {isOpen && (
                  <div className="space-y-5 border-t border-line px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
                      <span className="font-bold text-ink">{teamA}</span> <Side side={r.aSide} />
                      <span className="font-bold text-ink">{teamB}</span>{" "}
                      <Side side={r.aSide === "attack" ? "defense" : r.aSide === "defense" ? "attack" : null} />
                    </div>

                    <div>
                      <h4 className="text-xs font-extrabold uppercase tracking-[0.08em] text-ink-2">Kill feed</h4>
                      <ol className="mt-2 space-y-1.5">
                        {r.kills.map((k, i) => (
                          <li key={i} className="flex flex-wrap items-baseline gap-x-2 text-[15px]">
                            <span className="tabular w-10 shrink-0 text-ink-2">{Math.round(k.t / 1000)}s</span>
                            <span className={cn("font-bold", k.killerIsA ? "text-accent-text" : "text-ink")}>{k.killer}</span>
                            <span className="text-ink-2">({agentLabel(k.killerAgent)})</span>
                            <span className="text-ink-2">killed</span>
                            <span className={cn("font-bold", k.killerIsA ? "text-ink" : "text-accent-text")}>{k.victim}</span>
                            <span className="text-ink-2">({agentLabel(k.victimAgent)})</span>
                            {k.trade && <span className="text-[13px] font-bold text-success-text">trade</span>}
                          </li>
                        ))}
                        {r.kills.length === 0 && <li className="text-[15px] text-ink-2">No kills logged in this round.</li>}
                      </ol>
                    </div>

                    {r.planted && (
                      <div>
                        <h4 className="mb-2 text-xs font-extrabold uppercase tracking-[0.08em] text-ink-2">Save or retake?</h4>
                        <RetakeCheck roundId={r.id} />
                      </div>
                    )}

                    <CoachTake body={{ query_type: "round_analysis", round_id: r.id }} label="Coach's take on this round" />
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
