"use client"

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { RoundTimeline } from '@/components/analytics/round-timeline'
import {
  Target,
  Clock,
  Users,
  Crosshair,
  TrendingUp,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface HypotheticalViewProps {
  seriesId: string
  teamId?: string
}

interface Round {
  round_id: string
  round_number: number
  map_name: string
  game_id: string
  won?: boolean
  side?: 'attack' | 'defense'
}

export function HypotheticalView({ seriesId, teamId }: HypotheticalViewProps) {
  const [rounds, setRounds] = useState<Round[]>([])
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [roundsLoading, setRoundsLoading] = useState(true)

  // Fetch rounds for the series
  useEffect(() => {
    async function fetchRounds() {
      setRoundsLoading(true)
      try {
        const res = await fetch(`/api/analytics/round-breakdown/${seriesId}?team_focus=${teamId || ''}`)
        if (res.ok) {
          const data = await res.json()
          const allRounds: Round[] = []
          const seenRoundIds = new Set<string>()

          for (const game of data.games || []) {
            for (const round of game.rounds || []) {
              // Prevent duplicates by checking round_id
              if (seenRoundIds.has(round.round_id)) continue
              seenRoundIds.add(round.round_id)

              allRounds.push({
                round_id: round.round_id,
                round_number: round.round_number,
                map_name: game.map_name,
                game_id: game.game_id,
                won: round.result === 'win',
                side: round.side as 'attack' | 'defense' | undefined,
              })
            }
          }
          setRounds(allRounds)
        }
      } catch (error) {
        console.error('Failed to fetch rounds:', error)
      } finally {
        setRoundsLoading(false)
      }
    }
    if (seriesId) {
      fetchRounds()
    }
  }, [seriesId, teamId])

  // Fetch hypothetical analysis for selected round
  useEffect(() => {
    async function fetchAnalysis() {
      if (!selectedRoundId) return
      setLoading(true)
      try {
        const res = await fetch(
          `/api/analytics/hypothetical/${selectedRoundId}?team_focus=${teamId || ''}`
        )
        if (res.ok) {
          const data = await res.json()
          setAnalysis(data.analysis)
        }
      } catch (error) {
        console.error('Failed to fetch analysis:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchAnalysis()
  }, [selectedRoundId, teamId])

  if (roundsLoading) {
    return <HypotheticalSkeleton />
  }

  return (
    <div className="space-y-4">
      {/* Round Selector - Compact Timeline */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-4 h-4" />
            Select Round for Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <RoundTimeline
            rounds={rounds}
            selectedRoundId={selectedRoundId}
            onRoundSelect={setSelectedRoundId}
            groupByMap={true}
          />
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {loading ? (
        <AnalysisSkeleton />
      ) : analysis ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid gap-4 md:grid-cols-2"
        >
          {/* Round Context */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-4 h-4" />
                Round Context
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground block">Map</span>
                  <p className="font-medium text-sm">{analysis.round_context.map_name}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Round</span>
                  <p className="font-medium text-sm">{analysis.round_context.round_number}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Result</span>
                  <p className="font-medium text-sm">{analysis.round_context.winning_condition}</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Spike</span>
                  <p className="font-medium text-sm">
                    {analysis.round_context.spike_planted
                      ? analysis.round_context.spike_defused
                        ? 'Defused'
                        : 'Exploded'
                      : 'Not Planted'}
                  </p>
                </div>
              </div>

              {/* Kill Timeline */}
              {analysis.round_context.kill_timeline && analysis.round_context.kill_timeline.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium mb-2 flex items-center gap-1.5">
                    <Crosshair className="w-3.5 h-3.5" />
                    Kill Timeline
                  </h4>
                  <ScrollArea className="h-[140px]">
                    <div className="space-y-1.5">
                      {analysis.round_context.kill_timeline.map((kill: any, index: number) => {
                        const hasValidTime = kill.game_time_ms && kill.game_time_ms > 0
                        const hasValidWeapon = kill.weapon && kill.weapon.toLowerCase() !== 'unknown'
                        return (
                          <div
                            key={`kill-${kill.killer_id}-${kill.victim_id}-${kill.game_time_ms}-${index}`}
                            className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded bg-muted/50"
                          >
                            <span className="text-muted-foreground font-mono w-12">
                              {hasValidTime ? `${(kill.game_time_ms / 1000).toFixed(1)}s` : `#${index + 1}`}
                            </span>
                            <span className="flex-1 px-2">
                              <span className="font-medium">{kill.killer_name}</span>
                              <span className="text-muted-foreground mx-1">→</span>
                              <span>{kill.victim_name}</span>
                            </span>
                            {hasValidWeapon && (
                              <Badge variant="outline" className="text-[10px] h-5">
                                {kill.weapon}
                                {kill.headshot && ' HS'}
                              </Badge>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scenario Statistics */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="w-4 h-4" />
                Scenario Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Scenario Type */}
              <div>
                <span className="text-xs text-muted-foreground block">Scenario Type</span>
                <p className="font-semibold text-lg">{analysis.scenario_type}</p>
              </div>

              {/* Win Rate - Only show if we have data */}
              {analysis.scenario_stats.total_matches > 0 ? (
                <div className="p-4 rounded-lg bg-muted/50">
                  <div className="text-center">
                    <span className="text-4xl font-bold tabular-nums">
                      {(analysis.scenario_stats.attacker_win_rate * 100).toFixed(0)}%
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">
                      Historical attacker win rate ({analysis.scenario_stats.total_matches} matches)
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-lg border border-dashed border-border bg-muted/20">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">
                      No historical data available for this scenario
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Scenario database is being built
                    </p>
                  </div>
                </div>
              )}

              {/* Insights */}
              {analysis.insights && analysis.insights.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Insights
                  </h4>
                  <ul className="space-y-2">
                    {analysis.insights.slice(0, 3).map((insight: string, i: number) => (
                      <li key={`insight-${i}-${insight.substring(0, 20)}`} className="text-xs flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1 flex-shrink-0" />
                        <span className="leading-relaxed">{insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendation */}
              {analysis.recommendation && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs font-medium text-primary leading-relaxed">
                    {analysis.recommendation}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Similar Scenarios */}
          {analysis.historical_matches && analysis.historical_matches.length > 0 && (
            <Card className="md:col-span-2">
              <CardHeader className="pb-3 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="w-4 h-4" />
                  Similar Historical Scenarios
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs">
                        <th className="text-left py-2 px-3 font-medium text-muted-foreground">Map</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Round</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Situation</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Spike</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Result</th>
                        <th className="text-center py-2 px-3 font-medium text-muted-foreground">Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.historical_matches.slice(0, 8).map((match: any, i: number) => (
                        <tr
                          key={`${match.map_name}-${match.round_number}-${i}`}
                          className="border-b border-border/50 hover:bg-muted/30"
                        >
                          <td className="py-2 px-3 font-medium text-xs">{match.map_name}</td>
                          <td className="text-center py-2 px-3 text-xs">{match.round_number}</td>
                          <td className="text-center py-2 px-3 font-mono text-xs">
                            {match.attacker_alive}v{match.defender_alive}
                          </td>
                          <td className="text-center py-2 px-3 text-xs">
                            {match.spike_planted ? '✓' : '✗'}
                          </td>
                          <td className="text-center py-2 px-3">
                            <Badge variant={match.attacker_won ? 'default' : 'secondary'} className="text-xs">
                              {match.attacker_won ? 'ATK' : 'DEF'}
                            </Badge>
                          </td>
                          <td className="text-center py-2 px-3 font-medium text-xs">
                            {(match.similarity_score * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Select a round above to see what-if analysis
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function HypotheticalSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-32" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}

function AnalysisSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Skeleton className="h-72" />
      <Skeleton className="h-72" />
      <Skeleton className="h-48 md:col-span-2" />
    </div>
  )
}
