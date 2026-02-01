"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { usePlayers } from "@/lib/hooks/use-players"
import { usePushScreenData } from "@/lib/hooks/use-screen-data"

export default function PlayersPage() {
  const router = useRouter()
  const { data: players, isLoading } = usePlayers()
  const [searchQuery, setSearchQuery] = useState("")

  // Push players list to screen context for chat
  const screenData = useMemo(() => {
    if (!players) return null
    return {
      page: 'players',
      totalPlayers: players.length,
      players: players.slice(0, 50).map(p => ({ id: p.id, name: p.name, team: p.team?.name })),
    }
  }, [players])
  usePushScreenData('Players List', screenData, !isLoading && !!players)

  const filteredPlayers = players?.filter((player) => {
    if (searchQuery && !player.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    return true
  }) || []

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-text-tertiary">Loading players...</div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-4xl font-bold text-text-primary mb-3">Players</h1>
          <p className="text-lg text-text-secondary">
            {filteredPlayers.length} players tracked
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg px-9 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-valorant-accent"
          />
        </div>

        {/* Players Grid */}
        {filteredPlayers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPlayers.map((player) => (
              <div
                key={player.id}
                onClick={() => router.push(`/player-analytics?player=${player.id}`)}
                className="panel group cursor-pointer hover:bg-surface-hover transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-text-primary mb-1">
                      {player.name}
                    </h3>
                    {player.team?.name && (
                      <p className="text-sm text-text-secondary">
                        {player.team.name}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-xs text-text-tertiary">
                  Click to view detailed analytics
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="panel text-center py-12">
            <div className="text-text-tertiary">
              {searchQuery ? "No players found matching your search" : "No players found"}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
