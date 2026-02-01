"use client"

import { use, useMemo } from "react"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Trophy, Map as MapIcon, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSeries } from "@/lib/hooks/use-series"
import { useSeriesGames } from "@/lib/hooks/use-games"
import { MetricRow } from "@/components/metrics/metric-row"
import { usePushScreenData } from "@/lib/hooks/use-screen-data"
import { getMapImage, hasMapImage, getMapGradient, formatMapName } from "@/lib/valorant-assets"
import { TeamLogo } from "@/components/valorant/team-logo"

export default function SeriesDetailPage({
  params,
}: {
  params: Promise<{ seriesId: string }>
}) {
  const { seriesId } = use(params)
  const { data: series, isLoading: seriesLoading } = useSeries(seriesId)
  const { data: games, isLoading: gamesLoading } = useSeriesGames(seriesId)

  // Memoize screen data for chat context
  const screenData = useMemo(() => {
    if (!series) return null
    return {
      seriesId,
      teamA: series.team_a?.name,
      teamB: series.team_b?.name,
      tournament: series.tournament?.name,
      winner: series.winner_id === series.team_a_id ? series.team_a?.name : series.team_b?.name,
      format: series.format,
      gamesPlayed: games?.length || 0,
    }
  }, [series, games, seriesId])

  // Push series data to screen context for chat
  usePushScreenData('Series Details', screenData, !seriesLoading && !!series)

  if (seriesLoading || gamesLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-tertiary">Loading match data...</div>
      </div>
    )
  }

  if (!series) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-tertiary">Match not found</div>
      </div>
    )
  }

  const isComplete = series.winner_id !== null
  const teamAWon = series.winner_id === series.team_a_id

  // Calculate series score from game wins
  const teamAScore = games?.filter(g => g.winner_id === series.team_a_id).length || 0
  const teamBScore = games?.filter(g => g.winner_id === series.team_b_id).length || 0

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-text-tertiary hover:text-text-primary transition-fast"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Dashboard
        </Link>

        {/* Match Header */}
        <div className="panel">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="h-4 w-4 text-valorant-accent" />
                <span className="text-xs text-text-secondary uppercase tracking-wide">
                  {series.tournament.name}
                </span>
              </div>
              <h1 className="text-2xl font-bold text-text-primary">
                {series.team_a.name} vs {series.team_b.name}
              </h1>
            </div>
            {isComplete && (
              <div className="text-right">
                <div className="text-xs text-text-tertiary mb-1">WINNER</div>
                <div className="flex items-center gap-2 justify-end">
                  <TeamLogo teamName={teamAWon ? series.team_a.name : series.team_b.name} size="sm" />
                  <span className="text-lg font-bold text-win">
                    {teamAWon ? series.team_a.name : series.team_b.name}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Score Display with Team Logos */}
          <div className="flex items-center justify-center gap-12 py-8 border-y border-border">
            <div className="flex items-center gap-4">
              <TeamLogo teamName={series.team_a.name} size="lg" />
              <div className="text-center">
                <div className="text-sm text-text-secondary mb-2">
                  {series.team_a.name}
                </div>
                <div
                  className={cn(
                    "text-5xl font-bold tabular-nums",
                    teamAWon ? "text-win" : isComplete ? "text-loss" : "text-text-primary"
                  )}
                >
                  {teamAScore}
                </div>
              </div>
            </div>

            <div className="text-3xl text-text-tertiary font-bold">—</div>

            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-sm text-text-secondary mb-2">
                  {series.team_b.name}
                </div>
                <div
                  className={cn(
                    "text-5xl font-bold tabular-nums",
                    !teamAWon && isComplete ? "text-win" : isComplete ? "text-loss" : "text-text-primary"
                  )}
                >
                  {teamBScore}
                </div>
              </div>
              <TeamLogo teamName={series.team_b.name} size="lg" />
            </div>
          </div>

          {/* Match Meta */}
          <div className="flex items-center gap-6 mt-4 text-xs text-text-tertiary">
            <div className="flex items-center gap-1">
              <MapIcon className="h-3 w-3" />
              <span>{games?.length || 0} Maps Played</span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        {games && games.length > 0 && (
          <MetricRow
            metrics={[
              { label: "Maps Played", value: games.length, context: `${series.format || 'Series'}` },
              { label: "Close Maps", value: games.filter(g => Math.abs((g.team_a_score || 0) - (g.team_b_score || 0)) <= 2).length, context: "≤2 round diff" },
              { label: "Stomps", value: games.filter(g => Math.abs((g.team_a_score || 0) - (g.team_b_score || 0)) >= 8).length, context: "≥8 round diff" },
            ]}
          />
        )}

        {/* Games Breakdown */}
        <div className="space-y-4">
          <h2 className="label-tactical">Map-by-Map Breakdown</h2>

          {games && games.length > 0 ? (
            <div className="space-y-4">
              {games.map((game, index) => {
                const teamAWonGame = game.winner_id === series.team_a_id
                const isDraw = game.team_a_score === game.team_b_score
                const mapImage = getMapImage(game.map_name)
                const hasImage = hasMapImage(game.map_name)
                const gradientClass = getMapGradient(game.map_name)

                return (
                  <Link key={game.id} href={`/game/${game.id}`}>
                    <div className="group relative overflow-hidden rounded-xl border border-border hover:border-valorant-accent/50 transition-all cursor-pointer">
                      {/* Map Background Image */}
                      <div className="absolute inset-0">
                        {hasImage && mapImage ? (
                          <Image
                            src={mapImage}
                            alt={formatMapName(game.map_name)}
                            fill
                            className="object-cover opacity-30 group-hover:opacity-40 group-hover:scale-105 transition-all duration-500"
                          />
                        ) : (
                          <div className={cn("absolute inset-0 bg-gradient-to-br opacity-30", gradientClass)} />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/80 to-background/60" />
                      </div>

                      {/* Content */}
                      <div className="relative flex items-center justify-between p-5">
                        {/* Game Number & Map */}
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-lg bg-surface/80 backdrop-blur-sm flex items-center justify-center border border-border/50">
                            <span className="text-lg font-bold text-text-secondary">
                              {game.sequence_number || index + 1}
                            </span>
                          </div>
                          <div>
                            <div className="text-lg font-bold text-text-primary capitalize">
                              {formatMapName(game.map_name)}
                            </div>
                            <div className="text-xs text-text-tertiary">Map {game.sequence_number || index + 1}</div>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="flex items-center gap-8">
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <div className="text-xs text-text-tertiary mb-1">{series.team_a.short_name || series.team_a.name.substring(0, 3)}</div>
                              <div className={cn(
                                "text-2xl font-bold tabular-nums",
                                teamAWonGame ? "text-win" : isDraw ? "text-text-primary" : "text-loss"
                              )}>
                                {game.team_a_score}
                              </div>
                            </div>
                            <span className="text-xl text-text-tertiary font-bold">—</span>
                            <div className="text-left">
                              <div className="text-xs text-text-tertiary mb-1">{series.team_b.short_name || series.team_b.name.substring(0, 3)}</div>
                              <div className={cn(
                                "text-2xl font-bold tabular-nums",
                                !teamAWonGame && !isDraw ? "text-win" : isDraw ? "text-text-primary" : "text-loss"
                              )}>
                                {game.team_b_score}
                              </div>
                            </div>
                          </div>

                          {game.winner_id && (
                            <div className={cn(
                              "px-3 py-1.5 rounded-lg text-xs font-bold uppercase",
                              teamAWonGame ? "bg-win/20 text-win" : "bg-loss/20 text-loss"
                            )}>
                              {teamAWonGame ? series.team_a.short_name : series.team_b.short_name} WIN
                            </div>
                          )}

                          <ChevronRight className="h-5 w-5 text-text-tertiary group-hover:text-valorant-accent group-hover:translate-x-1 transition-all" />
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="panel text-center text-text-tertiary py-8">
              No games data available
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
