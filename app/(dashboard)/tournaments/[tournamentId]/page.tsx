"use client"

import { use, useMemo } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, Trophy, Calendar, ChevronRight, Swords, CheckCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTournament } from "@/lib/hooks/use-tournaments"
import { useTournamentSeries } from "@/lib/hooks/use-series"
import { usePushScreenData } from "@/lib/hooks/use-screen-data"

export default function TournamentDetailPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>
}) {
  const { tournamentId } = use(params)
  const { data: tournament, isLoading: tournamentLoading, error: tournamentError } = useTournament(tournamentId)
  const { data: series, isLoading: seriesLoading } = useTournamentSeries(tournamentId)

  // Memoize screen data for chat context
  const screenData = useMemo(() => {
    if (!tournament) return null
    return {
      tournamentId,
      name: tournament.name,
      region: tournament.region,
      startDate: tournament.start_date,
      endDate: tournament.end_date,
      totalMatches: series?.length || 0,
      completedMatches: series?.filter(s => s.winner_id !== null).length || 0,
    }
  }, [tournament, series, tournamentId])

  // Push tournament data to screen context for chat
  usePushScreenData('Tournament Details', screenData, !tournamentLoading && !!tournament)

  if (tournamentLoading || seriesLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-valorant-accent border-t-transparent rounded-full"
        />
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Trophy className="w-12 h-12 text-text-tertiary mx-auto mb-4 opacity-50" />
          <div className="text-text-tertiary">Tournament not found</div>
          {tournamentError && <div className="text-xs mt-2 text-loss">Error loading tournament</div>}
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const completedMatches = series?.filter(s => s.winner_id !== null).length || 0
  const inProgressMatches = series?.filter(s => s.winner_id === null).length || 0
  const totalMatches = series?.length || 0

  // Get unique teams from matches
  const uniqueTeams = new Set<string>()
  series?.forEach(s => {
    uniqueTeams.add(s.team_a.name)
    uniqueTeams.add(s.team_b.name)
  })

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Back Button */}
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 text-sm text-text-tertiary hover:text-valorant-accent transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tournaments
        </Link>

        {/* Tournament Header - Glass Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-xl border border-white/5 p-8"
        >
          {/* Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-valorant-accent/5 to-transparent pointer-events-none" />

          <div className="relative flex items-start gap-6">
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-valorant-accent/20 to-valorant-accent/5 flex items-center justify-center shrink-0 border border-valorant-accent/20">
              <Trophy className="h-8 w-8 text-valorant-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-bold text-text-primary mb-3">
                {tournament.name}
              </h1>
              {(formatDate(tournament.start_date) || formatDate(tournament.end_date)) && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Calendar className="h-4 w-4" />
                  <span>
                    {formatDate(tournament.start_date)}
                    {formatDate(tournament.end_date) && (
                      <> — {formatDate(tournament.end_date)}</>
                    )}
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats Cards - Glass UI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative overflow-hidden rounded-xl bg-gradient-to-br from-surface/60 to-surface/30 backdrop-blur-sm border border-white/5 p-5"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <Swords className="h-5 w-5 text-blue-400 mb-2" />
              <div className="text-3xl font-bold text-text-primary tabular-nums">
                {totalMatches}
              </div>
              <div className="text-xs uppercase tracking-wide text-text-tertiary mt-1">
                Total Matches
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="relative overflow-hidden rounded-xl bg-gradient-to-br from-surface/60 to-surface/30 backdrop-blur-sm border border-white/5 p-5"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
              <div className="text-3xl font-bold text-win tabular-nums">
                {completedMatches}
              </div>
              <div className="text-xs uppercase tracking-wide text-text-tertiary mt-1">
                Completed
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="relative overflow-hidden rounded-xl bg-gradient-to-br from-surface/60 to-surface/30 backdrop-blur-sm border border-white/5 p-5"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <Clock className="h-5 w-5 text-yellow-400 mb-2" />
              <div className="text-3xl font-bold text-warning tabular-nums">
                {inProgressMatches}
              </div>
              <div className="text-xs uppercase tracking-wide text-text-tertiary mt-1">
                In Progress
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="relative overflow-hidden rounded-xl bg-gradient-to-br from-surface/60 to-surface/30 backdrop-blur-sm border border-white/5 p-5"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent pointer-events-none" />
            <div className="relative">
              <Trophy className="h-5 w-5 text-purple-400 mb-2" />
              <div className="text-3xl font-bold text-text-primary tabular-nums">
                {uniqueTeams.size}
              </div>
              <div className="text-xs uppercase tracking-wide text-text-tertiary mt-1">
                Teams
              </div>
            </div>
          </motion.div>
        </div>

        {/* Matches List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            <Swords className="h-5 w-5 text-valorant-accent" />
            Matches
          </h2>

          {series && series.length > 0 ? (
            <div className="grid gap-3">
              {series.map((match, index) => {
                const isComplete = match.winner_id !== null
                const teamAWon = match.winner_id === match.team_a_id

                return (
                  <motion.div
                    key={match.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link href={`/series/${match.id}`}>
                      <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-surface/60 to-surface/30 backdrop-blur-sm border border-white/5 p-5 hover:border-valorant-accent/30 transition-all duration-300 cursor-pointer">
                        {/* Hover glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-valorant-accent/0 via-valorant-accent/5 to-valorant-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                        <div className="relative flex items-center justify-between">
                          {/* Teams */}
                          <div className="flex-1">
                            <div className="flex items-center gap-6">
                              <div className={cn(
                                "flex-1 text-right",
                                isComplete && teamAWon && "text-win"
                              )}>
                                <span className={cn(
                                  "text-lg font-semibold",
                                  !isComplete && "text-text-primary",
                                  isComplete && teamAWon && "text-win",
                                  isComplete && !teamAWon && "text-text-secondary"
                                )}>
                                  {match.team_a.name}
                                </span>
                                {isComplete && teamAWon && (
                                  <CheckCircle className="inline-block ml-2 h-4 w-4 text-win" />
                                )}
                              </div>

                              <div className="text-sm text-text-tertiary font-medium px-4">
                                VS
                              </div>

                              <div className={cn(
                                "flex-1",
                                isComplete && !teamAWon && "text-win"
                              )}>
                                {isComplete && !teamAWon && (
                                  <CheckCircle className="inline-block mr-2 h-4 w-4 text-win" />
                                )}
                                <span className={cn(
                                  "text-lg font-semibold",
                                  !isComplete && "text-text-primary",
                                  isComplete && !teamAWon && "text-win",
                                  isComplete && teamAWon && "text-text-secondary"
                                )}>
                                  {match.team_b.name}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Status & Arrow */}
                          <div className="flex items-center gap-4 ml-6">
                            {!isComplete && (
                              <span className="px-2 py-1 rounded text-xs font-medium bg-warning/10 text-warning">
                                Live
                              </span>
                            )}
                            <ChevronRight className="h-5 w-5 text-text-tertiary group-hover:text-valorant-accent group-hover:translate-x-1 transition-all" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                )
              })}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="rounded-xl bg-surface/30 backdrop-blur-sm border border-white/5 p-12 text-center"
            >
              <Swords className="w-12 h-12 text-text-tertiary mx-auto mb-4 opacity-50" />
              <div className="text-text-tertiary">No matches found for this tournament</div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
