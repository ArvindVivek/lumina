"use client"

import { useState, Suspense, useCallback, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Skeleton } from '@/components/ui/skeleton'
import { SeriesSelector } from '@/components/analytics/series-selector'
import { CoachingReportView } from '@/components/analytics/coaching-report-view'
import {
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePushScreenData } from '@/lib/hooks/use-screen-data'

export default function AnalyticsPage() {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [selectedSeriesInfo, setSelectedSeriesInfo] = useState<{ teamAName: string; teamBName: string } | null>(null)
  const [selectorExpanded, setSelectorExpanded] = useState(false)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // Auto-fetch and select first series on mount
  useEffect(() => {
    async function fetchAndSelectFirst() {
      try {
        const res = await fetch('/api/series?limit=1')
        if (res.ok) {
          const data = await res.json()
          const seriesList = data.series || []
          if (seriesList.length > 0) {
            const first = seriesList[0]
            setSelectedSeriesId(first.id)
            setSelectedTeamId(first.team_a_id)
            setSelectedSeriesInfo({ teamAName: first.team_a_name, teamBName: first.team_b_name })
          }
        }
      } catch (error) {
        console.error('Failed to fetch first series:', error)
      } finally {
        setIsInitialLoad(false)
      }
    }
    fetchAndSelectFirst()
  }, [])

  // Memoized select handler to prevent infinite loops
  const handleSeriesSelect = useCallback((seriesId: string, teamAId: string, teamBId: string, teamAName?: string, teamBName?: string) => {
    setSelectedSeriesId(seriesId)
    setSelectedTeamId(teamAId)
    if (teamAName && teamBName) {
      setSelectedSeriesInfo({ teamAName, teamBName })
    }
    setSelectorExpanded(false) // Auto-collapse after selection
  }, [])

  // Memoize screen data to avoid re-renders
  const matchScreenData = useMemo(() => {
    if (!selectedSeriesInfo) return null
    return {
      seriesId: selectedSeriesId,
      teamId: selectedTeamId,
      teamA: selectedSeriesInfo.teamAName,
      teamB: selectedSeriesInfo.teamBName,
      analyzing: `${selectedSeriesInfo.teamAName} vs ${selectedSeriesInfo.teamBName}`,
    }
  }, [selectedSeriesId, selectedTeamId, selectedSeriesInfo])

  // Push current selection to screen context for chat
  usePushScreenData('Selected Match', matchScreenData, !!selectedSeriesInfo)

  return (
    <div className="h-[calc(100vh-1px)] flex flex-col p-responsive gap-responsive overflow-hidden">
      {/* Compact Header with Collapsible Selector */}
      <div className="flex-shrink-0">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="icon-container-responsive bg-gradient-to-br from-primary/20 to-accent/20">
              <Sparkles className="text-primary" />
            </div>
            <div>
              <h1 className="text-responsive-xl font-bold tracking-tight">Analytics Hub</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered coaching insights
              </p>
            </div>
          </div>
        </div>

        {/* Series Selector - Collapsible */}
        <div className="border rounded-lg bg-card/50 backdrop-blur-sm">
          <button
            onClick={() => setSelectorExpanded(!selectorExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span className="text-muted-foreground">
              {selectedSeriesInfo
                ? `${selectedSeriesInfo.teamAName} vs ${selectedSeriesInfo.teamBName} - Click to change`
                : 'Select a series...'}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !selectorExpanded && "-rotate-90")} />
          </button>

          {selectorExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-2 border-t">
                <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                  <SeriesSelector
                    onSelect={handleSeriesSelect}
                    selectedSeriesId={selectedSeriesId}
                    compact
                  />
                </Suspense>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 min-h-0 overflow-auto">
        {isInitialLoad ? (
          <ReportSkeleton />
        ) : selectedSeriesId && selectedTeamId ? (
          <Suspense fallback={<ReportSkeleton />}>
            <CoachingReportView
              seriesId={selectedSeriesId}
              teamId={selectedTeamId}
            />
          </Suspense>
        ) : (
          <div className="h-full flex items-center justify-center">
            <p className="text-muted-foreground">No series available</p>
          </div>
        )}
      </div>
    </div>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-responsive">
      <div className="grid-responsive-stats">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`report-skeleton-${i}`} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-40" />
    </div>
  )
}
