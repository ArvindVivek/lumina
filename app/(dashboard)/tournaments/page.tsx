"use client"

import { useState, useMemo } from "react"
import { Trophy, Calendar, MapPin, ArrowRight } from "lucide-react"
import { useTournaments, Tournament } from "@/lib/hooks/use-tournaments"
import Link from "next/link"
import { usePushScreenData } from "@/lib/hooks/use-screen-data"

export default function TournamentsPage() {
  const { data: tournaments, isLoading } = useTournaments()
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all")

  // Push tournaments list to screen context for chat
  const screenData = useMemo(() => {
    if (!tournaments) return null
    return {
      page: 'tournaments',
      totalTournaments: tournaments.length,
      tournaments: tournaments.map(t => ({ id: t.id, name: t.name, region: t.region })),
    }
  }, [tournaments])
  usePushScreenData('Tournaments List', screenData, !isLoading && !!tournaments)

  const now = new Date()
  const filteredTournaments = tournaments?.filter((t) => {
    if (filter === "all") return true
    if (filter === "active") {
      // If no end date, assume completed (historical tournament)
      if (!t.end_date) return false
      return new Date(t.end_date) > now
    }
    if (filter === "completed") {
      // If no end date, assume completed (historical tournament)
      if (!t.end_date) return true
      return new Date(t.end_date) <= now
    }
    return true
  })

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "2024"  // Show year for historical tournaments
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const isActive = (tournament: Tournament) => {
    // If no end date, assume completed (VCT 2024 historical data)
    if (!tournament.end_date) return false
    return new Date(tournament.end_date) > now
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-text-primary mb-3">Tournaments</h1>
          <p className="text-lg text-text-secondary">
            Browse VCT Americas tournaments and matches
          </p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFilter("all")}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filter === "all"
                ? "bg-valorant-accent text-background"
                : "bg-surface text-text-secondary hover:bg-surface-hover"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filter === "active"
                ? "bg-valorant-accent text-background"
                : "bg-surface text-text-secondary hover:bg-surface-hover"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter("completed")}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filter === "completed"
                ? "bg-valorant-accent text-background"
                : "bg-surface text-text-secondary hover:bg-surface-hover"
            }`}
          >
            Completed
          </button>
        </div>

        {/* Tournaments Grid */}
        {isLoading ? (
          <div className="panel text-center py-12">
            <div className="text-text-tertiary">Loading tournaments...</div>
          </div>
        ) : filteredTournaments && filteredTournaments.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTournaments.map((tournament) => {
              const active = isActive(tournament)

              return (
                <Link key={tournament.id} href={`/tournaments/${tournament.id}`}>
                  <div className="panel group cursor-pointer">
                    {/* Status Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-valorant-accent" />
                        {active && (
                          <span className="px-2 py-1 rounded bg-win/10 text-win text-xs font-semibold uppercase">
                            Active
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tournament Name */}
                    <h3 className="text-xl font-semibold text-text-primary mb-3">
                      {tournament.name}
                    </h3>

                    {/* Details */}
                    <div className="space-y-2 text-sm text-text-secondary">
                      {tournament.region && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          <span>{tournament.region}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {formatDate(tournament.start_date)}
                          {tournament.end_date && ` — ${formatDate(tournament.end_date)}`}
                        </span>
                      </div>
                    </div>

                    {/* View Link */}
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-text-tertiary">View Matches</span>
                        <ArrowRight className="h-4 w-4 text-valorant-accent group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="panel text-center py-12">
            <div className="text-text-tertiary">No tournaments found</div>
          </div>
        )}
      </div>
    </div>
  )
}
