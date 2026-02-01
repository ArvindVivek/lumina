/**
 * GRID API Client for VALORANT ETL
 * Supports all three GRID APIs:
 * - Central Data API (tournament/series metadata)
 * - Series State API (post-match data)
 * - File Download API (event timeline files)
 */

import Bottleneck from 'bottleneck'
import pRetry from 'p-retry'
import { createWriteStream } from 'fs'
import { mkdir } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'
import path from 'path'

// API Endpoints
const GRID_CENTRAL_API = 'https://api-op.grid.gg/central-data/graphql'
const GRID_SERIES_STATE_API = 'https://api-op.grid.gg/live-data-feed/series-state/graphql'
const GRID_FILE_API = 'https://api.grid.gg/file-download/list'

const RATE_LIMITS = {
  maxConcurrent: 1,
  minTime: 1500,        // 1.5 seconds between requests
  reservoir: 40,
  reservoirRefreshAmount: 40,
  reservoirRefreshInterval: 60 * 1000,
}

// VCT Americas Tournament IDs
export const VALORANT_PARENT_TOURNAMENTS = [
  '757371',  // VCT Americas - Kickoff 2024
  '757481',  // VCT Americas - Stage 1 2024
  '774782',  // VCT Americas - Stage 2 2024
  '775516',  // VCT Americas - Kickoff 2025
  '800675',  // VCT Americas - Stage 1 2025
  '826660',  // VCT Americas - Stage 2 2025
]

// Types
export interface Tournament {
  id: string
  name: string
  startDate?: string
  endDate?: string
}

export interface Team {
  id: string
  name: string
}

export interface Player {
  id: string
  name: string
  teamId?: string
}

export interface Series {
  id: string
  startTimeScheduled?: string
  format?: { name: string }
  tournament: { id: string; name: string }
  teams: Array<{ baseInfo: Team }>
}

export interface SeriesStateTeam {
  id: string
  name: string
  won?: boolean
  score?: number
  players?: SeriesStatePlayer[]
}

export interface SeriesStatePlayer {
  id: string
  name: string
  kills?: number
  deaths?: number
}

export interface SeriesStateGame {
  id: string
  sequenceNumber: number
  map?: { name: string }
  teams: SeriesStateTeam[]
  finished?: boolean
}

export interface SeriesState {
  id: string
  started?: string
  finished?: string
  teams: SeriesStateTeam[]
  games: SeriesStateGame[]
}

export interface FileInfo {
  id: string
  description?: string
  status?: string
  fileName?: string
  fullURL?: string
}

export class GridAPIClient {
  private limiter: Bottleneck
  private apiKey: string
  private stats = { requests: 0, errors: 0, downloads: 0 }

  constructor(apiKey: string) {
    if (!apiKey) throw new Error('GRID_API_KEY is required')
    this.apiKey = apiKey

    this.limiter = new Bottleneck({
      maxConcurrent: RATE_LIMITS.maxConcurrent,
      minTime: RATE_LIMITS.minTime,
      reservoir: RATE_LIMITS.reservoir,
      reservoirRefreshAmount: RATE_LIMITS.reservoirRefreshAmount,
      reservoirRefreshInterval: RATE_LIMITS.reservoirRefreshInterval,
    })

    this.limiter.on('depleted', () => console.log('  [rate-limit] Waiting...'))
  }

  getStats() { return this.stats }

  private async query<T>(endpoint: string, gql: string, variables: Record<string, unknown> = {}): Promise<T> {
    return this.limiter.schedule(() =>
      pRetry(
        async () => {
          this.stats.requests++
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'x-api-key': this.apiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: gql, variables }),
          })

          if (res.status === 429) {
            console.log('  [rate-limit] 429 - Waiting 60s...')
            await new Promise(r => setTimeout(r, 60000))
            throw new Error('Rate limit')
          }
          if (!res.ok) { this.stats.errors++; throw new Error(`HTTP ${res.status}`) }

