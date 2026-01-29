// Rate-limited GRID API client with exponential backoff
// File: supabase/functions/_shared/grid-client.ts

// Deno-compatible imports for Supabase Edge Functions
import Bottleneck from 'npm:bottleneck@2.19.5';
import pRetry from 'npm:p-retry@6.2.1';
import { z } from 'npm:zod@3.24.1';

// ==========================================
// GRID API CONFIGURATION
// ==========================================

const GRID_API_URL = 'https://api-op.grid.gg/central-data/graphql';

// GRID API rate limits (from official documentation)
const RATE_LIMITS = {
  overall: {
    maxConcurrent: 3,      // Max concurrent requests
    minTime: 333,          // Min time between requests (333ms = 3 req/sec = 180 req/min)
    reservoir: 180,        // Max requests per minute
    reservoirRefreshAmount: 180,
    reservoirRefreshInterval: 60 * 1000, // 1 minute in milliseconds
  },
};

// ==========================================
// ZOD VALIDATION SCHEMAS
// ==========================================

// Tournament response schema
const TournamentNodeSchema = z.object({
  id: z.string(),
  title: z.string(),
  startTimeScheduled: z.string().nullable(),
  endTimeScheduled: z.string().nullable(),
  region: z.string().nullable().optional(),
});

export const TournamentsResponseSchema = z.object({
  data: z.object({
    allTournament: z.object({
      nodes: z.array(TournamentNodeSchema),
    }),
  }),
});

// Series response schema
const SeriesNodeSchema = z.object({
  id: z.string(),
  tournamentId: z.string().nullable(),
  startTimeScheduled: z.string().nullable(),
  title: z.string().nullable(),
});

export const SeriesResponseSchema = z.object({
  data: z.object({
    allSeries: z.object({
      nodes: z.array(SeriesNodeSchema),
    }),
  }),
});

// Series state response schema (picks/bans)
const PlayerStateSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  characterName: z.string().nullable(),
  role: z.string().nullable(),
  kills: z.number().nullable().optional(),
  deaths: z.number().nullable().optional(),
  assists: z.number().nullable().optional(),
});

const TeamStateSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  won: z.boolean().nullable().optional(),
  characterBans: z.array(z.string()).nullable().optional(),
  players: z.array(PlayerStateSchema),
});

const GameStateSchema = z.object({
  id: z.string(),
  number: z.number().nullable().optional(),
  teams: z.array(TeamStateSchema),
});

const SeriesStateSchema = z.object({
  id: z.string(),
  started: z.string().nullable(),
  finished: z.string().nullable(),
  teams: z.array(TeamStateSchema),
  games: z.array(GameStateSchema),
});

export const SeriesStateResponseSchema = z.object({
  data: z.object({
    seriesState: SeriesStateSchema.nullable(),
  }),
});

// ==========================================
// TYPES
// ==========================================

export type TournamentsResponse = z.infer<typeof TournamentsResponseSchema>;
export type SeriesResponse = z.infer<typeof SeriesResponseSchema>;
export type SeriesStateResponse = z.infer<typeof SeriesStateResponseSchema>;

// ==========================================
// GRID API CLIENT
// ==========================================

export class GridAPIClient {
  private limiter: Bottleneck;
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('GRID API key is required');
    }

    this.apiKey = apiKey;

    // Initialize Bottleneck rate limiter
    this.limiter = new Bottleneck({
      maxConcurrent: RATE_LIMITS.overall.maxConcurrent,
      minTime: RATE_LIMITS.overall.minTime,
      reservoir: RATE_LIMITS.overall.reservoir,
      reservoirRefreshAmount: RATE_LIMITS.overall.reservoirRefreshAmount,
      reservoirRefreshInterval: RATE_LIMITS.overall.reservoirRefreshInterval,
    });

    // Log rate limiter events for debugging
    this.limiter.on('failed', (error, jobInfo) => {
      console.warn(`Rate limiter job failed: ${error.message}`, {
        retryCount: jobInfo.retryCount,
      });
    });

    this.limiter.on('depleted', () => {
      console.warn('Rate limiter reservoir depleted, waiting for refresh...');
    });
  }

  /**
   * Execute a GraphQL query with rate limiting and retry logic
   */
  async query<T>(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<T> {
    return this.limiter.schedule(() =>
      pRetry(
        async () => {
          const response = await fetch(GRID_API_URL, {
            method: 'POST',
            headers: {
              'x-api-key': this.apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query, variables }),
          });

          // Handle 429 rate limit errors
          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;

            console.warn(`Rate limit hit (429), retrying after ${delay}ms`);
            throw new Error(`Rate limit exceeded, retry after ${delay}ms`);
          }

          // Handle other HTTP errors
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
              `GRID API error: ${response.status} ${response.statusText} - ${errorText}`
            );
          }

          // Parse JSON response
          const data = await response.json();

          // Check for GraphQL errors
          if (data.errors && data.errors.length > 0) {
            const errorMessages = data.errors
              .map((e: { message: string }) => e.message)
              .join(', ');
            throw new Error(`GraphQL errors: ${errorMessages}`);
          }

          return data as T;
        },
        {
          retries: 5,
          factor: 2, // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          minTimeout: 1000,
          maxTimeout: 30000,
          onFailedAttempt: (error) => {
            console.warn(
              `Request attempt ${error.attemptNumber} failed. Retries left: ${error.retriesLeft}`,
              {
                error: error.message,
              }
            );
          },
        }
      )
    );
  }

  /**
   * Fetch tournaments with optional filters
   */
  async getTournaments(
    gameId: string,
    startDate?: string
  ): Promise<TournamentsResponse> {
    const query = `
      query GetTournaments($gameId: String!, $startDate: Datetime) {
        allTournament(
          filter: {
            game: { id: { equalTo: $gameId } }
            startTimeScheduled: { greaterThan: $startDate }
          }
        ) {
          nodes {
            id
            title
            startTimeScheduled
            endTimeScheduled
            region
          }
        }
      }
    `;

    const variables: Record<string, unknown> = { gameId };
    if (startDate) {
      variables.startDate = startDate;
    }

    const response = await this.query<TournamentsResponse>(query, variables);
    return TournamentsResponseSchema.parse(response);
  }

  /**
   * Fetch series for a specific tournament
   */
  async getSeriesForTournament(
    tournamentId: string
  ): Promise<SeriesResponse> {
    const query = `
      query GetSeriesForTournament($tournamentId: ID!) {
        allSeries(
          filter: {
            tournamentId: { equalTo: $tournamentId }
          }
        ) {
          nodes {
            id
            tournamentId
            startTimeScheduled
            title
          }
        }
      }
    `;

    const response = await this.query<SeriesResponse>(query, { tournamentId });
    return SeriesResponseSchema.parse(response);
  }

  /**
   * Fetch series state (picks/bans/players)
   */
  async getSeriesState(seriesId: string): Promise<SeriesStateResponse> {
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
            players {
              id
              name
              characterName
              role
              kills
              deaths
              assists
            }
          }
          games {
            id
            number
            teams {
              id
              name
              characterBans
              players {
                id
                name
                characterName
                role
              }
            }
          }
        }
      }
    `;

    const response = await this.query<SeriesStateResponse>(query, { seriesId });
    return SeriesStateResponseSchema.parse(response);
  }

  /**
   * Close the rate limiter and cleanup
   */
  async disconnect(): Promise<void> {
    await this.limiter.disconnect();
  }
}
