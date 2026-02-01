"use client"

import { useRouter } from "next/navigation"
import { useTeamPlayers } from "@/lib/hooks/use-players"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Users } from "lucide-react"

interface TeamRosterProps {
  teamId: string
  teamName?: string
}

export function TeamRoster({ teamId, teamName }: TeamRosterProps) {
  const router = useRouter()
  const { data: players, isLoading } = useTeamPlayers(teamId)

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Team Roster</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Loading players...</p>
        </CardContent>
      </Card>
    )
  }

  if (!players || players.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Team Roster</CardTitle>
          </div>
          {teamName && <CardDescription>{teamName}</CardDescription>}
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No players found for this team</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Team Roster</CardTitle>
        </div>
        {teamName && <CardDescription>{teamName} • {players.length} players</CardDescription>}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {players.map((player) => (
            <div
              key={player.id}
              onClick={() => router.push(`/player-analytics?player=${player.id}`)}
              className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-primary">
                  {player.name.substring(0, 2).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {player.name}
                </p>
                {player.agent_pool && player.agent_pool.length > 0 && (
                  <p className="text-xs text-muted-foreground truncate">
                    {player.agent_pool.slice(0, 3).join(", ")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
