import { useQuery, useMutation } from "@tanstack/react-query"

export type LLMQueryType = "match_review" | "player_analysis" | "round_analysis" | "question"

export interface LLMAnalysisParams {
  seriesId?: string
  playerId?: string
  roundId?: string
  teamFocus?: string
  queryType: LLMQueryType
  question?: string
}

export interface LLMAnalysisResult {
  analysis: string
  queryType: LLMQueryType
  context?: {
    seriesId?: string
    playerId?: string
    roundId?: string
  }
}

export function useLLMAnalysis(params: LLMAnalysisParams | null) {
  return useQuery({
    queryKey: ["llm-analysis", params],
    queryFn: async () => {
      if (!params) throw new Error("No params provided")

      const res = await fetch("/api/analytics/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series_id: params.seriesId,
          player_id: params.playerId,
          round_id: params.roundId,
          team_focus: params.teamFocus,
          query_type: params.queryType,
          question: params.question,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "LLM analysis failed")
      }

      return res.json() as Promise<LLMAnalysisResult>
    },
    enabled: !!params && (!!params.seriesId || !!params.playerId || !!params.roundId || !!params.question),
    staleTime: 10 * 60 * 1000, // 10 minutes - LLM responses are expensive
    retry: 0, // Don't retry LLM calls
  })
}

export function useLLMAnalysisMutation() {
  return useMutation({
    mutationFn: async (params: LLMAnalysisParams) => {
      const res = await fetch("/api/analytics/llm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          series_id: params.seriesId,
          player_id: params.playerId,
          round_id: params.roundId,
          team_focus: params.teamFocus,
          query_type: params.queryType,
          question: params.question,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "LLM analysis failed")
      }

      return res.json() as Promise<LLMAnalysisResult>
    },
  })
}

export function useNaturalLanguageQuery() {
  return useMutation({
    mutationFn: async (query: string) => {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Query failed")
      }

      return res.json()
    },
  })
}

export function useMatchReview(seriesId: string, teamFocus?: string) {
  return useLLMAnalysis(
    seriesId
      ? {
          seriesId,
          teamFocus,
          queryType: "match_review",
        }
      : null
  )
}

export function usePlayerAnalysis(playerId: string, seriesId?: string) {
  return useLLMAnalysis(
    playerId
      ? {
          playerId,
          seriesId,
          queryType: "player_analysis",
        }
      : null
  )
}

export function useRoundAnalysis(roundId: string) {
  return useLLMAnalysis(
    roundId
      ? {
          roundId,
          queryType: "round_analysis",
        }
      : null
  )
}
