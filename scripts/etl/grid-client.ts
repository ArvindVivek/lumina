/**
 * Rate-limited GRID API client for local ETL scripts
 * Handles both VALORANT and LoL data fetching with exponential backoff
 */

import Bottleneck from 'bottleneck'
import pRetry from 'p-retry'
import { z } from 'zod'

// ==========================================
// GRID API CONFIGURATION
// ==========================================

const GRID_CENTRAL_API = 'https://api-op.grid.gg/central-data/graphql'
const GRID_SERIES_STATE_API = 'https://api-op.grid.gg/live-data-feed/series-state/graphql'

// Rate limits from GRID documentation
const RATE_LIMITS = {
  maxConcurrent: 3,
  minTime: 333,           // 3 req/sec = 180 req/min
  reservoir: 180,
  reservoirRefreshAmount: 180,
  reservoirRefreshInterval: 60 * 1000,
}

// ==========================================
// TOURNAMENT IDS FROM HACKATHON ACCESS
// ==========================================

export const VALORANT_TOURNAMENTS = {
  'VCT Americas - Kickoff 2024': '757371',
  'VCT Americas - Stage 1 2024': '757481',
  'VCT Americas - Stage 2 2024': '774782',
  'VCT Americas - Kickoff 2025': '775516',
  'VCT Americas - Stage 1 2025': '800675',
  'VCT Americas - Stage 2 2025': '826660',
  'VALORANT Masters - Masters Madrid': '757614',
} as const

// ==========================================
// ZOD SCHEMAS
// ==========================================

const TeamSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  shortName: z.string().nullable().optional(),
})

const PlayerSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  nickname: z.string().nullable().optional(),
})

const TournamentSchema = z.object({
  id: z.string(),
  title: z.string(),
  startTimeScheduled: z.string().nullable(),
  endTimeScheduled: z.string().nullable(),
})

const SeriesSchema = z.object({
  id: z.string(),
  tournamentId: z.string().nullable(),
  startTimeScheduled: z.string().nullable(),
  title: z.string().nullable(),
  teams: z.array(TeamSchema).optional(),
})

// Series state schemas (for detailed match data)
const PlayerStateSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  characterName: z.string().nullable(),
  role: z.string().nullable(),
})

const TeamStateSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  won: z.boolean().nullable(),
  characterBans: z.array(z.string()).nullable(),
  players: z.array(PlayerStateSchema),
})

const GameStateSchema = z.object({
  id: z.string(),
  number: z.number().nullable(),
  teams: z.array(TeamStateSchema),
})

const SeriesStateSchema = z.object({
  id: z.string(),
  started: z.string().nullable(),
  finished: z.string().nullable(),
  teams: z.array(TeamStateSchema),
  games: z.array(GameStateSchema),
})

// Response schemas
export const TournamentsResponseSchema = z.object({
  data: z.object({
    allTournament: z.object({
      nodes: z.array(TournamentSchema),
    }),
  }),
})

export const SeriesResponseSchema = z.object({
  data: z.object({
    allSeries: z.object({
      nodes: z.array(SeriesSchema),
    }),
  }),
})

export const TeamsResponseSchema = z.object({
  data: z.object({
    allTeam: z.object({
      nodes: z.array(TeamSchema),
    }),
  }),
})

export const SeriesStateResponseSchema = z.object({
  data: z.object({
    seriesState: SeriesStateSchema.nullable(),
  }),
})

// ==========================================
// TYPES
// ==========================================

export type Tournament = z.infer<typeof TournamentSchema>
export type Series = z.infer<typeof SeriesSchema>
export type Team = z.infer<typeof TeamSchema>
export type Player = z.infer<typeof PlayerSchema>
export type SeriesState = z.infer<typeof SeriesStateSchema>

// ==========================================
// GRID API CLIENT
// ==========================================