          const data = await res.json()
          if (data.errors?.length) {
            this.stats.errors++
            throw new Error(data.errors[0].message)
          }
          return data.data as T
        },
        { retries: 5, factor: 2, minTimeout: 5000, maxTimeout: 60000 }
      )
    )
  }

  // ==========================================
  // CENTRAL DATA API
  // ==========================================

  /** Get all VCT Americas child tournaments */
  async getVCTTournaments(): Promise<Tournament[]> {
    const result = await this.query<{
      tournaments: { edges: Array<{ node: Tournament }>; totalCount: number }
    }>(GRID_CENTRAL_API, `
      query {
        tournaments(first: 50, filter: { name: { contains: "VCT Americas" } }) {
          edges { node { id name startDate endDate } }
          totalCount
        }
      }
    `)
    return result.tournaments.edges.map(e => e.node)
  }

  /** Get series for a specific tournament (with pagination) */
  async getSeriesForTournament(tournamentId: string, cursor?: string): Promise<{
    series: Series[]
    hasNext: boolean
    endCursor?: string
    total: number
  }> {
    const result = await this.query<{
      allSeries: {
        edges: Array<{ node: Series; cursor: string }>
        pageInfo: { hasNextPage: boolean; endCursor: string }
        totalCount: number
      }
    }>(GRID_CENTRAL_API, `
      query($tid: ID!, $after: String) {
        allSeries(
          filter: { tournamentId: $tid }
          first: 50
          after: $after
          orderBy: StartTimeScheduled
          orderDirection: ASC
        ) {
          edges {
            node {
              id
              startTimeScheduled
              format { name }
              tournament { id name }
              teams { baseInfo { id name } }
            }
            cursor
          }
          pageInfo { hasNextPage endCursor }
          totalCount
        }
      }
    `, { tid: tournamentId, after: cursor })

    return {
      series: result.allSeries.edges.map(e => e.node),
      hasNext: result.allSeries.pageInfo.hasNextPage,
      endCursor: result.allSeries.pageInfo.endCursor,
      total: result.allSeries.totalCount,
    }
  }

  // ==========================================
  // SERIES STATE API (Post-match data)
  // ==========================================

  /** Get detailed series state (games, players, scores) */
  async getSeriesState(seriesId: string): Promise<SeriesState | null> {
    try {
      const result = await this.query<{ seriesState: SeriesState | null }>(
        GRID_SERIES_STATE_API,
        `
        query($id: ID!) {
          seriesState(id: $id) {
            id
            started
            finished
            teams {
              id
              name
              won
            }
            games {
              id
              sequenceNumber
              map { name }
              teams {
                id
                name
                score
                won
                players {
                  id
                  name
                  kills
                  deaths
                }
              }
            }
          }
        }
      `,
        { id: seriesId }
      )
      return result.seriesState
    } catch (e) {
      console.error(`  [error] SeriesState ${seriesId}: ${(e as Error).message}`)
      return null
    }
  }

  // ==========================================
  // FILE DOWNLOAD API (Event timelines)
  // ==========================================

  /** Get list of available files for a series */
  async getSeriesFiles(seriesId: string): Promise<FileInfo[]> {
    return this.limiter.schedule(() =>
      pRetry(
        async () => {
          this.stats.requests++
          const res = await fetch(`${GRID_FILE_API}/${seriesId}`, {
            headers: { 'x-api-key': this.apiKey },
          })

          if (res.status === 429) {
            await new Promise(r => setTimeout(r, 60000))
            throw new Error('Rate limit')
          }
          if (res.status === 404) return []  // No files available
          if (!res.ok) throw new Error(`HTTP ${res.status}`)

          const data = await res.json()
          return (data.files || []) as FileInfo[]
        },
        { retries: 3, minTimeout: 2000 }
      )
    )
  }

  /** Download and decompress events file for a series */
  async downloadEventsFile(seriesId: string, outputDir: string): Promise<string | null> {
    const files = await this.getSeriesFiles(seriesId)

    // Find the events file (id contains 'events')
    const eventsFile = files.find(f =>
      f.id?.toLowerCase().includes('events') ||
      f.fileName?.toLowerCase().includes('events')
    )

    if (!eventsFile?.fullURL) {
      return null
    }

    await mkdir(outputDir, { recursive: true })
    const outputPath = path.join(outputDir, `${seriesId}_events.jsonl`)

    return this.limiter.schedule(() =>
      pRetry(
        async () => {
          this.stats.downloads++
          const res = await fetch(eventsFile.fullURL!, {
            headers: { 'x-api-key': this.apiKey },
          })

          if (!res.ok) throw new Error(`Download failed: ${res.status}`)
          if (!res.body) throw new Error('No response body')

          // Check content type for compression
          const contentType = res.headers.get('content-type') || ''
          const contentEncoding = res.headers.get('content-encoding') || ''

          // Read first bytes to detect format
          const arrayBuffer = await res.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          let content: Buffer

          // Check magic bytes
          if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
            // GZIP format
            const { gunzipSync } = await import('zlib')
            content = gunzipSync(buffer)
          } else if (buffer[0] === 0x50 && buffer[1] === 0x4b) {
            // ZIP format
            const AdmZip = (await import('adm-zip')).default
            const zip = new AdmZip(buffer)
            const entries = zip.getEntries()
            const jsonlEntry = entries.find(e => e.entryName.endsWith('.jsonl'))
            if (!jsonlEntry) throw new Error('No JSONL in ZIP')
            content = jsonlEntry.getData()
          } else {
            // Raw JSONL
            content = buffer
          }

          // Write to file
          const { writeFile } = await import('fs/promises')
          await writeFile(outputPath, content)

          return outputPath
        },
        { retries: 3, minTimeout: 2000 }
      )
    )
  }

  async disconnect() { await this.limiter.disconnect() }
}
