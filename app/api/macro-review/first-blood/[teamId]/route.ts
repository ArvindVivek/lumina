import { NextRequest, NextResponse } from 'next/server'
import { getPostgresPool } from '@/lib/supabase/server'
import { queryFirstBloodConversion } from '@/lib/analytics/macro-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { MacroInsightResponse, FirstBloodConversionData } from '@/lib/analytics/macro-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  const sql = getPostgresPool()

  try {
    const { teamId } = await params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournament_id')

    const row = await queryFirstBloodConversion(sql, teamId, tournamentId || undefined)

    const firstBloods = parseInt(row.first_bloods)
    const firstBloodWins = parseInt(row.first_blood_wins)
    const conversionRate = parseFloat(row.first_blood_conversion_rate) / 100

    const data: FirstBloodConversionData = {
      first_bloods: firstBloods,
      first_blood_wins: firstBloodWins,
      conversion_rate: conversionRate,
    }

    const confidence = calculateConfidence(firstBloods, "rounds")

    let insight = ""
    let recommendation: string | null = null

    if (conversionRate > 0.65) {
      insight = "Excellent first blood conversion. Team capitalizes on early picks effectively."
      recommendation = null
    } else if (conversionRate < 0.55) {
      insight = "First blood advantage not being converted to round wins consistently."
      recommendation = "Review follow-up strategies after getting first blood. Ensure team plays for trades and doesn't overextend."
    } else {
      insight = "Average first blood conversion with room for improvement."
      recommendation = "Focus on trading and maintaining man advantage after first blood."
    }

    const response: MacroInsightResponse<FirstBloodConversionData> = {
      team_id: teamId,
      metric: "first_blood_conversion",
      data,
      insight,
      recommendation,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error fetching first blood conversion:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
