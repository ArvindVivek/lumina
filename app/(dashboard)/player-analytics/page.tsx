import { Suspense } from 'react'
import { PlayerSelector } from '@/components/player/player-selector'
import { InsightCard } from '@/components/player/insight-card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'

async function getPlayers() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('players')
      .select('id, name, teams(name)')
      .limit(20)
      .order('name')

    if (error) {
      console.error('Error fetching players:', error)
      return []
    }

    return data?.map(player => ({
      id: player.id,
      name: player.name,
      team: (player.teams as any)?.name || 'Unknown'
    })) || []
  } catch (error) {
    console.error('Failed to fetch players:', error)
    // Fallback to sample players if database is not available
    return [
      { id: '2241', name: 'aspas', team: 'LOUD' },
      { id: '2173', name: 'yay', team: 'Cloud9' },
      { id: '2097', name: 'TenZ', team: 'Sentinels' },
      { id: '2105', name: 'Demon1', team: 'Evil Geniuses' },
    ]
  }
}

async function fetchPlayerInsight(playerId: string, endpoint: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/player-insights/${endpoint}/${playerId}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function PlayerInsights({ playerId }: { playerId: string }) {
  // Fetch all insights in parallel
  const [firstDeath, trading, openingDuels, clutch, agentPerf, multiKill, ecoRound] = await Promise.all([
    fetchPlayerInsight(playerId, 'first-death'),
    fetchPlayerInsight(playerId, 'trading'),
    fetchPlayerInsight(playerId, 'opening-duels'),
    fetchPlayerInsight(playerId, 'clutch'),
    fetchPlayerInsight(playerId, 'agent-performance'),
    fetchPlayerInsight(playerId, 'multi-kill'),
    fetchPlayerInsight(playerId, 'eco-round'),
  ])

  const hasAnyData = firstDeath || trading || openingDuels || clutch || multiKill || ecoRound

  if (!hasAnyData) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-xl border border-dashed border-border/50 bg-gradient-to-br from-muted/30 via-transparent to-muted/30 backdrop-blur-sm">
        <div className="text-center space-y-2 p-8">
          <div className="inline-flex p-4 rounded-full bg-muted mb-2">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-lg font-semibold">No data available</p>
          <p className="text-sm text-muted-foreground max-w-md">
            This player doesn't have any analytics data yet. Make sure the ETL scripts have been run and the database contains player statistics.
          </p>
          <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground font-mono">
              Player ID: {playerId}
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid-responsive-cards">
      {firstDeath && (
        <InsightCard
          title="First Death Impact"
          value={`${(firstDeath.data.loss_rate * 100).toFixed(1)}%`}
          description="Round loss rate when dying first"
          insight={firstDeath.insight}
          recommendation={firstDeath.recommendation}
          confidence={firstDeath.confidence}
        />
      )}

      {trading && (
        <InsightCard
          title="Trading Efficiency"
          value={`${(trading.data.trade_rate * 100).toFixed(1)}%`}
          description="Deaths that were traded by teammates"
          insight={trading.insight}
          recommendation={trading.recommendation}
          confidence={trading.confidence}
        />
      )}

      {openingDuels && (
        <InsightCard
          title="Opening Duels"
          value={`${(openingDuels.data.success_rate * 100).toFixed(1)}%`}
          description={`${openingDuels.data.first_kills} FK / ${openingDuels.data.first_deaths} FD`}
          insight={openingDuels.insight}
          recommendation={openingDuels.recommendation}
          confidence={openingDuels.confidence}
        />
      )}

      {clutch && (
        <InsightCard
          title="Clutch Performance"
          value={`${(clutch.data.clutch_rate * 100).toFixed(1)}%`}
          description={`${clutch.data.clutches_won}/${clutch.data.clutch_situations} clutches won`}
          insight={clutch.insight}
          recommendation={clutch.recommendation}
          confidence={clutch.confidence}
        />
      )}

      {multiKill && (
        <InsightCard
          title="Multi-Kill Rounds"
          value={multiKill.data.three_plus_kills}
          description={`3+ kill rounds (${multiKill.data.aces} aces)`}
          insight={multiKill.insight}
          recommendation={multiKill.recommendation}
          confidence={multiKill.confidence}
        />
      )}

      {ecoRound && ecoRound.data.phases && (
        <InsightCard
          title="Eco Round Performance"
          value={`${((ecoRound.data.phases.eco?.win_rate || 0) * 100).toFixed(1)}%`}
          description="Win rate on eco rounds"
          insight={ecoRound.insight}
          recommendation={ecoRound.recommendation}
          confidence={ecoRound.confidence}
        />
      )}
    </div>
  )
}

export default async function PlayerAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ player?: string }>
}) {
  const { player: playerId } = await searchParams
  const players = await getPlayers()

  return (
    <div className="p-responsive space-y-responsive">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-responsive-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Player Analytics
          </h1>
          <p className="text-muted-foreground mt-1">
            Individual player performance insights
          </p>
        </div>
        <PlayerSelector
          players={players}
          selectedPlayerId={playerId}
        />
      </div>

      {playerId ? (
        <Suspense fallback={<InsightsSkeleton />}>
          <PlayerInsights playerId={playerId} />
        </Suspense>
      ) : (
        <div className="flex h-[400px] items-center justify-center rounded-xl border border-dashed border-border/50 bg-gradient-to-br from-muted/30 via-transparent to-muted/30 backdrop-blur-sm">
          <div className="text-center space-y-2">
            <div className="inline-flex p-4 rounded-full bg-primary/10 text-primary mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <p className="text-lg font-semibold">Select a player</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose a player from the dropdown above to view their performance analytics and insights
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function InsightsSkeleton() {
  return (
    <div className="grid-responsive-cards">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[220px] rounded-xl" />
      ))}
    </div>
  )
}
