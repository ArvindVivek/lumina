import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/data'
import { gameDetail, gameRounds, scoreboard } from '@/lib/data/queries'

/** One map: score, teams, every round, and each player's line. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params
    const db = getDb()
    const game = gameDetail(db, gameId)
    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }
    return NextResponse.json({
      game,
      rounds: gameRounds(db, gameId),
      scoreboard: scoreboard(db, [db.game.get(gameId)!]),
    })
  } catch (error) {
    console.error('Error fetching game:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
