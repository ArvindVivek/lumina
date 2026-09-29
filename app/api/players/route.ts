import { NextResponse } from 'next/server'
import { getDb } from '@/lib/data'
import { listPlayers } from '@/lib/data/queries'

export async function GET() {
  try {
    return NextResponse.json({ players: listPlayers(getDb()) })
  } catch (error) {
    console.error('Error fetching players:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
