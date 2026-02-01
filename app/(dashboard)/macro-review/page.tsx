import { Suspense } from 'react'
import { TeamSelector } from '@/components/macro/team-selector'
import { MacroCard } from '@/components/macro/macro-card'
import { CriticalMomentsList } from '@/components/macro/critical-moments-list'
import { TeamRoster } from '@/components/team/team-roster'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'
import { Target, Skull, Users, Crosshair, Coins, BarChart3 } from 'lucide-react'

async function getTeams() {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('teams')
      .select('id, name')
      .order('name')

    if (error) {
      console.error('Error fetching teams:', error)
      return []
    }

    return data?.map(team => ({
      id: team.id,
      name: team.name,
    })) || []
  } catch (error) {
    console.error('Failed to fetch teams:', error)
    return []
  }
}

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
  // Note: timing and ultimates removed - data not available from grid.gg API
  const [pistol, firstBlood, trading, openingDuels, economy, criticalMoments, roundBreakdown] = await Promise.all([
    fetchMacroInsight(teamId, 'pistol'),
    fetchMacroInsight(teamId, 'first-blood'),
    fetchMacroInsight(teamId, 'trading'),
    fetchMacroInsight(teamId, 'opening-duels'),
    fetchMacroInsight(teamId, 'economy'),
    fetchMacroInsight(teamId, 'critical-moments'),
    fetchMacroInsight(teamId, 'round-breakdown'),
  ])

  return (
    <div className="space-y-responsive">
      <div className="grid-responsive-cards">
        {pistol && (
          <MacroCard
            title="Pistol Rounds"
            value={`${(pistol.data.pistol_win_rate * 100).toFixed(1)}%`}
            description={`${pistol.data.pistol_wins}/${pistol.data.pistol_rounds} won`}
            insight={pistol.insight}
            recommendation={pistol.recommendation}
            confidence={pistol.confidence}
            icon={Target}
            iconColor="text-valorant-accent"
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
            icon={Skull}
            iconColor="text-chart-attack"
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
            icon={Users}
            iconColor="text-chart-defense"
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
            icon={Coins}
            iconColor="text-yellow-500"
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
            icon={Crosshair}
            iconColor="text-orange-500"
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
            icon={BarChart3}
            iconColor="text-blue-500"
          />
        )}
      </div>

      {/* Team Roster */}
      <TeamRoster teamId={teamId} />

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
  const teams = await getTeams()

  return (
    <div className="p-responsive space-y-responsive">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-responsive-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Macro Review
          </h1>
          <p className="text-muted-foreground mt-1">
            Team-level tactical analysis and strategic insights
          </p>
        </div>
        <TeamSelector
          teams={teams}
          selectedTeamId={teamId}
        />
      </div>

      {teamId ? (
        <Suspense fallback={<MacroSkeleton />}>
          <MacroInsights teamId={teamId} />
        </Suspense>
      ) : (
        <div className="flex h-[400px] items-center justify-center rounded-xl border border-dashed border-border/50 bg-gradient-to-br from-muted/30 via-transparent to-muted/30 backdrop-blur-sm">
          <div className="text-center space-y-2">
            <div className="inline-flex p-4 rounded-full bg-primary/10 text-primary mb-2">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-lg font-semibold">Select a team</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Choose a team from the dropdown above to view their macro performance analytics and strategic insights
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function MacroSkeleton() {
  return (
    <div className="space-y-responsive">
      <div className="grid-responsive-cards">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[180px]" />
        ))}
      </div>
      <Skeleton className="h-[300px]" />
    </div>
  )
}
