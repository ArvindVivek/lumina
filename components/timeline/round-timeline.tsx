"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ChevronDown, ChevronUp } from "lucide-react"

export interface RoundData {
  roundNumber: number
  outcome: "win" | "loss" | "neutral"
  side: "attack" | "defense"
  details?: {
    firstDeath?: {
      player: string
      timestamp: string
    }
    economy: "full" | "eco" | "force"
    site?: "A" | "B" | "Mid"
    kills?: Array<{
      killer: string
      victim: string
      timestamp: string
    }>
  }
}

interface RoundTimelineProps {
  rounds: RoundData[]
  matchTitle?: string
  onRoundClick?: (round: RoundData) => void
  className?: string
}

export function RoundTimeline({
  rounds,
  matchTitle,
  onRoundClick,
  className,
}: RoundTimelineProps) {
  const [selectedRound, setSelectedRound] = useState<number | null>(null)

  // Split rounds into halves (12 rounds each typically)
  const half1 = rounds.slice(0, 12)
  const half2 = rounds.slice(12, 24)
  const overtime = rounds.slice(24)

  const half1Score = {
    wins: half1.filter((r) => r.outcome === "win").length,
    losses: half1.filter((r) => r.outcome === "loss").length,
  }

  const half2Score = {
    wins: half2.filter((r) => r.outcome === "win").length,
    losses: half2.filter((r) => r.outcome === "loss").length,
  }

  const handleRoundClick = (round: RoundData) => {
    setSelectedRound(
      selectedRound === round.roundNumber ? null : round.roundNumber
    )
    onRoundClick?.(round)
  }

  const renderRoundBox = (round: RoundData) => (
    <button
      key={round.roundNumber}
      onClick={() => handleRoundClick(round)}
      className={cn(
        "round-box transition-fast hover:scale-110",
        round.outcome === "win" && "round-box-win",
        round.outcome === "loss" && "round-box-loss",
        round.outcome === "neutral" && "round-box-neutral",
        selectedRound === round.roundNumber && "ring-2 ring-valorant-accent"
      )}
      title={`Round ${round.roundNumber}: ${round.outcome}`}
    />
  )

  return (
    <div className={cn("panel", className)}>
      {/* Header */}
      {matchTitle && (
        <div className="label-tactical mb-3">{matchTitle}</div>
      )}

      {/* Half 1 */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-secondary uppercase tracking-wide">
            Half 1
          </span>
          <span className="text-xs text-text-tertiary tabular-nums">
            {half1Score.wins}-{half1Score.losses}
          </span>
        </div>
        <div className="flex gap-0.5 flex-wrap">
          {half1.map(renderRoundBox)}
        </div>
      </div>

      {/* Half 2 */}
      {half2.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary uppercase tracking-wide">
              Half 2
            </span>
            <span className="text-xs text-text-tertiary tabular-nums">
              {half2Score.wins}-{half2Score.losses}
            </span>
          </div>
          <div className="flex gap-0.5 flex-wrap">
            {half2.map(renderRoundBox)}
          </div>
        </div>
      )}

      {/* Overtime */}
      {overtime.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-secondary uppercase tracking-wide">
              Overtime
            </span>
          </div>
          <div className="flex gap-0.5 flex-wrap">
            {overtime.map(renderRoundBox)}
          </div>
        </div>
      )}

      {/* Selected Round Details */}
      {selectedRound !== null && (
        <div className="mt-4 pt-4 border-t border-border">
          {(() => {
            const round = rounds.find((r) => r.roundNumber === selectedRound)
            if (!round || !round.details) return null

            return (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-text-primary">
                    Round {round.roundNumber}
                  </span>
                  <button
                    onClick={() => setSelectedRound(null)}
                    className="text-text-tertiary hover:text-text-primary transition-fast"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-text-tertiary">Outcome: </span>
                    <span
                      className={cn(
                        "font-semibold uppercase",
                        round.outcome === "win" && "text-win",
                        round.outcome === "loss" && "text-loss"
                      )}
                    >
                      {round.outcome}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Side: </span>
                    <span className="font-semibold uppercase text-text-primary">
                      {round.side}
                    </span>
                  </div>
                  <div>
                    <span className="text-text-tertiary">Economy: </span>
                    <span className="font-semibold uppercase text-text-primary">
                      {round.details.economy}
                    </span>
                  </div>
                  {round.details.site && (
                    <div>
                      <span className="text-text-tertiary">Site: </span>
                      <span className="font-semibold uppercase text-text-primary">
                        {round.details.site}
                      </span>
                    </div>
                  )}
                </div>

                {round.details.firstDeath && (
                  <div className="text-xs">
                    <span className="text-text-tertiary">First Death: </span>
                    <span className="text-loss font-semibold">
                      {round.details.firstDeath.player}
                    </span>
                    <span className="text-text-tertiary">
                      {" "}
                      @ {round.details.firstDeath.timestamp}
                    </span>
                  </div>
                )}

                {round.details.kills && round.details.kills.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs text-text-tertiary uppercase tracking-wide mb-1">
                      Kill Sequence
                    </div>
                    <div className="space-y-1">
                      {round.details.kills.map((kill, i) => (
                        <div
                          key={i}
                          className="text-xs text-text-secondary flex items-center gap-2"
                        >
                          <span className="tabular-nums text-text-tertiary">
                            {kill.timestamp}
                          </span>
                          <span className="text-win">{kill.killer}</span>
                          <span className="text-text-tertiary">→</span>
                          <span className="text-loss">{kill.victim}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}
