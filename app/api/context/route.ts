import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/data'
import { pageContext } from '@/lib/data/queries'

/** Rich context for a page: the header title and what the chat knows about the screen. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    return NextResponse.json(
      pageContext(getDb(), {
        page: searchParams.get('page'),
        tournamentId: searchParams.get('tournamentId'),
        seriesId: searchParams.get('seriesId'),
        teamId: searchParams.get('teamId'),
        playerId: searchParams.get('playerId'),
      })
    )
  } catch (error) {
    console.error('Error fetching context:', error)
    return NextResponse.json({ error: 'Failed to fetch context' }, { status: 500 })
  }
}
