import { NextRequest, NextResponse } from 'next/server'
import { getPostgresPool } from '@/lib/supabase/server'
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
  isLLMAvailable,
} from '@/lib/llm/analyst'
import type {
  SeriesSummary,
  MapMetrics,
  PlayerOpeningDuels,
  RoundContext,
} from '@/lib/analytics/coaching-types'

export async function POST(request: NextRequest) {
  if (!isLLMAvailable()) {
    return NextResponse.json(
      { error: 'LLM not configured. Set OPENAI_API_KEY environment variable.' },
      { status: 503 }
    )
  }

  const sql = getPostgresPool()

  try {
    const body = await request.json()
    const {
      query_type,
      series_id,
      team_focus,
      player_id,
      round_id,
      question,
    } = body

    if (!query_type) {
      return NextResponse.json(
        { error: 'query_type is required' },
        { status: 400 }
      )
    }

    let result

    switch (query_type) {
      case 'match_review': {
        if (!series_id || !team_focus) {
          return NextResponse.json(
            { error: 'series_id and team_focus required for match_review' },
            { status: 400 }
          )
        }

        const [summary, mapMetrics, openingDuels, antiStrat, mistakes] = await Promise.all([
          querySeriesSummary(sql, series_id, team_focus),
          queryMapMetrics(sql, series_id, team_focus),
          queryPlayerOpeningDuels(sql, series_id, team_focus),
          detectAntiStratSignals(sql, series_id, team_focus),
          detectForcedMistakes(sql, series_id, team_focus),
        ])

        if (!summary) {
          return NextResponse.json({ error: 'Series not found' }, { status: 404 })
        }

        result = await generateMatchReview(summary, mapMetrics, openingDuels, antiStrat, mistakes)
        break
      }

      case 'player_analysis': {
        if (!series_id || !team_focus || !player_id) {
          return NextResponse.json(
            { error: 'series_id, team_focus, and player_id required for player_analysis' },
            { status: 400 }
          )
        }

        // Get player data
        const openingDuels = await queryPlayerOpeningDuels(sql, series_id, team_focus)
        const playerDuels = openingDuels.find(p => p.player_id === player_id)

        if (!playerDuels) {
          return NextResponse.json({ error: 'Player not found in series' }, { status: 404 })
        }

        // Get player's agents and clutch stats
        const playerStats = await sql`
          SELECT
            prs.agent,
            SUM(CASE WHEN prs.clutch_situation = TRUE THEN 1 ELSE 0 END) as clutch_situations,
            SUM(CASE WHEN prs.clutch_won = TRUE THEN 1 ELSE 0 END) as clutch_wins,
            SUM(CASE WHEN prs.deaths > 0 AND prs.traded = TRUE THEN 1 ELSE 0 END)::float /
              NULLIF(SUM(CASE WHEN prs.deaths > 0 THEN 1 ELSE 0 END), 0) as trade_rate
          FROM public.player_round_stats prs
          JOIN public.rounds r ON prs.round_id = r.id
          JOIN public.games g ON r.game_id = g.id
          WHERE g.series_id = ${series_id}
            AND prs.player_id = ${player_id}
          GROUP BY prs.agent
        `

        const agents = [...new Set(playerStats.map(p => p.agent))]
        const clutchStats = {
          situations: playerStats.reduce((sum, p) => sum + Number(p.clutch_situations), 0),
          wins: playerStats.reduce((sum, p) => sum + Number(p.clutch_wins), 0),
        }
        const tradeRate = Number(playerStats[0]?.trade_rate) || 0

        result = await generatePlayerAnalysis(
          playerDuels.player_name,
          agents,
          playerDuels,
          clutchStats,
          tradeRate,
          [] // Notable rounds would require more queries
        )
        break
      }

      case 'round_analysis': {
        if (!round_id) {
          return NextResponse.json(
            { error: 'round_id required for round_analysis' },
            { status: 400 }
          )
        }

        const roundContext = await queryRoundContext(sql, round_id)
        if (!roundContext) {
          return NextResponse.json({ error: 'Round not found' }, { status: 404 })
        }

        result = await generateRoundAnalysis(roundContext)
        break
      }

      case 'question': {
        if (!question) {
          return NextResponse.json(
            { error: 'question required for question query_type' },
            { status: 400 }
          )
        }

        // Build context based on what's provided
        const context: {
          summary?: SeriesSummary
          mapMetrics?: MapMetrics[]
          openingDuels?: PlayerOpeningDuels[]
          roundContext?: RoundContext
        } = {}

        if (series_id && team_focus) {
          const summary = await querySeriesSummary(sql, series_id, team_focus)
          if (summary) context.summary = summary
          context.mapMetrics = await queryMapMetrics(sql, series_id, team_focus)
          context.openingDuels = await queryPlayerOpeningDuels(sql, series_id, team_focus)
        }

        if (round_id) {
          const roundContext = await queryRoundContext(sql, round_id)
          if (roundContext) context.roundContext = roundContext
        }

        result = await answerQuestion(question, context)
        break
      }

      default:
        return NextResponse.json(
          { error: `Unknown query_type: ${query_type}` },
          { status: 400 }
        )
    }

    return NextResponse.json({
      query_type,
      analysis: result.analysis,
      model: result.model,
      tokens_used: result.tokens_used,
    })
  } catch (error) {
    console.error('Error generating LLM analysis:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
