import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/lib/data'
import { playerRounds } from '@/lib/data/db'
import { recentSeriesForPlayer, recentSeriesForTeam, resolveEntitiesFrom } from '@/lib/llm/entity-resolver'
import { mapMetricsFrom, playerOpeningDuelsFrom, seriesSummaryFrom } from '@/lib/analytics/coaching-queries'
import { answerQuestion } from '@/lib/llm/analyst'
import { checkAiLimit } from '@/lib/llm/limits'

export const maxDuration = 30

const Body = z.object({ query: z.string().min(1).max(500) })

/** Natural-language lookup: finds the player, team or match a question names, then answers it. */
export async function POST(request: NextRequest) {
  const parsed = Body.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'query is required' }, { status: 400 })
  const { query } = parsed.data

  try {
    const db = getDb()
    const entities = resolveEntitiesFrom(db, query)
    const response: { query: string; resolved_entities: typeof entities; data: Record<string, unknown>; llm_analysis?: string; source?: string } = {
      query,
      resolved_entities: entities,
      data: {},
    }
    let context: Parameters<typeof answerQuestion>[1] = {}

    if (entities.queryType === 'player' && entities.players.length) {
      const player = entities.players[0]
      const rows = playerRounds(db, player.id)
      const recent = recentSeriesForPlayer(db, player.id)
      response.data = {
        player,
        recent_series: recent,
        stats: {
          total_kills: rows.reduce((n, r) => n + r.stats.kills, 0),
          total_deaths: rows.reduce((n, r) => n + r.stats.deaths, 0),
          total_first_kills: rows.filter(r => r.stats.first_kill).length,
          total_first_deaths: rows.filter(r => r.stats.first_death).length,
          clutch_situations: rows.filter(r => r.stats.clutch_situation).length,
          clutch_wins: rows.filter(r => r.stats.clutch_won).length,
          total_rounds: rows.length,
          agents_played: [...new Set(rows.map(r => r.stats.agent))],
        },
        recent_match_stats: recent[0]
          ? playerOpeningDuelsFrom(db, recent[0].series_id, recent[0].team_id).find(p => p.player_id === player.id) ?? null
          : null,
      }
      if (recent[0]) context = { openingDuels: playerOpeningDuelsFrom(db, recent[0].series_id, recent[0].team_id) }
    } else if (entities.queryType === 'team' && entities.teams.length) {
      const team = entities.teams[0]
      const recent = recentSeriesForTeam(db, team.id)
      const metrics = recent[0] ? mapMetricsFrom(db, recent[0].id, team.id) : null
      response.data = {
        team,
        roster: db.players.filter(p => p.team_id === team.id).map(p => ({ id: p.id, name: p.name })),
        recent_series: recent,
        recent_match_metrics: metrics,
      }
      if (recent[0]) context = { summary: seriesSummaryFrom(db, recent[0].id, team.id) ?? undefined, mapMetrics: metrics ?? undefined }
    } else if (entities.queryType === 'match' && entities.series.length) {
      const series = entities.series[0]
      const teamA = db.seriesById.get(series.id)!.team_a_id
      const summary = seriesSummaryFrom(db, series.id, teamA)
      const mapMetrics = mapMetricsFrom(db, series.id, teamA)
      const openingDuels = playerOpeningDuelsFrom(db, series.id, teamA)
      response.data = { series, summary, map_metrics: mapMetrics, opening_duels: openingDuels }
      context = { summary: summary ?? undefined, mapMetrics, openingDuels }
    } else if (entities.queryType === 'match') {
      response.data = { teams: entities.teams, series: [], message: 'These teams did not meet in the sample data.' }
    } else {
      response.data = { message: 'Name a player, a team, or two teams to compare.' }
    }

    if (Object.keys(context).length) {
      const limited = checkAiLimit(request)
      if (limited) return limited
      const result = await answerQuestion(query, context)
      response.llm_analysis = result.analysis
      response.source = result.source
    }
    return NextResponse.json(response)
  } catch (error) {
    console.error('Error processing query:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
