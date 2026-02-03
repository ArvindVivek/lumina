"use client"

import { useTeams } from "@/lib/hooks/use-teams"
import { usePlayers } from "@/lib/hooks/use-players"

export default function DebugPage() {
  const { data: teams, isLoading: teamsLoading, error: teamsError } = useTeams()
  const { data: players, isLoading: playersLoading, error: playersError } = usePlayers()

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-bold">Debug Page - Data Connectivity</h1>

      {/* Environment Check */}
      <div className="panel">
        <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
        <div className="space-y-2 font-mono text-sm">
          <div>
            <span className="text-text-tertiary">NEXT_PUBLIC_SUPABASE_URL: </span>
            <span className={process.env.NEXT_PUBLIC_SUPABASE_URL ? 'text-green-500' : 'text-red-500'}>
              {process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET'}
            </span>
          </div>
          <div>
            <span className="text-text-tertiary">NEXT_PUBLIC_SUPABASE_ANON_KEY: </span>
            <span className={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'text-green-500' : 'text-red-500'}>
              {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'SET (' + process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20) + '...)' : 'NOT SET'}
            </span>
          </div>
        </div>
      </div>

      {/* Teams Check */}
      <div className="panel">
        <h2 className="text-xl font-semibold mb-4">Teams Data</h2>
        {teamsLoading && <p className="text-text-tertiary">Loading teams...</p>}
        {teamsError && (
          <div className="text-red-500">
            <p className="font-semibold">Error loading teams:</p>
            <pre className="text-xs mt-2 p-2 bg-black/20 rounded">
              {JSON.stringify(teamsError, null, 2)}
            </pre>
          </div>
        )}
        {teams && (
          <div>
            <p className="text-green-500 font-semibold mb-2">✅ {teams.length} teams loaded</p>
            <div className="text-sm space-y-1">
              {teams.slice(0, 5).map(team => (
                <div key={team.id} className="text-text-secondary">
                  • {team.name} (ID: {team.id})
                </div>
              ))}
              {teams.length > 5 && <div className="text-text-tertiary">... and {teams.length - 5} more</div>}
            </div>
          </div>
        )}
      </div>

      {/* Players Check */}
      <div className="panel">
        <h2 className="text-xl font-semibold mb-4">Players Data</h2>
        {playersLoading && <p className="text-text-tertiary">Loading players...</p>}
        {playersError && (
          <div className="text-red-500">
            <p className="font-semibold">Error loading players:</p>
            <pre className="text-xs mt-2 p-2 bg-black/20 rounded">
              {JSON.stringify(playersError, null, 2)}
            </pre>
          </div>
        )}
        {players && (
          <div>
            <p className="text-green-500 font-semibold mb-2">✅ {players.length} players loaded</p>
            <div className="text-sm space-y-1">
              {players.slice(0, 10).map(player => (
                <div key={player.id} className="text-text-secondary">
                  • {player.name} {player.team ? `(${player.team.name})` : '(No team)'}
                </div>
              ))}
              {players.length > 10 && <div className="text-text-tertiary">... and {players.length - 10} more</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
