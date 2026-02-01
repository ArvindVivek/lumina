import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export interface Player {
  id: string
  grid_id: string
  name: string
  team_id: string | null
  agent_pool: string[] | null
  created_at: string
}

export interface PlayerWithTeam extends Player {
  team: {
    id: string
    name: string
  } | null
}

export function usePlayers() {
  return useQuery({
    queryKey: ["players"],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("players")
        .select(`
          *,
          team:teams(id, name)
        `)
        .order("name")

      if (error) throw error
      return data as PlayerWithTeam[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function usePlayer(id: string) {
  return useQuery({
    queryKey: ["player", id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("players")
        .select(`
          *,
          team:teams(id, name)
        `)
        .eq("id", id)
        .single()

      if (error) throw error
      return data as PlayerWithTeam
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}

export function useTeamPlayers(teamId: string) {
  return useQuery({
    queryKey: ["players", "team", teamId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("players")
        .select(`
          *,
          team:teams(id, name)
        `)
        .eq("team_id", teamId)
        .order("name")

      if (error) throw error
      return data as PlayerWithTeam[]
    },
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  })
}
