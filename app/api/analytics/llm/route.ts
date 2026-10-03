import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/data'
import { playerRounds } from '@/lib/data/db'
import {
  querySeriesSummary,
  queryMapMetrics,
  queryPlayerOpeningDuels,
  queryRoundContext,
  detectAntiStratSignals,
  detectForcedMistakes,
} from '@/lib/analytics/coaching-queries'
import {
  generateMatchReview,
  generatePlayerAnalysis,
  generateRoundAnalysis,
  answerQuestion,
} from '@/lib/llm/analyst'
import { checkAiLimit } from '@/lib/llm/limits'
import type { SeriesSummary, MapMetrics, PlayerOpeningDuels, RoundContext } from '@/lib/analytics/coaching-types'

export const maxDuration = 30

const id = z.string().min(1).max(80)
const Body = z.object({
  query_type: z.enum(['match_review', 'player_analysis', 'round_analysis', 'question']),
  series_id: id.optional(),
  team_focus: id.optional(),
  player_id: id.optional(),
  round_id: id.optional(),
  question: z.string().min(1).max(500).optional(),
})

/** AI write-ups on demand: a series review, a player, a round, or a free question. */
export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'query_type is required, with the ids it needs' }, { status: 400 })
  }
  const { query_type, series_id, team_focus, player_id, round_id, question } = parsed.data

  try {
    let result
    switch (query_type) {
      case 'match_review': {
        if (!series_id || !team_focus) {
          return NextResponse.json({ error: 'series_id and team_focus required for match_review' }, { status: 400 })
        }
        const summary = await querySeriesSummary(series_id, team_focus)
        if (!summary) return NextResponse.json({ error: 'Series not found' }, { status: 404 })
        const limited = checkAiLimit(request)
        if (limited) return limited
        const [mapMetrics, openingDuels, antiStrat, mistakes] = await Promise.all([
          queryMapMetrics(series_id, team_focus),
          queryPlayerOpeningDuels(series_id, team_focus),
          detectAntiStratSignals(series_id, team_focus),
          detectForcedMistakes(series_id, team_focus),
        ])
        result = await generateMatchReview(summary, mapMetrics, openingDuels, antiStrat, mistakes)
        break
      }

      case 'player_analysis': {
        if (!series_id || !team_focus || !player_id) {
          return NextResponse.json({ error: 'series_id, team_focus, and player_id required for player_analysis' }, { status: 400 })
        }
        const playerDuels = (await queryPlayerOpeningDuels(series_id, team_focus)).find(p => p.player_id === player_id)
        if (!playerDuels) return NextResponse.json({ error: 'Player not found in series' }, { status: 404 })
        const limited = checkAiLimit(request)
        if (limited) return limited
        const rows = playerRounds(getDb(), player_id, { seriesId: series_id })
        const deaths = rows.filter(r => r.stats.deaths > 0)
        result = await generatePlayerAnalysis(
          playerDuels.player_name,
          [...new Set(rows.map(r => r.stats.agent))],
          playerDuels,
          {
            situations: rows.filter(r => r.stats.clutch_situation).length,
            wins: rows.filter(r => r.stats.clutch_won).length,
          },
          deaths.length ? deaths.filter(r => r.stats.traded).length / deaths.length : 0,
        )
        break
      }

      case 'round_analysis': {
        if (!round_id) return NextResponse.json({ error: 'round_id required for round_analysis' }, { status: 400 })
        const roundContext = await queryRoundContext(round_id)
        if (!roundContext) return NextResponse.json({ error: 'Round not found' }, { status: 404 })
        const limited = checkAiLimit(request)
        if (limited) return limited
        result = await generateRoundAnalysis(roundContext)
        break
      }

      case 'question': {
        if (!question) return NextResponse.json({ error: 'question required for question query_type' }, { status: 400 })
        const context: { summary?: SeriesSummary; mapMetrics?: MapMetrics[]; openingDuels?: PlayerOpeningDuels[]; roundContext?: RoundContext } = {}
        if (series_id && team_focus) {
          const summary = await querySeriesSummary(series_id, team_focus)
          if (summary) context.summary = summary
          context.mapMetrics = await queryMapMetrics(series_id, team_focus)
          context.openingDuels = await queryPlayerOpeningDuels(series_id, team_focus)
        }
        if (round_id) {
          const roundContext = await queryRoundContext(round_id)
          if (roundContext) context.roundContext = roundContext
        }
        const limited = checkAiLimit(request)
        if (limited) return limited
        result = await answerQuestion(question, context)
        break
      }
    }

    return NextResponse.json({
      query_type,
      analysis: result.analysis,
      note: result.note,
      source: result.source,
      tokens_used: result.tokens_used,
    })
  } catch (error) {
    console.error('Error generating analysis:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
