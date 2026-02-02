"use client"

import { use, useMemo, useState, Fragment } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Crosshair, Shield, TrendingUp, TrendingDown, Minus, ChevronDown, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { useGame } from "@/lib/hooks/use-games"
import { useGameRounds } from "@/lib/hooks/use-rounds"
import { MetricRow } from "@/components/metrics/metric-row"
import { usePushScreenData } from "@/lib/hooks/use-screen-data"
import { getMapImage, hasMapImage, getMapGradient, formatMapName } from "@/lib/valorant-assets"
import { TeamLogo } from "@/components/valorant/team-logo"
import { RoundAnalysisPanel } from "@/components/analytics/round-analysis-panel"

// Economy comparison bar component - compact inline display
function EconomyBar({
  teamAValue,
  teamBValue,
  teamAName,
  teamBName,
}: {
  teamAValue: number
  teamBValue: number
  teamAName: string
  teamBName: string
}) {
  const teamAK = Math.round(teamAValue / 1000)
  const teamBK = Math.round(teamBValue / 1000)
  const total = teamAValue + teamBValue
  const teamAPercent = total > 0 ? (teamAValue / total) * 100 : 50
  const diff = teamAValue - teamBValue
  const advantage = diff > 2000 ? "A" : diff < -2000 ? "B" : null

  return (
    <div className="inline-flex items-center gap-2 justify-end">
      {/* Team A economy */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] text-text-tertiary w-6 text-right">{teamAName.substring(0, 3)}</span>
        <span className={cn(
          "text-xs font-medium tabular-nums w-6 text-right",
          advantage === "A" ? "text-win" : "text-text-secondary"
        )}>
          {teamAK}k
        </span>
      </div>

      {/* Visual bar */}
      <div className="w-16 h-1.5 bg-surface-hover rounded-full overflow-hidden flex">
        <div
          className={cn(
            "h-full transition-all",
            advantage === "A" ? "bg-win" : "bg-text-tertiary"
          )}
          style={{ width: `${teamAPercent}%` }}
        />
        <div
          className={cn(
            "h-full transition-all",
            advantage === "B" ? "bg-loss" : "bg-text-muted"
          )}
          style={{ width: `${100 - teamAPercent}%` }}
        />
      </div>

      {/* Team B economy */}
      <div className="flex items-center gap-1">
        <span className={cn(
          "text-xs font-medium tabular-nums w-6",
          advantage === "B" ? "text-loss" : "text-text-secondary"
        )}>
          {teamBK}k
        </span>
        <span className="text-[10px] text-text-tertiary w-6">{teamBName.substring(0, 3)}</span>
      </div>

      {/* Advantage indicator */}
      <div className="w-4">
        {advantage === "A" ? (
          <TrendingUp className="h-3 w-3 text-win" />
        ) : advantage === "B" ? (
          <TrendingDown className="h-3 w-3 text-loss" />
        ) : (
          <Minus className="h-3 w-3 text-text-tertiary" />
        )}
      </div>
    </div>
  )
}

