import { NextRequest, NextResponse } from 'next/server'
import { getPostgresPool } from '@/lib/supabase/server'
import { queryRoundsForReview } from '@/lib/analytics/coaching-queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type { RoundBreakdownResponse, GameBreakdown } from '@/lib/analytics/coaching-types'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  const sql = getPostgresPool()

  try {
    const { seriesId } = await params
    const { searchParams } = new URL(request.url)
    const teamId = searchParams.get('team_focus')

    if (!teamId) {
      return NextResponse.json(
        { error: 'team_focus query parameter is required' },
        { status: 400 }
      )
    }

    // Get all rounds for review
    const rounds = await queryRoundsForReview(sql, seriesId, teamId)

    if (rounds.length === 0) {
      return NextResponse.json(
        { error: 'No rounds found for this series' },
        { status: 404 }
      )
    }

    // Get game info
    const games = await sql`
      SELECT
        g.id as game_id,
        g.map_name,
        g.sequence_number,
        g.team_a_score,
        g.team_b_score,
        g.winner_id,
        s.team_a_id,
        s.team_b_id
      FROM public.games g
      JOIN public.series s ON g.series_id = s.id
      WHERE g.series_id = ${seriesId}
      ORDER BY g.sequence_number
    `

    // Group rounds by game
    const gameBreakdowns: GameBreakdown[] = games.map(game => {
      const isTeamA = game.team_a_id === teamId
      const teamScore = isTeamA ? Number(game.team_a_score) : Number(game.team_b_score)
      const opponentScore = isTeamA ? Number(game.team_b_score) : Number(game.team_a_score)

      const gameRounds = rounds.filter(r => r.game_id === game.game_id)

      return {
        game_id: game.game_id,
        map_name: game.map_name,
        sequence_number: Number(game.sequence_number),
        team_score: teamScore,
        opponent_score: opponentScore,
        result: game.winner_id === teamId ? 'win' as const : 'loss' as const,
        rounds: gameRounds,
      }
    })

    // Get priority rounds (top 20)
    const priorityRounds = rounds
      .filter(r => r.review_priority !== 'skip')
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3, skip: 4 }
        return priorityOrder[a.review_priority] - priorityOrder[b.review_priority]
      })
      .slice(0, 20)

    // Calculate notable players
    const playerStats: Record<string, {
      player_id: string
      player_name: string
      multi_kills: number
      clutches_won: number
      clutches_lost: number
    }> = {}

    for (const round of rounds) {
      for (const event of round.notable_events) {
        if (!playerStats[event.player_id]) {
          playerStats[event.player_id] = {
            player_id: event.player_id,
            player_name: event.player_name,
            multi_kills: 0,
            clutches_won: 0,
            clutches_lost: 0,
          }
        }

        if (event.type === 'multi_kill' || event.type === 'ace') {
          playerStats[event.player_id].multi_kills++
        } else if (event.type === 'clutch_won') {
          playerStats[event.player_id].clutches_won++
        } else if (event.type === 'clutch_lost') {
          playerStats[event.player_id].clutches_lost++
        }
      }
    }

    const notablePlayers = Object.values(playerStats)
      .sort((a, b) => (b.multi_kills + b.clutches_won) - (a.multi_kills + a.clutches_won))
      .slice(0, 5)

    const confidence = calculateConfidence(rounds.length, 'rounds')

    const response: RoundBreakdownResponse = {
      series_id: seriesId,
      team_id: teamId,
      games: gameBreakdowns,
      priority_rounds: priorityRounds,
      notable_players: notablePlayers,
      confidence,
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error generating round breakdown:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
