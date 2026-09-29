import { getDb } from '@/lib/data'
import {
  querySeriesSummary,
  queryMapMetrics,
  queryPlayerOpeningDuels,
  queryRoundsForReview,
  detectAntiStratSignals,
  detectForcedMistakes,
} from '@/lib/analytics/coaching-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { CoachingReport, ActionPlan, VODReviewNote } from '@/lib/analytics/coaching-types'

/**
 * The coaching report for one team in one series: summary, per-map numbers, opening duels,
 * rounds to rewatch, patterns and an action plan. Shared by the API route and the Match report
 * page. Returns null when the series doesn't exist or the team didn't play in it.
 */
export async function buildCoachingReport(seriesId: string, teamId: string) {
    // Fetch all data in parallel
    const [
      summary,
      mapMetrics,
      openingDuels,
      roundsForReview,
      antiStratSignals,
      forcedMistakes,
    ] = await Promise.all([
      querySeriesSummary(seriesId, teamId),
      queryMapMetrics(seriesId, teamId),
      queryPlayerOpeningDuels(seriesId, teamId),
      queryRoundsForReview(seriesId, teamId),
      detectAntiStratSignals(seriesId, teamId),
      detectForcedMistakes(seriesId, teamId),
    ])

    if (!summary) {
      return null
    }

    // Analyze strengths and weaknesses
    const avgFBConversion = mapMetrics.reduce((sum, m) => sum + m.fb_conversion_rate, 0) / mapMetrics.length
    const avgTradeRate = mapMetrics.reduce((sum, m) => sum + m.trade_rate, 0) / mapMetrics.length
    const totalUntraded = mapMetrics.reduce((sum, m) => sum + m.untraded_deaths, 0)

    // Strength and weakness, judged against every team-series in the bundled sample: the middle
    // half won 66-79% of rounds after the first kill and traded 23-28% of deaths. Beyond those
    // quartiles is worth calling out.
    const pctText = (x: number) => `${Math.round(x * 100)}%`
    if (avgFBConversion > 0.79) {
      summary.key_strength = `Turned first kills into round wins ${pctText(avgFBConversion)} of the time`
    } else if (avgTradeRate > 0.28) {
      summary.key_strength = `Traded ${pctText(avgTradeRate)} of deaths, keeping fights even`
    } else if (openingDuels[0] && openingDuels[0].net > 0) {
      summary.key_strength = `${openingDuels[0].player_name} won the opening duels (${openingDuels[0].first_kills}-${openingDuels[0].first_deaths})`
    } else {
      summary.key_strength = 'No single number stood out from the pro average'
    }

    if (avgTradeRate < 0.23) {
      summary.key_weakness = `Only ${pctText(avgTradeRate)} of deaths were traded (${totalUntraded} untraded)`
    } else if (avgFBConversion < 0.66) {
      summary.key_weakness = `Won just ${pctText(avgFBConversion)} of rounds after getting the first kill`
    } else if (forcedMistakes.length > 0) {
      summary.key_weakness = forcedMistakes[0].mistake
    } else {
      summary.key_weakness = 'Nothing fell below the pro average'
    }

    // Rounds to rewatch: most important first, taking turns across maps so one map's rounds
    // don't fill the whole list.
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, skip: 4 }
    const seen = new Map<string, number>()
    const turn = new Map(
      roundsForReview.map(r => {
        const key = `${r.review_priority}|${r.game_id}`
        const n = seen.get(key) ?? 0
        seen.set(key, n + 1)
        return [r.round_id, n] as const
      })
    )
    const priorityRounds = roundsForReview
      .filter(r => r.review_priority !== 'skip')
      .sort((a, b) =>
        priorityOrder[a.review_priority] - priorityOrder[b.review_priority] ||
        turn.get(a.round_id)! - turn.get(b.round_id)!
      )
      .slice(0, 20)

    const vodReviewNotes: VODReviewNote[] = priorityRounds.map(r => ({
      game_id: r.game_id,
      round_id: r.round_id,
      game_number: getDb().game.get(r.game_id)?.sequence_number ?? 1,
      map_name: r.map_name,
      round_number: r.round_number,
      reason: r.priority_reason,
      fb_time_ms: r.first_blood?.time_ms || null,
      review_priority: r.review_priority as 'critical' | 'high' | 'medium' | 'low',
    }))

    // Build action plan
    const actionPlan: ActionPlan = {
      immediate: [],
      medium_term: [],
    }

    // Immediate actions from forced mistakes
    for (const mistake of forcedMistakes) {
      actionPlan.immediate.push({
        action: mistake.fix,
        context: mistake.detail,
        priority: mistake.severity === 'critical' ? 'high' : 'medium',
      })
    }

    // Add anti-strat defense
    for (const signal of antiStratSignals) {
      actionPlan.medium_term.push({
        action: signal.implication,
        context: signal.signal,
        priority: signal.severity === 'critical' ? 'high' : 'medium',
      })
    }

    const confidence = calculateConfidence(summary.total_rounds, 'rounds')

    const report: CoachingReport = {
      generated_at: new Date().toISOString(),
      series_id: seriesId,
      team_focus: teamId,
      summary,
      key_metrics: mapMetrics,
      opening_duels: openingDuels,
      anti_strat_signals: antiStratSignals,
      forced_mistakes: forcedMistakes,
      vod_review_notes: vodReviewNotes,
      action_plan: actionPlan,
      confidence,
    }

    return { report, summary, mapMetrics, openingDuels, antiStratSignals, forcedMistakes, roundsForReview }
}
