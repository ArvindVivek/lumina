import { NextResponse } from 'next/server'
import { getDb } from '@/lib/data'
import { listTeams } from '@/lib/data/queries'

export async function GET() {
  try {
    return NextResponse.json({ teams: listTeams(getDb()) })
  } catch (error) {
    console.error('Error fetching teams:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
