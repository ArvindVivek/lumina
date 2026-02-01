import { useQuery } from "@tanstack/react-query"
import type { CoachingReportResponse } from "@/lib/analytics/coaching-types"

export function useCoachingReport(seriesId: string, teamFocus?: string) {
  return useQuery({
    queryKey: ["coaching-report", seriesId, teamFocus],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (teamFocus) params.set("teamFocus", teamFocus)

      const url = `/api/analytics/coaching-report/${seriesId}${params.toString() ? `?${params}` : ""}`
      const res = await fetch(url)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to fetch coaching report")
      }

      return res.json() as Promise<CoachingReportResponse>
    },
    enabled: !!seriesId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })
}
