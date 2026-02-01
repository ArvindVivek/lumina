import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export interface Game {
  id: string
  series_id: string
  sequence_number: number
  map_name: string
  team_a_score: number
  team_b_score: number
  winner_id: string | null
  duration_ms: number | null
  created_at: string
}

export interface GameWithTeams extends Game {
  team_a_id: string
  team_b_id: string
  team_a_name?: string
  team_b_name?: string
}

export function useSeriesGames(seriesId: string) {
  return useQuery({
    queryKey: ["games", "series", seriesId],
    queryFn: async () => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("games")
        .select(`
          *,
          series:series_id(team_a_id, team_b_id)
        `)
        .eq("series_id", seriesId)
        .order("sequence_number")

      if (error) throw error

      // Flatten series data into game
      return (data || []).map((g: any) => ({
        ...g,
        team_a_id: g.series?.team_a_id,
        team_b_id: g.series?.team_b_id,
        series: undefined,
      })) as GameWithTeams[]
    },
    enabled: !!seriesId,
    staleTime: 5 * 60 * 1000,
  })
}

export function useGame(id: string) {
  return useQuery({
    queryKey: ["game", id],
    queryFn: async () => {
      const supabase = createClient()

      // Fetch game with series
      const { data, error } = await supabase
        .from("games")
        .select(`
          *,
          series:series_id(team_a_id, team_b_id)
        `)
        .eq("id", id)
        .single()

      if (error) throw error

      const teamAId = data.series?.team_a_id
      const teamBId = data.series?.team_b_id

      // Fetch team names
      let teamAName = "Team A"
      let teamBName = "Team B"

      if (teamAId && teamBId) {
        const { data: teams } = await supabase
          .from("teams")
          .select("id, name")
          .in("id", [teamAId, teamBId])

        if (teams) {
          const teamA = teams.find(t => t.id === teamAId)
          const teamB = teams.find(t => t.id === teamBId)
          if (teamA) teamAName = teamA.name
          if (teamB) teamBName = teamB.name
        }
      }

      return {
        ...data,
        team_a_id: teamAId,
        team_b_id: teamBId,
        team_a_name: teamAName,
        team_b_name: teamBName,
        series: undefined,
      } as GameWithTeams
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  })
}
