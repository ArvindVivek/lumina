"use client"

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Trophy,
  Target,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Video,
  Zap,
  Shield,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CoachingReportViewProps {
  seriesId: string
  teamId: string
}

export function CoachingReportView({ seriesId, teamId }: CoachingReportViewProps) {
  const [report, setReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState('overview')

  useEffect(() => {
    async function fetchReport() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/analytics/coaching-report/${seriesId}?team_focus=${teamId}`
        )
        if (!res.ok) {
          throw new Error('Failed to fetch coaching report')
        }
        const data = await res.json()
        setReport(data.report)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchReport()
  }, [seriesId, teamId])

  if (loading) {
    return <ReportSkeleton />
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-2" />
            <p className="text-destructive font-medium">{error}</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!report) return null

  const { summary, key_metrics, opening_duels, anti_strat_signals, forced_mistakes, vod_review_notes, action_plan } = report

  return (
    <div className="space-y-4">
      {/* Top Stats Row - Always Visible */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {/* Result Card */}
        <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className={cn("w-4 h-4", summary.result === 'win' ? 'text-green-500' : 'text-red-500')} />
              <span className="text-xs text-muted-foreground font-medium">Result</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums">{summary.score}</span>
              <Badge variant={summary.result === 'win' ? 'default' : 'destructive'} className="text-xs">
                {summary.result.toUpperCase()}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              vs {summary.opponent_name}
            </p>
          </CardContent>
        </Card>

        {/* Key Strength */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground font-medium">Strength</span>
            </div>
            <p className="text-sm leading-relaxed line-clamp-3">{summary.key_strength}</p>
          </CardContent>
        </Card>

        {/* Key Weakness */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground font-medium">Weakness</span>
            </div>
            <p className="text-sm leading-relaxed line-clamp-3">{summary.key_weakness}</p>
          </CardContent>
        </Card>

        {/* Total Rounds */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">Rounds</span>
            </div>
            <span className="text-3xl font-bold tabular-nums">{summary.total_rounds}</span>
            <p className="text-xs text-muted-foreground mt-1">
              {summary.total_maps} maps played
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Sections */}
      <Tabs value={activeSection} onValueChange={setActiveSection} className="flex-1">
        <TabsList className="w-full justify-start h-9 bg-muted/50 overflow-x-auto">
          <TabsTrigger value="overview" className="text-xs gap-1.5">
            <Target className="w-3.5 h-3.5" />
            Metrics
          </TabsTrigger>
          <TabsTrigger value="players" className="text-xs gap-1.5">
            <Users className="w-3.5 h-3.5" />
            Players
          </TabsTrigger>
          <TabsTrigger value="signals" className="text-xs gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Signals
          </TabsTrigger>
          <TabsTrigger value="vod" className="text-xs gap-1.5">
            <Video className="w-3.5 h-3.5" />
            VOD
          </TabsTrigger>
          <TabsTrigger value="actions" className="text-xs gap-1.5">
            <Zap className="w-3.5 h-3.5" />
            Actions
          </TabsTrigger>
        </TabsList>

        {/* Overview - Key Metrics by Map */}
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-base">Key Metrics by Map</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs">
                      <th className="text-left py-2 px-3 font-medium text-muted-foreground">Map</th>
                      <th className="text-center py-2 px-3 font-medium text-muted-foreground">Score</th>
                      <th className="text-center py-2 px-3 font-medium text-muted-foreground">FB Win</th>
                      <th className="text-center py-2 px-3 font-medium text-muted-foreground">FB Conv</th>
                      <th className="text-center py-2 px-3 font-medium text-muted-foreground">Trade</th>
                      <th className="text-center py-2 px-3 font-medium text-muted-foreground">Untraded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {key_metrics.map((m: any) => (
                      <tr key={m.game_id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-2 px-3 font-medium">{m.map_name}</td>
                        <td className="text-center py-2 px-3">{m.score}</td>
                        <td className="text-center py-2 px-3">
                          <MetricBadge value={m.fb_win_rate} threshold={0.5} />
                        </td>
                        <td className="text-center py-2 px-3">
                          <MetricBadge value={m.fb_conversion_rate} threshold={0.6} />
                        </td>
                        <td className="text-center py-2 px-3">
                          <MetricBadge value={m.trade_rate} threshold={0.4} />
                        </td>
                        <td className="text-center py-2 px-3">
                          <span className={cn("font-medium", m.untraded_deaths > 5 && "text-red-500")}>
                            {m.untraded_deaths}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Players - Opening Duels */}
        <TabsContent value="players" className="mt-4">
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-base">Opening Duels by Player</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid gap-2">
                {opening_duels.slice(0, 6).map((player: any) => (
                  <div key={player.player_id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div className="flex-1">
                      <span className="font-medium text-sm">{player.player_name}</span>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        FK: {player.first_kills} | FD: {player.first_deaths} | {player.total_rounds} rounds
                      </div>
                    </div>
                    <Badge variant={player.net >= 0 ? 'default' : 'destructive'} className="text-sm font-mono">
                      {player.net >= 0 ? '+' : ''}{player.net}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Signals - Anti-Strat */}
        <TabsContent value="signals" className="mt-4">
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-base">Anti-Strat Signals</CardTitle>
              <CardDescription className="text-xs">Patterns opponent may have prepared for</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {anti_strat_signals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No significant signals detected</p>
              ) : (
                <div className="space-y-3">
                  {anti_strat_signals.map((signal: any, i: number) => (
                    <div key={`signal-${i}-${signal.signal.substring(0, 15)}`} className="border-l-2 border-l-amber-500 pl-3 py-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={signal.severity === 'critical' ? 'destructive' : 'secondary'} className="text-xs">
                          {signal.severity}
                        </Badge>
                        <span className="text-sm font-medium">{signal.signal}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{signal.implication}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VOD Review Notes */}
        <TabsContent value="vod" className="mt-4">
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-base">VOD Review Priority</CardTitle>
              <CardDescription className="text-xs">Rounds prioritized for coaching review</CardDescription>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <ScrollArea className="h-[280px]">
                <div className="space-y-2">
                  {vod_review_notes.slice(0, 12).map((note: any, i: number) => (
                    <div
                      key={`vod-${note.map_name}-${note.round_number}-${i}`}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-lg",
                        note.review_priority === 'critical' ? 'bg-red-500/10 border border-red-500/20' :
                        note.review_priority === 'high' ? 'bg-amber-500/10 border border-amber-500/20' :
                        'bg-muted/50'
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <Badge variant={
                          note.review_priority === 'critical' ? 'destructive' :
                          note.review_priority === 'high' ? 'default' :
                          'secondary'
                        } className="font-mono text-xs">
                          {note.map_name} R{note.round_number}
                        </Badge>
                        <span className="text-xs">{note.reason}</span>
                      </div>
                      <PriorityBadge priority={note.review_priority} />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Action Plan */}
        <TabsContent value="actions" className="mt-4">
          <Card>
            <CardHeader className="pb-3 pt-4 px-4">
              <CardTitle className="text-base">Action Plan</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    Immediate Actions
                  </h4>
                  {action_plan.immediate.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No immediate actions required</p>
                  ) : (
                    <ul className="space-y-2">
                      {action_plan.immediate.map((item: any, i: number) => (
                        <li key={`immediate-${i}-${item.action.substring(0, 15)}`} className="text-sm p-2.5 rounded-lg bg-muted/50">
                          <span className="font-medium block mb-0.5">{item.action}</span>
                          <p className="text-xs text-muted-foreground">{item.context}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Medium-Term Focus
                  </h4>
                  {action_plan.medium_term.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No medium-term focus areas</p>
                  ) : (
                    <ul className="space-y-2">
                      {action_plan.medium_term.map((item: any, i: number) => (
                        <li key={`medium-${i}-${item.action.substring(0, 15)}`} className="text-sm p-2.5 rounded-lg bg-muted/50">
                          <span className="font-medium block mb-0.5">{item.action}</span>
                          <p className="text-xs text-muted-foreground">{item.context}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MetricBadge({ value, threshold }: { value: number; threshold: number }) {
  const percentage = (value * 100).toFixed(0)
  const isGood = value >= threshold

  return (
    <span className={cn("font-medium", isGood ? 'text-green-500' : 'text-red-500')}>
      {percentage}%
    </span>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors = {
    critical: 'bg-red-500',
    high: 'bg-amber-500',
    medium: 'bg-blue-500',
    low: 'bg-gray-500',
  }

  return (
    <span className={cn("w-2.5 h-2.5 rounded-full", colors[priority as keyof typeof colors] || colors.low)} />
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`top-skeleton-${i}`} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-64" />
    </div>
  )
}
