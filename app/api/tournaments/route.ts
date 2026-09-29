import { NextResponse } from 'next/server'
import { getDb } from '@/lib/data'
import { listTournaments } from '@/lib/data/queries'

export async function GET() {
  try {
    return NextResponse.json({ tournaments: listTournaments(getDb()) })
  } catch (error) {
    console.error('Error fetching tournaments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
