import { NextResponse } from 'next/server'
import { getDb } from '@/lib/data'
import { datasetStats } from '@/lib/data/queries'

export async function GET() {
  try {
    return NextResponse.json(datasetStats(getDb()))
  } catch (error) {
    console.error('Error fetching stats:', error)
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 })
  }
}
