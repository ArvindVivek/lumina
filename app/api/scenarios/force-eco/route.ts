import { NextRequest, NextResponse } from 'next/server'
import { createPostgresClient } from '@/lib/supabase/client'
import { matchForceEcoSituations } from '@/lib/analytics/scenario-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type {
  ScenarioResponse,
  ForceEcoQuery,
  ForceEcoData
} from '@/lib/analytics/scenario-types'

export async function POST(request: NextRequest) {
  const sql = createPostgresClient()

  try {
    const body = await request.json()

    // Validate required fields
    const { team_economy, opponent_economy } = body
    if (!team_economy || !opponent_economy) {
      return NextResponse.json(
        { error: 'Missing required fields: team_economy, opponent_economy' },
        { status: 400 }
      )
    }

    const params: ForceEcoQuery = {
      team_economy: Number(team_economy),
      opponent_economy: Number(opponent_economy),
      round_number: body.round_number,
      map_name: body.map_name,
    }

    // Classify team economy
    const economyCategory = params.team_economy < 10000 ? 'eco'
      : params.team_economy < 20000 ? 'force_buy'
      : 'full_buy'

    // Classify opponent economy
    const opponentCategory = params.opponent_economy < 10000 ? 'eco'
      : params.opponent_economy < 20000 ? 'force_buy'
      : 'full_buy'

    // Match similar situations
    const matches = await matchForceEcoSituations(sql, params)

    // Calculate win rates by category
    const ecoMatches = matches.filter(m => m.economy_category === 'eco')
    const forceMatches = matches.filter(m => m.economy_category === 'force_buy')
    const fullBuyMatches = matches.filter(m => m.economy_category === 'full_buy')

    const ecoWinRate = ecoMatches.length > 0
      ? ecoMatches.filter(m => m.team_won).length / ecoMatches.length
      : 0

    const forceWinRate = forceMatches.length > 0
      ? forceMatches.filter(m => m.team_won).length / forceMatches.length
      : 0

    const fullBuyWinRate = fullBuyMatches.length > 0
      ? fullBuyMatches.filter(m => m.team_won).length / fullBuyMatches.length
      : 0

    // Build data object
    const data: ForceEcoData = {
      force_win_rate: forceWinRate,
      eco_win_rate: ecoWinRate,
      full_buy_win_rate: fullBuyWinRate,
      economy_category: economyCategory,
      opponent_category: opponentCategory,
      rounds_analyzed: matches.length,
    }

    // Calculate confidence based on matches in query's economy category
    const categoryMatches = matches.filter(m => m.economy_category === economyCategory)
    const confidence = calculateConfidence(categoryMatches.length, "similar rounds")

    // Build recommendation (only if confidence is not low)
    let recommendation: { decision: string; rationale: string } | null = null

    if (confidence.level !== 'low') {
      const queryWinRate = economyCategory === 'eco' ? ecoWinRate
        : economyCategory === 'force_buy' ? forceWinRate
        : fullBuyWinRate

      if (economyCategory === 'eco' && queryWinRate < 0.15) {
        recommendation = {
          decision: 'save',
          rationale: `Eco rounds have only ${(queryWinRate * 100).toFixed(0)}% win rate - consider saving for full buy`
        }
      } else if (economyCategory === 'force_buy' && queryWinRate > 0.35) {
        recommendation = {
          decision: 'force_buy',
          rationale: `Force buy shows competitive ${(queryWinRate * 100).toFixed(0)}% win rate in these situations`
        }
      } else if (economyCategory === 'force_buy' && queryWinRate < 0.20) {
        recommendation = {
          decision: 'save',
          rationale: `Force buy has only ${(queryWinRate * 100).toFixed(0)}% success rate - full save recommended`
        }
      } else {
        recommendation = {
          decision: economyCategory,
          rationale: `${economyCategory.replace('_', ' ')} has ${(queryWinRate * 100).toFixed(0)}% win probability based on historical data`
        }
      }
    }

    const response: ScenarioResponse<ForceEcoData> = {
      scenario_type: 'force_eco',
      query: params,
      matches: matches.length,
      data,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error analyzing force/eco scenario:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  } finally {
    await sql.end()
  }
}
