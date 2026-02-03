import { Suspense } from 'react'
import { PlayerSelector } from '@/components/player/player-selector'
import { InsightCard } from '@/components/player/insight-card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/server'
import {
  queryFirstDeathImpact,
  queryTradingEfficiency,
  queryOpeningDuels,
  queryClutchPerformance,
  queryAgentPerformance,
  queryMultiKillRounds,
  queryEcoRoundPerformance,
} from '@/lib/analytics/queries'
import { calculateConfidence } from '@/lib/analytics/confidence'
import type {
  FirstDeathData,
  TradingData,
  OpeningDuelsData,
  ClutchData,
  MultiKillData,
  EcoRoundData,
} from '@/lib/analytics/types'

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

async function PlayerInsights({ playerId }: { playerId: string }) {
  // Fetch all query data in parallel
  const [
    firstDeathRow,
    tradingRow,
    openingDuelsRow,
    clutchRow,
    agentRow,
    multiKillRow,
    ecoRoundRow,
  ] = await Promise.all([
    queryFirstDeathImpact(playerId),
    queryTradingEfficiency(playerId),
    queryOpeningDuels(playerId),
    queryClutchPerformance(playerId),
    queryAgentPerformance(playerId),
    queryMultiKillRounds(playerId),
    queryEcoRoundPerformance(playerId),
  ])

  // Process first death
  const firstDeathTotal = parseInt(firstDeathRow.total) || 0
  const firstDeathLosses = parseInt(firstDeathRow.losses) || 0
  const firstDeath = firstDeathTotal > 0 ? {
    data: {
      losses: firstDeathLosses,
      total: firstDeathTotal,
      loss_rate: firstDeathTotal > 0 ? firstDeathLosses / firstDeathTotal : 0,
    },
    insight: firstDeathLosses / firstDeathTotal > 0.7
      ? "High round loss rate when dying first"
      : "Reasonable first death impact",
    recommendation: firstDeathLosses / firstDeathTotal > 0.7
      ? "Focus on staying alive longer in crucial rounds"
      : null,
    confidence: calculateConfidence(firstDeathTotal, "first deaths"),
  } : null

  // Process trading
  const totalDeaths = parseInt(tradingRow.total_deaths) || 0
  const traded = parseInt(tradingRow.traded) || 0
  const trading = totalDeaths > 0 ? {
    data: {
      traded: traded,
      total_deaths: totalDeaths,
      trade_rate: totalDeaths > 0 ? traded / totalDeaths : 0,
    },
    insight: traded / totalDeaths > 0.7
      ? "Excellent trading efficiency"
      : "Room to improve trading",
    recommendation: traded / totalDeaths < 0.5
      ? "Work on positioning near teammates for trade opportunities"
      : null,
    confidence: calculateConfidence(totalDeaths, "deaths"),
  } : null

  // Process opening duels
  const totalRounds = parseInt(openingDuelsRow.total_rounds) || 0
  const firstKills = parseInt(openingDuelsRow.first_kills) || 0
  const firstDeaths = parseInt(openingDuelsRow.first_deaths) || 0
  const openingDuels = firstKills + firstDeaths
  const openingDuelsData = totalRounds > 0 ? {
    data: {
      first_kills: firstKills,
      first_deaths: firstDeaths,
      total_rounds: totalRounds,
      opening_duel_rate: totalRounds > 0 ? openingDuels / totalRounds : 0,
      success_rate: openingDuels > 0 ? firstKills / openingDuels : 0,
    },
    insight: openingDuels > 0 && firstKills / openingDuels > 0.6
      ? "Dominant opening duelist"
      : "Solid opening duel performance",
    recommendation: openingDuels > 0 && firstKills / openingDuels < 0.4
      ? "Practice crosshair placement and pre-aiming common angles"
      : null,
    confidence: calculateConfidence(openingDuels, "opening duels"),
  } : null

  // Process clutch
  const clutchSituations = parseInt(clutchRow.clutch_situations) || 0
  const clutchesWon = parseInt(clutchRow.clutches_won) || 0
  const clutch = clutchSituations > 0 ? {
    data: {
      clutches_won: clutchesWon,
      clutch_situations: clutchSituations,
      clutch_rate: clutchSituations > 0 ? clutchesWon / clutchSituations : 0,
    },
    insight: clutchesWon / clutchSituations > 0.3
      ? "Strong clutch performer"
      : "Average clutch ability",
    recommendation: clutchesWon / clutchSituations < 0.2
      ? "Practice 1vX situations and crosshair placement"
      : null,
    confidence: calculateConfidence(clutchSituations, "clutch situations"),
  } : null

  // Process multi-kill
  const twoPlusKills = parseInt(multiKillRow.two_plus_kills) || 0
  const threePlusKills = parseInt(multiKillRow.three_plus_kills) || 0
  const fourPlusKills = parseInt(multiKillRow.four_plus_kills) || 0
  const aces = parseInt(multiKillRow.aces) || 0
  const multiKillTotalRounds = parseInt(multiKillRow.total_rounds) || 0
  const multiKill = threePlusKills > 0 ? {
    data: {
      two_plus_kills: twoPlusKills,
      three_plus_kills: threePlusKills,
      four_plus_kills: fourPlusKills,
      aces: aces,
      total_rounds: multiKillTotalRounds,
      kills_per_round: multiKillTotalRounds > 0 ? (parseInt(multiKillRow.total_kills) || 0) / multiKillTotalRounds : 0,
    },
    insight: `${threePlusKills} rounds with 3+ kills`,
    recommendation: null,
    confidence: calculateConfidence(threePlusKills, "multi-kill rounds"),
  } : null

  // Process eco round (array of phases)
  const phases: Record<string, { win_rate: number; rounds: number; wins: number }> = {}
  let totalRoundsAllPhases = 0

  for (const row of ecoRoundRow) {
    const rounds = parseInt(row.rounds) || 0
    const roundsWon = parseInt(row.rounds_won) || 0
    phases[row.phase] = {
      win_rate: rounds > 0 ? roundsWon / rounds : 0,
      rounds,
      wins: roundsWon,
    }
    totalRoundsAllPhases += rounds
  }

  const ecoPhase = phases['eco']
  const ecoRound = ecoPhase ? {
    data: {
      phases,
      total_rounds: totalRoundsAllPhases,
    },
    insight: ecoPhase.win_rate > 0.3
      ? "Strong eco round performance"
      : "Standard eco round stats",
    recommendation: null,
    confidence: calculateConfidence(ecoPhase.rounds, "eco rounds"),
  } : null

  const hasAnyData = firstDeath || trading || openingDuelsData || clutch || multiKill || ecoRound

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

      {openingDuelsData && (
        <InsightCard
          title="Opening Duels"
          value={`${(openingDuelsData.data.success_rate * 100).toFixed(1)}%`}
          description={`${openingDuelsData.data.first_kills} FK / ${openingDuelsData.data.first_deaths} FD`}
          insight={openingDuelsData.insight}
          recommendation={openingDuelsData.recommendation}
          confidence={openingDuelsData.confidence}
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
