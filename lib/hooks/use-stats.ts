import { useQuery } from "@tanstack/react-query"

export interface DatabaseStats {
  tournaments: number
  teams: number
  players: number
  series: number
  games: number
  rounds: number
  killEvents: number
  clutchSituations: number
}

export function useStats() {
  return useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const response = await fetch('/api/stats')
      if (!response.ok) {
        throw new Error('Failed to fetch stats')
      }
      return response.json() as Promise<DatabaseStats>
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}
