"use client"

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  Target,
  Info,
  Crosshair,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const MAPS = ['Any', 'Ascent', 'Bind', 'Haven', 'Split', 'Breeze', 'Icebox', 'Fracture', 'Pearl', 'Lotus', 'Sunset']

export function ScenarioSearch() {
  const [attackerAlive, setAttackerAlive] = useState('3')
  const [defenderAlive, setDefenderAlive] = useState('2')
  const [spikePlanted, setSpikePlanted] = useState('true')
  const [mapName, setMapName] = useState('Any')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  const handleSearch = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    try {
      const res = await fetch('/api/analytics/scenarios/find-similar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attacker_alive: parseInt(attackerAlive),
          defender_alive: parseInt(defenderAlive),
          spike_planted: spikePlanted === 'true',
          map_name: mapName === 'Any' ? null : mapName,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setResults(data)
      } else {
        const errorData = await res.json().catch(() => ({}))
        setError(errorData.error || `Request failed with status ${res.status}`)
      }
    } catch (err) {
      console.error('Failed to search scenarios:', err)
      setError('Failed to connect to server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search Form - Compact */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="w-4 h-4" />
            Scenario Search
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Attackers</Label>
              <Select value={attackerAlive} onValueChange={setAttackerAlive}>
                <SelectTrigger className="h-9 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={`attacker-${n}`} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Defenders</Label>
              <Select value={defenderAlive} onValueChange={setDefenderAlive}>
                <SelectTrigger className="h-9 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={`defender-${n}`} value={String(n)}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Spike</Label>
              <Select value={spikePlanted} onValueChange={setSpikePlanted}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Planted</SelectItem>
                  <SelectItem value="false">Not Planted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Map</Label>
              <Select value={mapName} onValueChange={setMapName}>
                <SelectTrigger className="h-9 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAPS.map((map) => (
                    <SelectItem key={map} value={map}>{map}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSearch} disabled={loading} className="h-9 text-sm">
              {loading ? 'Searching...' : 'Search'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <ResultsSkeleton />
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <div className="text-destructive mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="text-sm text-destructive font-medium">{error}</p>
            <Button onClick={handleSearch} variant="outline" className="mt-4" size="sm">
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : results ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {/* Summary Stats - Compact */}
          {results.stats.total_matches > 0 ? (
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Card className="bg-gradient-to-br from-primary/10 to-transparent">
                <CardContent className="p-4">
                  <div className="text-center">
                    <span className="text-3xl font-bold tabular-nums">
                      {(results.stats.attacker_win_rate * 100).toFixed(0)}%
                    </span>
                    <p className="text-xs text-muted-foreground mt-1">ATK Win Rate</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <span className="text-3xl font-bold tabular-nums">{results.stats.total_matches}</span>
                    <p className="text-xs text-muted-foreground mt-1">Matches</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <Badge variant="outline" className="text-sm font-medium">
                      {results.scenario_type}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Type</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="text-center">
                    <Badge
                      variant={results.confidence === 'high' ? 'default' : results.confidence === 'medium' ? 'secondary' : 'outline'}
                      className="text-sm"
                    >
                      {results.confidence?.toUpperCase() || 'LOW'}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">Confidence</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="p-6">
                <div className="text-center space-y-2">
                  <Badge variant="outline" className="text-sm font-medium mb-2">
                    {results.scenario_type}
                  </Badge>
                  <p className="text-sm text-muted-foreground">
                    No historical matches found for this scenario
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Try adjusting the parameters or the scenario database is still being built
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabbed Results - Only show when we have data */}
          {results.stats.total_matches > 0 && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="h-9 bg-muted/50">
                <TabsTrigger value="overview" className="text-xs gap-1.5">
                  <Info className="w-3.5 h-3.5" />
                  Insights
                </TabsTrigger>
                <TabsTrigger value="maps" className="text-xs gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  By Map
                </TabsTrigger>
                <TabsTrigger value="matches" className="text-xs gap-1.5">
                  <Crosshair className="w-3.5 h-3.5" />
                  Matches
                </TabsTrigger>
              </TabsList>

              {/* Insights Tab */}
              <TabsContent value="overview" className="mt-4">
                <Card>
                  <CardContent className="px-4 py-4">
                    {results.insights && results.insights.length > 0 ? (
                      <ul className="space-y-2">
                        {results.insights.map((insight: string, i: number) => (
                          <li key={`insight-${i}-${insight.substring(0, 20)}`} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/50">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                            <span className="text-sm leading-relaxed">{insight}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No insights available</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

            {/* Map Breakdown Tab */}
            <TabsContent value="maps" className="mt-4">
              <Card>
                <CardContent className="px-4 py-4">
                  {Object.keys(results.stats.by_map).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No map data available</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                      {Object.entries(results.stats.by_map).map(([map, data]: [string, any]) => (
                        <div key={map} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                          <span className="font-medium text-sm">{map}</span>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "font-semibold text-sm",
                              data.rate >= 0.5 ? 'text-green-500' : 'text-red-500'
                            )}>
                              {(data.rate * 100).toFixed(0)}%
                            </span>
                            <span className="text-xs text-muted-foreground">({data.total})</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Matches Tab */}
            <TabsContent value="matches" className="mt-4">
              <Card>
                <CardContent className="px-4 py-4">
                  <ScrollArea className="h-[280px]">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground">Map</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">Round</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">Situation</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">Spike</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">Winner</th>
                          <th className="text-center py-2 px-3 font-medium text-muted-foreground">Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.matches.slice(0, 15).map((match: any, i: number) => (
                          <tr
                            key={`match-${match.map_name}-${match.round_number}-${i}`}
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
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
            </Tabs>
          )}
        </motion.div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              Configure scenario parameters above and click Search to find historical matches
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ResultsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`results-skeleton-${i}`} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-64" />
    </div>
  )
}
