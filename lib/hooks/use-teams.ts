import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export interface Team {
  id: string
  name: string
  short_name: string | null
  region: string | null
  created_at: string
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .order("name")

      if (error) throw error
      return data as Team[]
    },
    staleTime: 5 * 60 * 1000,
  })
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: ["team", id],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("teams")
        .select("*")
        .eq("id", id)
        .single()

      if (error) throw error
      return data as Team
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}
