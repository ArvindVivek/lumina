import { NextRequest, NextResponse } from 'next/server'
import { getPostgresPool } from '@/lib/supabase/server'
import {
  resolveEntities,
  getRecentSeriesForTeam,
  getRecentSeriesForPlayer,
} from '@/lib/llm/entity-resolver'
import {
  querySeriesSummary,
  queryMapMetrics,
  queryPlayerOpeningDuels,
} from '@/lib/analytics/coaching-queries'
import { answerQuestion, isLLMAvailable } from '@/lib/llm/analyst'
import type { SeriesSummary, MapMetrics, PlayerOpeningDuels } from '@/lib/analytics/coaching-types'

export async function POST(request: NextRequest) {
  const sql = getPostgresPool()

  try {
    const body = await request.json()
    const { query } = body

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      )
    }

    // Resolve entities from the query
    const entities = await resolveEntities(sql, query)

    // Build response based on query type
    let response: {
      query: string
      resolved_entities: typeof entities
      data: Record<string, unknown>
      llm_analysis?: string
    } = {
      query,
      resolved_entities: entities,
      data: {},
    }

    switch (entities.queryType) {
      case 'player': {
        if (entities.players.length > 0) {
          const player = entities.players[0]

          // Get recent series for this player
          const recentSeries = await getRecentSeriesForPlayer(sql, player.id)

          // Get player stats from most recent series
          let playerStats = null
          if (recentSeries.length > 0) {
            const seriesId = recentSeries[0].series_id
            const teamId = player.team_id || ''

            if (teamId) {
              const openingDuels = await queryPlayerOpeningDuels(sql, seriesId, teamId)
              playerStats = openingDuels.find(p => p.player_id === player.id)
            }
          }

          // Get overall player stats
          const overallStats = await sql`
            SELECT
              SUM(prs.kills)::int as total_kills,
              SUM(prs.deaths)::int as total_deaths,
              SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END)::int as total_first_kills,
              SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END)::int as total_first_deaths,
              SUM(CASE WHEN prs.clutch_situation = TRUE THEN 1 ELSE 0 END)::int as clutch_situations,
              SUM(CASE WHEN prs.clutch_won = TRUE THEN 1 ELSE 0 END)::int as clutch_wins,
              COUNT(*)::int as total_rounds,
              ARRAY_AGG(DISTINCT prs.agent) as agents_played
            FROM public.player_round_stats prs
            WHERE prs.player_id = ${player.id}
          `

          response.data = {
            player: {
              id: player.id,
              name: player.name,
              team_id: player.team_id,
            },
            recent_series: recentSeries,
            stats: overallStats[0] || null,
            recent_match_stats: playerStats,
          }
        }
        break
      }

      case 'team': {
        if (entities.teams.length > 0) {
          const team = entities.teams[0]

          // Get recent series for this team
          const recentSeries = await getRecentSeriesForTeam(sql, team.id)

          // Get team's roster
          const roster = await sql`
            SELECT id, name
            FROM public.players
            WHERE team_id = ${team.id}
          `

          // Get overall team stats from most recent series
          let teamStats = null
          if (recentSeries.length > 0) {
            const seriesId = recentSeries[0].id
            teamStats = await queryMapMetrics(sql, seriesId, team.id)
          }

          response.data = {
            team: {
              id: team.id,
              name: team.name,
            },
            roster: roster.map(p => ({ id: p.id, name: p.name })),
            recent_series: recentSeries,
            recent_match_metrics: teamStats,
          }
        }
        break
      }

      case 'match': {
        if (entities.series.length > 0) {
          const series = entities.series[0]

          // Get team IDs
          const teamInfo = await sql`
            SELECT team_a_id, team_b_id
            FROM public.series
            WHERE id = ${series.id}
          `

          if (teamInfo.length > 0) {
            const teamAId = teamInfo[0].team_a_id
            const [summary, mapMetrics, openingDuels] = await Promise.all([
              querySeriesSummary(sql, series.id, teamAId),
              queryMapMetrics(sql, series.id, teamAId),
              queryPlayerOpeningDuels(sql, series.id, teamAId),
            ])

            response.data = {
              series: {
                id: series.id,
                team_a_name: series.team_a_name,
                team_b_name: series.team_b_name,
                tournament: series.tournament_name,
              },
              summary,
              map_metrics: mapMetrics,
              opening_duels: openingDuels,
            }
          }
        } else if (entities.teams.length >= 2) {
          // Found two teams, list their matches
          response.data = {
            teams: entities.teams,
            series: entities.series,
            message: 'Found teams but no specific series. Please specify which match to analyze.',
          }
        }
        break
      }

      default: {
        // General query - just return whatever entities we found
        response.data = {
          message: 'Could not determine specific analysis type',
          players_found: entities.players,
          teams_found: entities.teams,
          series_found: entities.series,
        }
      }
    }

    // Generate LLM analysis if available and data was found
    if (isLLMAvailable() && Object.keys(response.data).length > 0) {
      try {
        const context: {
          summary?: SeriesSummary
          mapMetrics?: MapMetrics[]
          openingDuels?: PlayerOpeningDuels[]
        } = {}

        // Build context from collected data
        if (response.data.summary) {
          context.summary = response.data.summary as SeriesSummary
        }
        if (response.data.map_metrics) {
          context.mapMetrics = response.data.map_metrics as MapMetrics[]
        }
        if (response.data.opening_duels) {
          context.openingDuels = response.data.opening_duels as PlayerOpeningDuels[]
        }

        const llmResult = await answerQuestion(query, context)
        response.llm_analysis = llmResult.analysis
      } catch {
        // LLM failed, continue without analysis
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error processing query:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
  // Note: No sql.end() - we use a shared connection pool
}
