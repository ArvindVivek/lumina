"use client"

import { useState, useMemo } from "react"
import { MapPin, TrendingUp, Search, ChevronRight } from "lucide-react"
import { useTeams } from "@/lib/hooks/use-teams"
import Link from "next/link"
import { usePushScreenData } from "@/lib/hooks/use-screen-data"
import { TeamLogo } from "@/components/valorant/team-logo"
import { getTeamShortName } from "@/lib/valorant-assets"

export default function TeamsPage() {
  const { data: teams, isLoading, error } = useTeams()
  const [searchQuery, setSearchQuery] = useState("")

  // Push teams list to screen context for chat
  const screenData = useMemo(() => {
    if (!teams) return null
    return {
      page: 'teams',
      totalTeams: teams.length,
      teams: teams.map(t => ({ id: t.id, name: t.name, shortName: t.short_name, region: t.region })),
    }
  }, [teams])
  usePushScreenData('Teams List', screenData, !isLoading && !!teams)

  const filteredTeams = teams?.filter((team) =>
    team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (team.region && team.region.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-text-primary mb-3">Teams</h1>
          <p className="text-lg text-text-secondary">
            Browse VCT Americas teams and their rosters
          </p>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-text-tertiary" />
          <input
            type="text"
            placeholder="Search teams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg pl-11 pr-4 py-3 text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-valorant-accent"
          />
        </div>

        {/* Teams Grid */}
        {isLoading ? (
          <div className="panel text-center py-12">
            <div className="text-text-tertiary">Loading teams...</div>
          </div>
        ) : error ? (
          <div className="panel text-center py-12">
            <div className="text-red-400 mb-2">Error loading teams</div>
            <div className="text-text-tertiary text-sm">{error.message}</div>
          </div>
        ) : filteredTeams && filteredTeams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTeams.map((team) => (
              <Link key={team.id} href={`/macro-review?team=${team.id}`}>
                <div className="group relative overflow-hidden rounded-xl border border-border hover:border-valorant-accent/50 bg-gradient-to-br from-surface/80 to-surface/40 backdrop-blur-sm transition-all cursor-pointer p-6">
                  {/* Team Header */}
                  <div className="flex items-center gap-5 mb-4">
                    <TeamLogo teamName={team.name} size="xl" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-text-primary mb-1 truncate">
                        {team.name}
                      </h3>
                      <p className="text-sm font-medium text-valorant-accent">
                        {team.short_name || getTeamShortName(team.name)}
                      </p>
                    </div>
                  </div>

                  {/* Team Details */}
                  {team.region && (
                    <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
                      <MapPin className="h-4 w-4" />
                      <span>{team.region}</span>
                    </div>
                  )}

                  {/* View Link */}
                  <div className="flex items-center justify-between text-sm pt-4 border-t border-border/50">
                    <span className="text-text-tertiary">View Team Analysis</span>
                    <ChevronRight className="h-4 w-4 text-valorant-accent group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="panel text-center py-12">
            <div className="text-text-tertiary">
              {searchQuery ? "No teams found matching your search" : "No teams found"}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
