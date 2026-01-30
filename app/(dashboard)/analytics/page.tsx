"use client"

import { useState, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { SeriesSelector } from '@/components/analytics/series-selector'
import { CoachingReportView } from '@/components/analytics/coaching-report-view'
import { HypotheticalView } from '@/components/analytics/hypothetical-view'
import { ScenarioSearch } from '@/components/analytics/scenario-search'
import { ChatInterface } from '@/components/analytics/chat-interface'
import {
  FileText,
  Target,
  History,
  MessageSquare,
  Sparkles,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { id: 'coaching', label: 'Coaching', icon: FileText, description: 'Full series analysis' },
  { id: 'hypothetical', label: 'What-If', icon: Target, description: 'Round analysis' },
  { id: 'scenarios', label: 'Scenarios', icon: History, description: 'Historical matching' },
  { id: 'chat', label: 'AI Chat', icon: MessageSquare, description: 'Ask questions' },
]

export default function AnalyticsPage() {
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('coaching')
  const [selectorExpanded, setSelectorExpanded] = useState(true)

  return (
    <div className="h-[calc(100vh-1px)] flex flex-col p-4 gap-4 overflow-hidden">
      {/* Compact Header with Collapsible Selector */}
      <div className="flex-shrink-0">
        {/* Header Row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Analytics Hub</h1>
              <p className="text-sm text-muted-foreground">
                AI-powered coaching insights
              </p>
            </div>
          </div>

          {/* Tab Navigation - Horizontal Compact */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-9 bg-muted/50">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="text-xs px-3 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm gap-1.5"
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {/* Series Selector - Collapsible */}
        <div className="border rounded-lg bg-card">
          <button
            onClick={() => setSelectorExpanded(!selectorExpanded)}
            className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            <span className="text-muted-foreground">
              {selectedSeriesId ? 'Series Selected' : 'Select a Series to Analyze'}
            </span>
            <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", !selectorExpanded && "-rotate-90")} />
          </button>

          <AnimatePresence initial={false}>
            {selectorExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-4 pt-2 border-t">
                  <Suspense fallback={<Skeleton className="h-32 w-full" />}>
                    <SeriesSelector
                      onSelect={(seriesId, teamAId, teamBId) => {
                        setSelectedSeriesId(seriesId)
                        setSelectedTeamId(teamAId)
                        setSelectorExpanded(false) // Auto-collapse after selection
                      }}
                      selectedSeriesId={selectedSeriesId}
                      compact
                    />
                  </Suspense>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Main Content - Scrollable */}
      <div className="flex-1 min-h-0 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'coaching' && (
              selectedSeriesId && selectedTeamId ? (
                <Suspense fallback={<ReportSkeleton />}>
                  <CoachingReportView
                    seriesId={selectedSeriesId}
                    teamId={selectedTeamId}
                  />
                </Suspense>
              ) : (
                <EmptyState
                  icon={FileText}
                  title="Select a series"
                  description="Choose a series from above to generate a coaching report"
                />
              )
            )}

            {activeTab === 'hypothetical' && (
              selectedSeriesId ? (
                <Suspense fallback={<HypotheticalSkeleton />}>
                  <HypotheticalView
                    seriesId={selectedSeriesId}
                    teamId={selectedTeamId || undefined}
                  />
                </Suspense>
              ) : (
                <EmptyState
                  icon={Target}
                  title="Select a series"
                  description="Choose a series to explore what-if scenarios"
                />
              )
            )}

            {activeTab === 'scenarios' && (
              <ScenarioSearch />
            )}

            {activeTab === 'chat' && (
              <ChatInterface
                seriesId={selectedSeriesId || undefined}
                teamId={selectedTeamId || undefined}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType
  title: string
  description: string
}) {
  return (
    <Card className="border-dashed h-full flex items-center justify-center">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <div className="p-4 rounded-full bg-muted mb-4">
          <Icon className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground text-center max-w-sm">
          {description}
        </p>
      </CardContent>
    </Card>
  )
}

function ReportSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={`report-skeleton-${i}`} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-48" />
      <Skeleton className="h-40" />
    </div>
  )
}

function HypotheticalSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-[200px]" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}