export class GridAPIClient {
  private limiter: Bottleneck
  private apiKey: string
  private stats = {
    requests: 0,
    errors: 0,
    retries: 0,
  }

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('GRID_API_KEY is required')
    }
    this.apiKey = apiKey

    this.limiter = new Bottleneck({
      maxConcurrent: RATE_LIMITS.maxConcurrent,
      minTime: RATE_LIMITS.minTime,
      reservoir: RATE_LIMITS.reservoir,
      reservoirRefreshAmount: RATE_LIMITS.reservoirRefreshAmount,
      reservoirRefreshInterval: RATE_LIMITS.reservoirRefreshInterval,
    })

    this.limiter.on('depleted', () => {
      console.log('  [rate-limit] Reservoir depleted, waiting...')
    })
  }

  getStats() {
    return this.stats
  }

  private async query<T>(
    url: string,
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> {
    return this.limiter.schedule(() =>
      pRetry(
        async () => {
          this.stats.requests++

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'x-api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables }),
          })

          if (response.status === 429) {
            this.stats.retries++
            const retryAfter = response.headers.get('Retry-After')
            const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000
            throw new Error(`Rate limit hit, retry after ${delay}ms`)
          }

          if (!response.ok) {
            this.stats.errors++
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
          }

          const data = await response.json()
          if (data.errors?.length) {
            this.stats.errors++
            throw new Error(`GraphQL: ${data.errors.map((e: { message: string }) => e.message).join(', ')}`)
          }

          return data as T
        },
        {
          retries: 5,
          factor: 2,
          minTimeout: 1000,
          maxTimeout: 30000,
          onFailedAttempt: (error) => {
            console.log(`  [retry] Attempt ${error.attemptNumber} failed: ${error.message}`)
          },
        }
      )
    )
  }

  // ==========================================
  // TOURNAMENT & SERIES QUERIES
  // ==========================================

  async getTournament(tournamentId: string): Promise<Tournament | null> {
    const query = `
      query GetTournament($id: ID!) {
        tournament(id: $id) {
          id
          title
          startTimeScheduled
          endTimeScheduled
        }
      }
    `
    const response = await this.query<{ data: { tournament: Tournament | null } }>(
      GRID_CENTRAL_API,
      query,
      { id: tournamentId }
    )
    return response.data.tournament
  }

  async getSeriesForTournament(tournamentId: string): Promise<Series[]> {
    const query = `
      query GetSeriesForTournament($tournamentId: ID!) {
        allSeries(filter: { tournamentId: { equalTo: $tournamentId } }) {
          nodes {
            id
            tournamentId
            startTimeScheduled
            title
            teams { id name shortName }
          }
        }
      }
    `
    const response = await this.query<z.infer<typeof SeriesResponseSchema>>(
      GRID_CENTRAL_API,
      query,
      { tournamentId }
    )
    return response.data.allSeries.nodes
  }

  async getSeriesState(seriesId: string): Promise<SeriesState | null> {
    const query = `
      query GetSeriesState($seriesId: ID!) {
        seriesState(id: $seriesId) {
          id
          started
          finished
          teams {
            id
            name
            won
            characterBans
            players { id name characterName role }
          }
          games {
            id
            number
            teams {
              id
              name
              characterBans
              players { id name characterName role }
            }
          }
        }
      }
    `
    const response = await this.query<z.infer<typeof SeriesStateResponseSchema>>(
      GRID_SERIES_STATE_API,
      query,
      { seriesId }
    )
    return response.data.seriesState
  }

  // ==========================================
  // TEAM QUERIES
  // ==========================================

  async getTeamsForTournament(tournamentId: string): Promise<Team[]> {
    const query = `
      query GetTeams($tournamentId: ID!) {
        allTeam(filter: {
          seriesParticipationsByTeamId: {
            some: {
              series: { tournamentId: { equalTo: $tournamentId } }
            }
          }
        }) {
          nodes { id name shortName }
        }
      }
    `
    const response = await this.query<z.infer<typeof TeamsResponseSchema>>(
      GRID_CENTRAL_API,
      query,
      { tournamentId }
    )
    return response.data.allTeam.nodes
  }

  async disconnect(): Promise<void> {
    await this.limiter.disconnect()
  }
}
