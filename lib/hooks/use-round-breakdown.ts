import { useQuery } from "@tanstack/react-query"
import type { RoundBreakdownResponse } from "@/lib/analytics/coaching-types"

export function useRoundBreakdown(seriesId: string, teamId?: string) {
  return useQuery({
    queryKey: ["round-breakdown", seriesId, teamId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (teamId) params.set("teamId", teamId)

      const url = `/api/analytics/round-breakdown/${seriesId}${params.toString() ? `?${params}` : ""}`
      const res = await fetch(url)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to fetch round breakdown")
      }

      return res.json() as Promise<RoundBreakdownResponse>
    },
    enabled: !!seriesId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}

export function usePriorityRounds(seriesId: string, teamId?: string, limit = 20) {
  const { data, ...rest } = useRoundBreakdown(seriesId, teamId)

  return {
    data: data?.priority_rounds.slice(0, limit),
    ...rest,
  }
}
