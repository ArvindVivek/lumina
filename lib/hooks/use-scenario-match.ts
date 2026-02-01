import { useQuery, useMutation } from "@tanstack/react-query"
import type { ScenarioMatch, ScenarioStats } from "@/lib/analytics/coaching-types"

export interface ScenarioSearchParams {
  attackerAlive: number
  defenderAlive: number
  spikePlanted: boolean
  map?: string
  limit?: number
}

export interface ScenarioSearchResult {
  matches: ScenarioMatch[]
  stats: ScenarioStats
}

export function useScenarioSearch(params: ScenarioSearchParams | null) {
  return useQuery({
    queryKey: ["scenario-search", params],
    queryFn: async () => {
      if (!params) throw new Error("No search params provided")

      const res = await fetch("/api/analytics/scenarios/find-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attacker_alive: params.attackerAlive,
          defender_alive: params.defenderAlive,
          spike_planted: params.spikePlanted,
          map: params.map,
          limit: params.limit || 50,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to search scenarios")
      }

      return res.json() as Promise<ScenarioSearchResult>
    },
    enabled: !!params,
    staleTime: 10 * 60 * 1000,
  })
}

export function useScenarioSearchMutation() {
  return useMutation({
    mutationFn: async (params: ScenarioSearchParams) => {
      const res = await fetch("/api/analytics/scenarios/find-similar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attacker_alive: params.attackerAlive,
          defender_alive: params.defenderAlive,
          spike_planted: params.spikePlanted,
          map: params.map,
          limit: params.limit || 50,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to search scenarios")
      }

      return res.json() as Promise<ScenarioSearchResult>
    },
  })
}
