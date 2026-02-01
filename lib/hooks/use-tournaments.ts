import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export interface Tournament {
  id: string
  grid_id: string
  name: string
  region: string | null
  start_date: string | null
  end_date: string | null
  created_at: string
}

export function useTournaments() {
  return useQuery({
    queryKey: ["tournaments"],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .order("start_date", { ascending: false })

      if (error) throw error
      return data as Tournament[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useTournament(id: string) {
  return useQuery({
    queryKey: ["tournament", id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("tournaments")
        .select("*")
        .eq("id", id)
        .single()

      if (error) throw error
      return data as Tournament
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}
