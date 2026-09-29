import { NextRequest, NextResponse } from 'next/server'
import { getDb } from '@/lib/data'
import { seriesRow } from '@/lib/data/queries'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ seriesId: string }> }
) {
  try {
    const { seriesId } = await params
    const db = getDb()
    const series = db.seriesById.get(seriesId)
    if (!series) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 })
    }
    return NextResponse.json({
      ...seriesRow(db, series),
      games: db.gamesBySeries.get(seriesId) ?? [],
    })
  } catch (error) {
    console.error('Error fetching series:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
