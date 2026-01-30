import { Suspense } from 'react'
import { TeamSelector } from '@/components/macro/team-selector'
import { MacroCard } from '@/components/macro/macro-card'
import { CriticalMomentsList } from '@/components/macro/critical-moments-list'
import { Skeleton } from '@/components/ui/skeleton'

// Hardcoded sample teams (can be replaced with API call later)
const SAMPLE_TEAMS = [
  { id: '1', name: 'LOUD' },
  { id: '2', name: 'Cloud9' },
  { id: '3', name: 'Sentinels' },
  { id: '4', name: 'Evil Geniuses' },
  { id: '5', name: 'NRG' },
]

async function fetchMacroInsight(teamId: string, endpoint: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  try {
    const res = await fetch(`${baseUrl}/api/macro-review/${endpoint}/${teamId}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

async function MacroInsights({ teamId }: { teamId: string }) {
  // Fetch all macro insights in parallel
  const [pistol, firstBlood, trading, openingDuels, economy, timing, ultimates, criticalMoments, roundBreakdown] = await Promise.all([
    fetchMacroInsight(teamId, 'pistol'),
    fetchMacroInsight(teamId, 'first-blood'),
    fetchMacroInsight(teamId, 'trading'),
    fetchMacroInsight(teamId, 'opening-duels'),
    fetchMacroInsight(teamId, 'economy'),
    fetchMacroInsight(teamId, 'timing'),
    fetchMacroInsight(teamId, 'ultimates'),
    fetchMacroInsight(teamId, 'critical-moments'),
    fetchMacroInsight(teamId, 'round-breakdown'),
  ])

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pistol && (
          <MacroCard
            title="Pistol Rounds"
            value={`${(pistol.data.pistol_win_rate * 100).toFixed(1)}%`}
            description={`${pistol.data.pistol_wins}/${pistol.data.pistol_rounds} won`}
            insight={pistol.insight}
            recommendation={pistol.recommendation}
            confidence={pistol.confidence}
          />
        )}

        {firstBlood && (
          <MacroCard
            title="First Blood Conversion"
            value={`${(firstBlood.data.conversion_rate * 100).toFixed(1)}%`}
            description="Win rate when getting first blood"
            insight={firstBlood.insight}
            recommendation={firstBlood.recommendation}
            confidence={firstBlood.confidence}
          />
        )}

        {trading && (
          <MacroCard
            title="Trade Discipline"
            value={`${(trading.data.overall_trade_rate * 100).toFixed(1)}%`}
            description="Deaths that were traded"
            insight={trading.insight}
            recommendation={trading.recommendation}
            confidence={trading.confidence}
          />
        )}

        {economy && economy.data?.decisions && (
          <MacroCard
            title="Economy Management"
            value={economy.data.decisions.find((d: { economy_decision: string; win_rate: number }) => d.economy_decision === 'eco')?.win_rate.toFixed(1) + '%' || 'N/A'}
            description="Eco round win rate"
            insight={economy.insight}
            recommendation={economy.recommendation}
            confidence={economy.confidence}
          />
        )}

        {timing && (
          <MacroCard
            title="Execution Timing"
            value={`${(timing.data.avg_round_duration_ms / 1000).toFixed(1)}s`}
            description="Average round duration"
            insight={timing.insight}
            recommendation={timing.recommendation}
            confidence={timing.confidence}
          />
        )}

        {ultimates && (
          <MacroCard
            title="Ultimate Usage"
            value={`${(ultimates.data.usage_rate * 100).toFixed(1)}%`}
            description="Ultimate usage efficiency"
            insight={ultimates.insight}
            recommendation={ultimates.recommendation}
            confidence={ultimates.confidence}
          />
        )}

        {openingDuels && openingDuels.data?.players && (
          <MacroCard
            title="Opening Duels"
            value={openingDuels.data.players.length}
            description="Players with opening duel data"
            insight={openingDuels.insight}
            recommendation={openingDuels.recommendation}
            confidence={openingDuels.confidence}
          />
        )}

        {roundBreakdown && (
          <MacroCard
            title="Round Breakdown"
            value={roundBreakdown.data?.total_rounds || 0}
            description="Total rounds analyzed"
            insight={roundBreakdown.insight}
            recommendation={roundBreakdown.recommendation}
            confidence={roundBreakdown.confidence}
          />
        )}
      </div>

      {criticalMoments && (
        <CriticalMomentsList
          moments={criticalMoments.data?.moments || []}
        />
      )}
    </div>
  )
}

export default async function MacroReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ team?: string }>
}) {
  const { team: teamId } = await searchParams

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Macro Review</h1>
          <p className="text-muted-foreground">
            Team-level tactical analysis
          </p>
        </div>
        <TeamSelector
          teams={SAMPLE_TEAMS}
          selectedTeamId={teamId}
        />
      </div>

      {teamId ? (
        <Suspense fallback={<MacroSkeleton />}>
          <MacroInsights teamId={teamId} />
        </Suspense>
      ) : (
        <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed">
          <div className="text-center">
            <p className="text-lg font-medium">Select a team</p>
            <p className="text-sm text-muted-foreground">
              Choose a team from the dropdown to view macro analytics
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function MacroSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[180px]" />
        ))}
      </div>
      <Skeleton className="h-[300px]" />
    </div>
  )
}
