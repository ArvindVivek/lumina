import { useQuery } from "@tanstack/react-query"
import type { HypotheticalAnalysis } from "@/lib/analytics/coaching-types"

export function useHypotheticalAnalysis(roundId: string) {
  return useQuery({
    queryKey: ["hypothetical", roundId],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/hypothetical/${roundId}`)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to fetch hypothetical analysis")
      }

      return res.json() as Promise<HypotheticalAnalysis>
    },
    enabled: !!roundId,
    staleTime: 10 * 60 * 1000, // 10 minutes - hypothetical data doesn't change
    retry: 1,
  })
}

export function useRoundContext(roundId: string) {
  const { data, ...rest } = useHypotheticalAnalysis(roundId)

  return {
    data: data?.round_context,
    ...rest,
  }
}
