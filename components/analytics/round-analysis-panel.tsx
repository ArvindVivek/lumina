"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, Target } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RoundAnalysisPanelProps {
  roundId: string
  roundNumber: number
  mapName: string
  spikePlanted: boolean
  onClose: () => void
}

interface RoundDecisionAnalysis {
  round_id: string
  scenario_type: string
  applicable: boolean
  message?: string
  round_context: {
    round_number: number
    map_name: string
    spike_planted: boolean
    spike_site?: string
    defender_alive?: number
    attacker_alive?: number
    defender_economy?: number
    outcome?: string
  }
  analysis?: {
    scenario_description: string
    historical_matches: number
    ev_analysis: {
      retake: {
        expected_value: number
        win_probability: number
      }
      save: {
        expected_value: number
        guaranteed_retention: number
      }
      recommended_decision: 'retake' | 'save'
      ev_difference: number
    }
    actual_decision: string
    actual_outcome: string
    was_optimal: boolean
    recommendation: string
  }
  insights: string[]
  llm_analysis?: string
}

export function RoundAnalysisPanel({
  roundId,
  roundNumber,
  mapName,
  spikePlanted,
  onClose,
}: RoundAnalysisPanelProps) {
  const [analysis, setAnalysis] = useState<RoundDecisionAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAnalysis() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/analytics/round-decision/${roundId}`)
        if (!res.ok) {
          throw new Error('Failed to fetch round analysis')
        }
        const data = await res.json()
        setAnalysis(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }
    fetchAnalysis()
  }, [roundId])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className="bg-surface/80 backdrop-blur-sm border-t border-border p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-valorant-accent" />
              <span className="text-sm font-semibold">Round {roundNumber} Analysis</span>
              <span className="text-xs text-text-tertiary capitalize">{mapName}</span>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-surface-hover rounded transition-colors"
            >
              <X className="h-4 w-4 text-text-tertiary" />
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
              <span className="ml-2 text-sm text-text-tertiary">Analyzing round...</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-loss text-sm py-4">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && analysis && (
            <div className="space-y-4">
              {!analysis.applicable ? (
                <div className="text-sm text-text-secondary py-2">
                  {analysis.message || 'Save/retake analysis not applicable for this round.'}
                </div>
              ) : analysis.analysis ? (
                <>
                  {/* Scenario Description */}
                  <div className="flex items-center gap-3 text-sm">
                    <span className="px-2 py-1 rounded bg-valorant-accent/20 text-valorant-accent font-medium">
                      {analysis.analysis.scenario_description}
                    </span>
                    <span className="text-text-tertiary">
                      Based on {analysis.analysis.historical_matches} similar scenarios
                    </span>
                  </div>

                  {/* EV Comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className={cn(
                      "p-3 rounded-lg border",
                      analysis.analysis.recommendation === 'retake'
                        ? "border-win/30 bg-win/5"
                        : "border-border bg-surface/50"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-text-tertiary uppercase">Retake</span>
                        {analysis.analysis.recommendation === 'retake' && (
                          <span className="text-xs text-win font-medium">Recommended</span>
                        )}
                      </div>
                      <div className="text-lg font-bold tabular-nums">
                        EV: {analysis.analysis.ev_analysis.retake.expected_value > 0 ? '+' : ''}{analysis.analysis.ev_analysis.retake.expected_value}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {(analysis.analysis.ev_analysis.retake.win_probability * 100).toFixed(0)}% win probability
                      </div>
                    </div>

                    <div className={cn(
                      "p-3 rounded-lg border",
                      analysis.analysis.recommendation === 'save'
                        ? "border-win/30 bg-win/5"
                        : "border-border bg-surface/50"
                    )}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-text-tertiary uppercase">Save</span>
                        {analysis.analysis.recommendation === 'save' && (
                          <span className="text-xs text-win font-medium">Recommended</span>
                        )}
                      </div>
                      <div className="text-lg font-bold tabular-nums">
                        EV: +{analysis.analysis.ev_analysis.save.expected_value}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        ${analysis.analysis.ev_analysis.save.guaranteed_retention} preserved
                      </div>
                    </div>
                  </div>

                  {/* Result */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-surface/50 border border-border">
                    {analysis.analysis.actual_outcome === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-win" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-loss" />
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        Retake {analysis.analysis.actual_outcome === 'success' ? 'Successful' : 'Failed'}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {analysis.analysis.was_optimal
                          ? 'Decision aligned with optimal play'
                          : `Statistically, ${analysis.analysis.recommendation} had better expected value`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-xs font-medium",
                        analysis.analysis.recommendation === 'save' ? "text-loss" : "text-win"
                      )}>
                        +{analysis.analysis.ev_analysis.ev_difference} EV
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {analysis.analysis.recommendation} advantage
                      </div>
                    </div>
                  </div>

                  {/* Insights */}
                  {analysis.insights.length > 0 && (
                    <div className="space-y-1">
                      <div className="text-xs text-text-tertiary uppercase">Insights</div>
                      <ul className="space-y-1">
                        {analysis.insights.map((insight, i) => (
                          <li key={i} className="text-xs text-text-secondary flex items-start gap-2">
                            <span className="text-text-muted">•</span>
                            {insight}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
