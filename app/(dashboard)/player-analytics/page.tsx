import { Suspense } from 'react'
import { PlayerSelector } from '@/components/player/player-selector'
import { InsightCard } from '@/components/player/insight-card'
import { Skeleton } from '@/components/ui/skeleton'

// Hardcoded sample players for now (can be replaced with API call later)
const SAMPLE_PLAYERS = [
  { id: '2241', name: 'aspas', team: 'LOUD' },
  { id: '2173', name: 'yay', team: 'Cloud9' },
  { id: '2097', name: 'TenZ', team: 'Sentinels' },
  { id: '2105', name: 'Demon1', team: 'Evil Geniuses' },
]

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

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Player Analytics</h1>
          <p className="text-muted-foreground">
            Individual player performance insights
          </p>
        </div>
        <PlayerSelector
          players={SAMPLE_PLAYERS}
          selectedPlayerId={playerId}
        />
      </div>

      {playerId ? (
        <Suspense fallback={<InsightsSkeleton />}>
          <PlayerInsights playerId={playerId} />
        </Suspense>
      ) : (
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <p className="text-lg font-medium">Select a player</p>
            <p className="text-sm text-muted-foreground">
              Choose a player from the dropdown to view their analytics
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function InsightsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[180px]" />
      ))}
    </div>
  )
}
