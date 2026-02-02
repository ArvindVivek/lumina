"use client"

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Loader2, AlertCircle, CheckCircle2, Target, TrendingUp, Shield, Crosshair, DollarSign, History } from 'lucide-react'
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

  // Format large numbers for display
  const formatCredits = (value: number) => {
    if (Math.abs(value) >= 1000) {
      return `${(value / 1000).toFixed(1)}k`
    }
    return value.toString()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{ opacity: 0, height: 0 }}
        className="overflow-hidden"
      >
        <div className="bg-surface/80 backdrop-blur-sm border-t border-border p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-valorant-accent" />
              <span className="text-sm font-semibold">Round {roundNumber} Decision Analysis</span>
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
                  {/* Situation Overview */}
                  <div className="p-3 rounded-lg bg-valorant-accent/10 border border-valorant-accent/20">
                    <div className="flex items-center gap-2 mb-1">
                      <Crosshair className="h-4 w-4 text-valorant-accent" />
                      <span className="text-sm font-semibold text-valorant-accent">
                        {analysis.analysis.scenario_description}
                      </span>
                      {analysis.round_context.spike_site && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-chart-attack/20 text-chart-attack uppercase">
                          {analysis.round_context.spike_site}-site
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary">
                      Post-plant situation on {mapName}
                      {analysis.round_context.defender_economy && analysis.round_context.defender_economy > 0
                        ? ` • Defender loadout: $${formatCredits(analysis.round_context.defender_economy)}`
                        : ''
                      }
                    </p>
                  </div>

                  {/* Options Comparison - User Friendly */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Retake Option */}
                    <div className={cn(
                      "p-4 rounded-lg border-2 transition-all",
                      analysis.analysis.recommendation === 'retake'
                        ? "border-win bg-win/5"
                        : "border-border bg-surface/30"
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Crosshair className="h-4 w-4 text-chart-attack" />
                          <span className="font-semibold text-sm">Fight</span>
                        </div>
                        {analysis.analysis.recommendation === 'retake' && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-win text-white">
                            Better Choice
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-tertiary">Win chance</span>
                          <span className={cn(
                            "text-sm font-bold tabular-nums",
                            analysis.analysis.ev_analysis.retake.win_probability > 0.4 ? "text-win" :
                            analysis.analysis.ev_analysis.retake.win_probability > 0.2 ? "text-warning" : "text-loss"
                          )}>
                            {analysis.analysis.ev_analysis.retake.win_probability > 0
                              ? `${(analysis.analysis.ev_analysis.retake.win_probability * 100).toFixed(0)}%`
                              : "Very Low"
                            }
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-tertiary">If you win</span>
                          <span className="text-xs text-win">+$3,000 round bonus</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-tertiary">If you lose</span>
                          <span className="text-xs text-loss">
                            Lose ${formatCredits(analysis.analysis.ev_analysis.save.guaranteed_retention)} weapons
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Save Option */}
                    <div className={cn(
                      "p-4 rounded-lg border-2 transition-all",
                      analysis.analysis.recommendation === 'save'
                        ? "border-win bg-win/5"
                        : "border-border bg-surface/30"
                    )}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-chart-defense" />
                          <span className="font-semibold text-sm">Save</span>
                        </div>
                        {analysis.analysis.recommendation === 'save' && (
                          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-win text-white">
                            Better Choice
                          </span>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-tertiary">Keep weapons</span>
                          <span className="text-sm font-bold text-win tabular-nums">
                            ${formatCredits(analysis.analysis.ev_analysis.save.guaranteed_retention)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-tertiary">Loss bonus</span>
                          <span className="text-xs text-text-secondary">+$1,900</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-text-tertiary">Next round</span>
                          <span className="text-xs text-win">Full buy ready</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Line Recommendation */}
                  <div className={cn(
                    "p-4 rounded-lg border",
                    analysis.analysis.recommendation === 'save'
                      ? "bg-chart-defense/10 border-chart-defense/30"
                      : "bg-chart-attack/10 border-chart-attack/30"
                  )}>
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "p-2 rounded-full",
                        analysis.analysis.recommendation === 'save' ? "bg-chart-defense/20" : "bg-chart-attack/20"
                      )}>
                        {analysis.analysis.recommendation === 'save'
                          ? <Shield className="h-5 w-5 text-chart-defense" />
                          : <Crosshair className="h-5 w-5 text-chart-attack" />
                        }
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold mb-1">
                          {analysis.analysis.recommendation === 'save'
                            ? "Saving was the smarter play"
                            : "Fighting was worth the risk"
                          }
                        </p>
                        <p className="text-xs text-text-secondary">
                          {analysis.analysis.recommendation === 'save'
                            ? `With only ${(analysis.analysis.ev_analysis.retake.win_probability * 100).toFixed(0)}% win chance, saving $${formatCredits(analysis.analysis.ev_analysis.save.guaranteed_retention)} for a stronger next round gives better expected value over time.`
                            : `With ${(analysis.analysis.ev_analysis.retake.win_probability * 100).toFixed(0)}% win chance and the round bonus at stake, the retake attempt was mathematically justified.`
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* What Actually Happened */}
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-surface/50 border border-border">
                    {analysis.analysis.actual_outcome === 'success' ? (
                      <CheckCircle2 className="h-5 w-5 text-win flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-loss flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="text-sm font-medium">
                        What happened: Retake {analysis.analysis.actual_outcome === 'success' ? 'succeeded' : 'failed'}
                      </div>
                      <div className="text-xs text-text-tertiary">
                        {analysis.analysis.was_optimal
                          ? "The decision aligned with the statistically optimal play"
                          : analysis.analysis.actual_outcome === 'success'
                            ? "It worked this time, but saving had better odds long-term"
                            : "The numbers suggested saving would have been better here"
                        }
                      </div>
                    </div>
                  </div>

                  {/* Historical Context */}
                  <div className="flex items-center gap-2 text-xs text-text-tertiary pt-1 border-t border-border/50">
                    <History className="h-3 w-3" />
                    <span>
                      {analysis.analysis.historical_matches > 0
                        ? `Based on ${analysis.analysis.historical_matches} similar scenarios`
                        : 'Limited historical data available'
                      }
                    </span>
                  </div>
                </>
              ) : null}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