export default function GameDetailPage({
  params,
}: {
  params: Promise<{ gameId: string }>
}) {
  const { gameId } = use(params)
  const { data: game, isLoading: gameLoading } = useGame(gameId)
  const { data: rounds, isLoading: roundsLoading } = useGameRounds(gameId)
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)

  // Memoize screen data for chat context
  const screenData = useMemo(() => {
    if (!game) return null
    return {
      gameId,
      map: game.map_name,
      teamA: game.team_a_name,
      teamB: game.team_b_name,
      scoreA: game.team_a_score,
      scoreB: game.team_b_score,
      roundsPlayed: rounds?.length || 0,
      seriesId: game.series_id,
    }
  }, [game, rounds, gameId])

  // Push game data to screen context for chat
  usePushScreenData('Game Details', screenData, !gameLoading && !!game)

  if (gameLoading || roundsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-tertiary">Loading game data...</div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-tertiary">Game not found</div>
      </div>
    )
  }

  // Calculate round statistics based on actual database fields
  const teamAWins = rounds?.filter(r => r.winning_team_id === game.team_a_id).length || 0
  const teamBWins = rounds?.filter(r => r.winning_team_id === game.team_b_id).length || 0

  const pistolRounds = rounds?.filter(r => [1, 13].includes(r.round_number)) || []
  const teamAPistolWins = pistolRounds.filter(r => r.winning_team_id === game.team_a_id).length
  const teamBPistolWins = pistolRounds.filter(r => r.winning_team_id === game.team_b_id).length

  const spikePlanted = rounds?.filter(r => r.spike_planted).length || 0
  const spikeDefused = rounds?.filter(r => r.spike_defused).length || 0

  // First half (rounds 1-12), second half (rounds 13+)
  const firstHalf = rounds?.filter(r => r.round_number <= 12) || []
  const secondHalf = rounds?.filter(r => r.round_number > 12) || []
  const teamAFirstHalf = firstHalf.filter(r => r.winning_team_id === game.team_a_id).length
  const teamASecondHalf = secondHalf.filter(r => r.winning_team_id === game.team_a_id).length

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Back Button */}
        <Link
          href={`/series/${game.series_id}`}
          className="inline-flex items-center gap-2 text-xs text-text-tertiary hover:text-text-primary transition-fast"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Series
        </Link>

        {/* Game Header with Map Background */}
        <div className="relative overflow-hidden rounded-xl border border-border">
          {/* Map Background */}
          <div className="absolute inset-0">
            {hasMapImage(game.map_name) && getMapImage(game.map_name) ? (
              <Image
                src={getMapImage(game.map_name)}
                alt={formatMapName(game.map_name)}
                fill
                className="object-cover opacity-25"
              />
            ) : (
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", getMapGradient(game.map_name))} />
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/85 to-background/70" />
          </div>

          <div className="relative p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="text-xs text-text-tertiary mb-2">GAME {game.sequence_number}</div>
                <h1 className="text-3xl font-bold text-text-primary capitalize">{formatMapName(game.map_name)}</h1>
              </div>
            </div>

            {/* Score Display with Team Logos */}
            <div className="flex items-center justify-center gap-10 py-6">
              <div className="flex items-center gap-4">
                <TeamLogo teamName={game.team_a_name || "Team A"} size="lg" />
                <div className="text-center">
                  <div className="text-sm text-text-secondary mb-2">{game.team_a_name || "Team A"}</div>
                  <div className={cn(
                    "text-4xl font-bold tabular-nums",
                    game.team_a_score > game.team_b_score ? "text-win" : "text-loss"
                  )}>
                    {game.team_a_score}
                  </div>
                </div>
              </div>

              <span className="text-2xl text-text-tertiary font-bold">—</span>

              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-sm text-text-secondary mb-2">{game.team_b_name || "Team B"}</div>
                  <div className={cn(
                    "text-4xl font-bold tabular-nums",
                    game.team_b_score > game.team_a_score ? "text-win" : "text-loss"
                  )}>
                    {game.team_b_score}
                  </div>
                </div>
                <TeamLogo teamName={game.team_b_name || "Team B"} size="lg" />
              </div>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-text-tertiary pt-4 border-t border-border/50">
              <div className="flex items-center gap-1">
                <Crosshair className="h-3 w-3" />
                <span>{rounds?.length || 0} Rounds Played</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <MetricRow
          metrics={[
            {
              label: "Half 1 Score",
              value: `${teamAFirstHalf}-${firstHalf.length - teamAFirstHalf}`,
              context: "Rounds 1-12",
            },
            {
              label: "Half 2 Score",
              value: `${teamASecondHalf}-${secondHalf.length - teamASecondHalf}`,
              context: "Rounds 13+",
            },
            {
              label: "Pistol Rounds",
              value: `${teamAPistolWins}-${teamBPistolWins}`,
              context: "Rounds 1 & 13",
              status: teamAPistolWins > teamBPistolWins ? "win" : teamAPistolWins < teamBPistolWins ? "loss" : "warning",
            },
            {
              label: "Spike Events",
              value: `${spikePlanted}`,
              context: `${spikeDefused} Defused`,
            },
          ]}
        />

        {/* Round List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="label-tactical">Round Details</h2>
            <span className="text-xs text-text-tertiary">Click post-plant rounds for save/retake analysis</span>
          </div>
          <div className="panel p-0 overflow-hidden">
            <table className="table-dense">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Winner</th>
                  <th>End Condition</th>
                  <th className="text-center">Spike</th>
                  <th className="text-right">Economy</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {rounds && rounds.length > 0 ? (
                  rounds.map((round) => {
                    const teamAWon = round.winning_team_id === game.team_a_id
                    const teamBWon = round.winning_team_id === game.team_b_id
                    const isPistol = [1, 13].includes(round.round_number)
                    const isSelected = selectedRoundId === round.id
                    const hasAnalysis = round.spike_planted

                    return (
                      <Fragment key={round.id}>
                        <tr
                          onClick={() => hasAnalysis && setSelectedRoundId(isSelected ? null : round.id)}
                          className={cn(
                            hasAnalysis && "cursor-pointer hover:bg-surface-hover/50",
                            isSelected && "bg-surface-hover/30"
                          )}
                        >
                          <td>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">{round.round_number}</span>
                              {isPistol && (
                                <span className="text-xs text-valorant-accent uppercase">Pistol</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={cn(
                              "text-xs uppercase font-bold",
                              teamAWon ? "text-win" : teamBWon ? "text-loss" : "text-text-tertiary"
                            )}>
                              {teamAWon ? (game.team_a_name || "Team A") : teamBWon ? (game.team_b_name || "Team B") : "DRAW"}
                            </span>
                          </td>
                          <td className="text-xs text-text-secondary capitalize">
                            {round.winning_condition?.replace(/_/g, ' ') || "Unknown"}
                          </td>
                          <td className="text-center">
                            {round.spike_planted && (
                              <div className="inline-flex items-center gap-1 text-xs">
                                <Shield className={cn(
                                  "h-3 w-3",
                                  round.spike_defused ? "text-chart-defense" : "text-chart-attack"
                                )} />
                                <span className="text-text-tertiary">
                                  {round.spike_defused ? "Defused" : "Planted"}
                                </span>
                              </div>
                            )}
                          </td>
                          <td className="text-right">
                            {round.team_a_loadout_value && round.team_b_loadout_value ? (
                              <EconomyBar
                                teamAValue={round.team_a_loadout_value}
                                teamBValue={round.team_b_loadout_value}
                                teamAName={game.team_a_name || "A"}
                                teamBName={game.team_b_name || "B"}
                              />
                            ) : (
                              <span className="text-text-muted text-xs">—</span>
                            )}
                          </td>
                          <td className="text-center">
                            {hasAnalysis && (
                              <ChevronDown className={cn(
                                "h-4 w-4 text-text-tertiary transition-transform",
                                isSelected && "rotate-180"
                              )} />
                            )}
                          </td>
                        </tr>
                        {isSelected && hasAnalysis && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <RoundAnalysisPanel
                                roundId={round.id}
                                roundNumber={round.round_number}
                                mapName={game.map_name}
                                spikePlanted={round.spike_planted}
                                onClose={() => setSelectedRoundId(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center text-text-tertiary py-8">
                      No rounds data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
