import "server-only"
import { coachNote, noteToMarkdown, type CoachNote } from './coach'
import {
  hypotheticalFacts,
  hypotheticalFallback,
  mapMetricLines,
  matchReviewFacts,
  matchReviewFallback,
  openingDuelLines,
  playerFacts,
  playerFallback,
  roundDecisionFacts,
  roundDecisionFallback,
  roundFacts,
  roundFallback,
} from './facts'
import type {
  SeriesSummary,
  MapMetrics,
  PlayerOpeningDuels,
  RoundContext,
  ScenarioMatch,
  ScenarioStats,
  AntiStratSignal,
  ForcedMistake,
} from '../analytics/coaching-types'
import type { SaveRetakeEV } from '../analytics/scenario-types'

/*
 * Write-ups for the analytics routes. Each builds compact facts from computed numbers, asks the
 * coach (lib/llm/coach.ts) and falls back to a rule-written note. Callers get markdown plus which
 * path answered, so a route never fails because the model did.
 */

export interface LLMAnalysisResult {
  analysis: string
  note: CoachNote
  source: 'ai' | 'fallback'
  model: string
  tokens_used: number
}

async function run(label: string, task: string, facts: string, fallback: () => CoachNote): Promise<LLMAnalysisResult> {
  const r = await coachNote({ label, task, facts, fallback })
  return { analysis: noteToMarkdown(r.note), note: r.note, source: r.source, model: r.model, tokens_used: r.tokens_used }
}

export function generateMatchReview(
  summary: SeriesSummary,
  mapMetrics: MapMetrics[],
  openingDuels: PlayerOpeningDuels[],
  antiStratSignals: AntiStratSignal[],
  forcedMistakes: ForcedMistake[],
) {
  return run(
    'match_review',
    `Review this series for ${summary.team_name}: what worked, what to fix, one practice focus.`,
    matchReviewFacts(summary, mapMetrics, openingDuels, antiStratSignals, forcedMistakes),
    () => matchReviewFallback(summary, mapMetrics, openingDuels, antiStratSignals, forcedMistakes),
  )
}

export function generatePlayerAnalysis(
  playerName: string,
  agents: string[],
  openingDuels: PlayerOpeningDuels,
  clutchStats: { situations: number; wins: number },
  tradeRate: number,
) {
  return run(
    'player_analysis',
    `Assess ${playerName}'s series: opening duels, trades, clutches, one thing to work on.`,
    playerFacts(playerName, agents, openingDuels, clutchStats, tradeRate),
    () => playerFallback(playerName, openingDuels, clutchStats, tradeRate),
  )
}

export function generateRoundAnalysis(roundContext: RoundContext) {
  return run(
    'round_analysis',
    'Explain how this round was won or lost and what to review.',
    roundFacts(roundContext),
    () => roundFallback(roundContext),
  )
}

export function generateHypotheticalAnalysis(
  attackerAlive: number,
  defenderAlive: number,
  spikePlanted: boolean,
  mapName: string,
  scenarioStats: ScenarioStats,
  _similarScenarios: ScenarioMatch[],
) {
  return run(
    'hypothetical',
    'Say which side this situation favours and how each side should play it.',
    hypotheticalFacts(attackerAlive, defenderAlive, spikePlanted, mapName, scenarioStats),
    () => hypotheticalFallback(attackerAlive, defenderAlive, spikePlanted, mapName, scenarioStats),
  )
}

export function generateRoundDecisionAnalysis(
  roundContext: RoundContext,
  evAnalysis: SaveRetakeEV,
  historicalMatches: number,
  defenderAlive: number,
  attackerAlive: number,
  defenderWonRound: boolean,
) {
  return run(
    'round_decision',
    'Was retaking the right call? Judge by the numbers, then give one takeaway.',
    roundDecisionFacts(roundContext, evAnalysis, historicalMatches, defenderAlive, attackerAlive, defenderWonRound),
    () => roundDecisionFallback(roundContext, evAnalysis, historicalMatches, defenderAlive, attackerAlive, defenderWonRound),
  )
}

/** A free question about a series, a round, or both. */
export function answerQuestion(
  question: string,
  context: {
    summary?: SeriesSummary
    mapMetrics?: MapMetrics[]
    openingDuels?: PlayerOpeningDuels[]
    roundContext?: RoundContext
  },
) {
  const lines: string[] = []
  if (context.summary) lines.push(`${context.summary.team_name} vs ${context.summary.opponent_name}: ${context.summary.result} ${context.summary.score}.`)
  if (context.mapMetrics) lines.push(...mapMetricLines(context.mapMetrics))
  if (context.openingDuels) lines.push(...openingDuelLines(context.openingDuels))
  if (context.roundContext) lines.push(roundFacts(context.roundContext))
  const facts = lines.join('\n') || 'No match data was selected.'
  return run(
    'question',
    `Answer this question from the data: "${question.slice(0, 300)}"`,
    facts,
    () => ({
      headline: 'The AI coach is unavailable right now. Here are the numbers behind your question.',
      points: lines.slice(0, 4).map((l) => ({ kind: 'pattern' as const, title: 'From the data', detail: l })),
      next_step: 'Try again in a minute for a written answer.',
    }),
  )
}
