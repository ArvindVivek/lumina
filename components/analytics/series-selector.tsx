"use client"

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Trophy, Calendar, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Series {
  id: string
  team_a_name: string
  team_b_name: string
  team_a_id: string
  team_b_id: string
  tournament_name: string
  start_time: string
}

interface SeriesSelectorProps {
  onSelect: (seriesId: string, teamAId: string, teamBId: string, teamAName?: string, teamBName?: string) => void
  selectedSeriesId: string | null
  compact?: boolean
  autoSelectFirst?: boolean
}

export function SeriesSelector({ onSelect, selectedSeriesId, compact = false, autoSelectFirst = false }: SeriesSelectorProps) {
  const [series, setSeries] = useState<Series[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [hasAutoSelected, setHasAutoSelected] = useState(false)

  useEffect(() => {
    async function fetchSeries() {
      try {
        const res = await fetch('/api/series?limit=50')
        if (res.ok) {
          const data = await res.json()
          const seriesList = data.series || []
          setSeries(seriesList)

          // Auto-select first series if enabled and nothing selected
          if (autoSelectFirst && !selectedSeriesId && seriesList.length > 0 && !hasAutoSelected) {
            const first = seriesList[0]
            onSelect(first.id, first.team_a_id, first.team_b_id)
            setHasAutoSelected(true)
          }
        }
      } catch (error) {
        console.error('Failed to fetch series:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchSeries()
  }, [autoSelectFirst, selectedSeriesId, hasAutoSelected, onSelect])

  const filteredSeries = series.filter((s) => {
    const query = searchQuery.toLowerCase()
    return (
      s.team_a_name.toLowerCase().includes(query) ||
      s.team_b_name.toLowerCase().includes(query) ||
      s.tournament_name.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="w-full">
        <div className="space-y-3">
          <div className={cn("w-full rounded-md bg-muted animate-pulse", compact ? "h-9" : "h-10")} />
          <div className={cn("grid gap-3", compact ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4")}>
            {Array.from({ length: compact ? 4 : 6 }).map((_, i) => (
              <div key={`skeleton-${i}`} className={cn("rounded-lg bg-muted animate-pulse", compact ? "h-20" : "h-28")} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className={cn("space-y-3", compact && "space-y-2")}>
        {/* Search Input */}
        <div className="relative">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground", compact ? "w-4 h-4" : "w-5 h-5")} />
          <Input
            placeholder="Search by team or tournament..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={cn("pl-9", compact ? "h-9 text-sm" : "h-12 text-base pl-10")}
          />
        </div>

        {/* Series Grid */}
        <ScrollArea className={cn(compact ? "h-[180px]" : "h-[400px]", "pr-4")}>
            {filteredSeries.length === 0 ? (
              <div className={cn("flex flex-col items-center justify-center text-center", compact ? "py-6" : "py-12")}>
                <Search className={cn("text-muted-foreground mb-3", compact ? "w-8 h-8" : "w-12 h-12 mb-4")} />
                <p className={cn("text-muted-foreground", compact ? "text-sm" : "text-base")}>
                  {searchQuery ? 'No series found matching your search' : 'No series available'}
                </p>
              </div>
            ) : (
              <div className={cn("grid gap-3", compact ? "grid-cols-2 md:grid-cols-3 lg:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4")}>
                <AnimatePresence mode="popLayout">
                  {filteredSeries.map((s) => {
                    const isSelected = selectedSeriesId === s.id
                    const date = new Date(s.start_time)
                    const formattedDate = date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })

                    return (
                      <motion.div
                        key={s.id}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                      >
                        <button
                          onClick={() => onSelect(s.id, s.team_a_id, s.team_b_id, s.team_a_name, s.team_b_name)}
                          className={cn(
                            "w-full text-left rounded-lg border-2 transition-all duration-200",
                            "hover:shadow-md hover:-translate-y-0.5",
                            compact ? "p-3" : "p-5",
                            isSelected
                              ? "border-primary bg-primary/10 shadow-md"
                              : "border-border bg-surface hover:border-primary/50"
                          )}
                        >
                          {/* Teams - Compact Layout */}
                          {compact ? (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-sm truncate flex-1">
                                  {s.team_a_name}
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                              </div>
                              <div className="text-xs text-muted-foreground">vs {s.team_b_name}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/30">
                                <Calendar className="w-3 h-3" />
                                {formattedDate}
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Selected Indicator */}
                              {isSelected && (
                                <div className="flex items-center justify-end mb-2">
                                  <Badge variant="default" className="gap-1">
                                    <Check className="w-3 h-3" />
                                    Selected
                                  </Badge>
                                </div>
                              )}

                              {/* Teams */}
                              <div className="space-y-2 mb-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-base truncate">
                                    {s.team_a_name}
                                  </span>
                                  <Trophy className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                </div>
                                <div className="text-center text-xs text-muted-foreground font-medium">
                                  VS
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-base truncate">
                                    {s.team_b_name}
                                  </span>
                                  <Trophy className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                </div>
                              </div>

                              {/* Tournament & Date */}
                              <div className="space-y-1 pt-3 border-t border-border/50">
                                <div className="text-sm text-muted-foreground truncate">
                                  {s.tournament_name}
                                </div>
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Calendar className="w-3 h-3" />
                                  {formattedDate}
                                </div>
                              </div>
                            </>
                          )}
                        </button>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    )
}
