import { useQuery } from "@tanstack/react-query"

export interface Series {
  id: string
  tournament_id: string
  team_a_id: string
  team_b_id: string
  winner_id: string | null
  start_time: string | null
  format: string | null
  processed: boolean
  created_at: string
}

export interface SeriesWithTeams extends Series {
  tournament: {
    id: string
    name: string
  }
  team_a: {
    id: string
    name: string
    short_name: string | null
  }
  team_b: {
    id: string
    name: string
    short_name: string | null
  }
}

// Fetch series from API endpoint with proper SQL joins
async function fetchSeries(options: {
  limit?: number
  tournamentId?: string
}): Promise<SeriesWithTeams[]> {
  const params = new URLSearchParams()
  if (options.limit) params.set('limit', String(options.limit))
  if (options.tournamentId) params.set('tournament_id', options.tournamentId)

  const response = await fetch(`/api/series?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Failed to fetch series')
  }

  const data = await response.json()

  // Transform API response to match expected interface
  return (data.series || []).map((s: {
    id: string
    start_time: string | null
    format: string | null
    team_a_id: string
    team_b_id: string
    team_a_name: string
    team_b_name: string
    winner_id: string | null
    tournament_name: string
    tournament_id?: string
    processed?: boolean
    created_at?: string
  }) => ({
    id: s.id,
    tournament_id: s.tournament_id || '',
    team_a_id: s.team_a_id,
    team_b_id: s.team_b_id,
    winner_id: s.winner_id,
    start_time: s.start_time,
    format: s.format,
    processed: s.processed ?? true,
    created_at: s.created_at || '',
    tournament: {
      id: s.tournament_id || '',
      name: s.tournament_name
    },
    team_a: {
      id: s.team_a_id,
      name: s.team_a_name,
      short_name: null
    },
    team_b: {
      id: s.team_b_id,
      name: s.team_b_name,
      short_name: null
    }
  }))
}

export function useRecentSeries(limit = 10) {
  return useQuery({
    queryKey: ["series", "recent", limit],
    queryFn: () => fetchSeries({ limit }),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })
}

export function useSeries(id: string) {
  return useQuery({
    queryKey: ["series", id],
    queryFn: async () => {
      const response = await fetch(`/api/series/${id}`)
      if (!response.ok) {
        throw new Error('Series not found')
      }
      const series = await response.json()

      return {
        id: series.id,
        tournament_id: series.tournament_id || '',
        team_a_id: series.team_a_id,
        team_b_id: series.team_b_id,
        winner_id: series.winner_id,
        start_time: series.start_time,
        format: series.format,
        processed: series.processed ?? true,
        created_at: series.created_at || '',
        tournament: {
          id: series.tournament_id || '',
          name: series.tournament_name
        },
        team_a: {
          id: series.team_a_id,
          name: series.team_a_name,
          short_name: null
        },
        team_b: {
          id: series.team_b_id,
          name: series.team_b_name,
          short_name: null
        }
      } as SeriesWithTeams
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

export function useTournamentSeries(tournamentId: string) {
  return useQuery({
    queryKey: ["series", "tournament", tournamentId],
    queryFn: () => fetchSeries({ tournamentId, limit: 100 }),
    enabled: !!tournamentId,
    staleTime: 5 * 60 * 1000,
  })
}
