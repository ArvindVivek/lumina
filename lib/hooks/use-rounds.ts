import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export interface Round {
  id: string
  game_id: string
  round_number: number
  phase: string | null
  winning_team_id: string | null
  winning_condition: string | null
  spike_planted: boolean
  spike_defused: boolean
  team_a_alive: number | null
  team_b_alive: number | null
  team_a_loadout_value: number | null
  team_b_loadout_value: number | null
  duration_ms: number | null
  created_at: string
}

export interface RoundWithStats extends Round {
  first_blood_player_id: string | null
  first_blood_timestamp_ms: number | null
}

export function useGameRounds(gameId: string) {
  return useQuery({
    queryKey: ["rounds", "game", gameId],
    queryFn: async () => {
      const supabase = createClient()

      // Fetch rounds (spike data already in rounds table)
      const { data: rounds, error } = await supabase
        .from("rounds")
        .select("*")
        .eq("game_id", gameId)
        .order("round_number")

      if (error) throw error

      // Fetch kill events for first blood
      const roundIds = rounds?.map(r => r.id) || []
      const { data: killEvents } = await supabase
        .from("kill_events")
        .select("*")
        .in("round_id", roundIds)
        .order("game_time_ms")

      // Enrich rounds with first blood data
      const enrichedRounds: RoundWithStats[] = (rounds || []).map(round => {
        const firstKill = killEvents?.find(k => k.round_id === round.id && k.is_first_kill)

        return {
          ...round,
          first_blood_player_id: firstKill?.killer_id || null,
          first_blood_timestamp_ms: firstKill?.game_time_ms || null,
        }
      })

      return enrichedRounds
    },
    enabled: !!gameId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useRound(id: string) {
  return useQuery({
    queryKey: ["round", id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("rounds")
        .select("*")
        .eq("id", id)
        .single()

      if (error) throw error
      return data as Round
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}
