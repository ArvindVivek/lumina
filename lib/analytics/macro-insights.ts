import { calculateConfidence } from '@/lib/analytics/confidence'
import { BENCH, band, pctText } from '@/lib/analytics/benchmarks'
import { getDb } from '@/lib/data'
import { playerName } from '@/lib/data/db'
import { queryEconomyManagement, queryFirstBloodConversion, queryOpeningDuelsByPlayer, queryPistolAnalysis, queryRoundBreakdown, queryRoundsForCriticalMoments, queryTimingPatterns, queryTradeDiscipline, queryUltimateEconomy } from '@/lib/analytics/macro-queries'
import type { CriticalMoment, EconomyDecisionData, EconomyManagementData, FirstBloodConversionData, MacroInsightResponse, PistolAnalysisData, PlayerOpeningDuelsData, RoundBreakdownData, TimingPatternData, TradeDisciplineData, UltimateEconomyData } from '@/lib/analytics/macro-types'
import { classifyRoundsAsCriticalMoments } from '@/lib/analytics/priority-classifier'

/*
 * Team insights: the numbers, a plain-English insight, a recommendation and a confidence
 * level. The API routes return these as JSON and the page renders them on the server, so both
 * show the same thing.
 */

export async function criticalMomentsInsight(teamId: string, tournamentId?: string | null, gameId?: string | null, priorityFilter?: string | null) {
  const rounds = await queryRoundsForCriticalMoments(
    teamId,
    gameId ?? undefined,
    tournamentId ?? undefined
  )

  const criticalMoments = classifyRoundsAsCriticalMoments(rounds, teamId)

  // Optional priority filter
  const filtered = priorityFilter
    ? criticalMoments.filter(m => m.priority === priorityFilter.toUpperCase())
    : criticalMoments

  const highCount = criticalMoments.filter(m => m.priority === 'HIGH').length
  const mediumCount = criticalMoments.filter(m => m.priority === 'MEDIUM').length
  const lowCount = criticalMoments.filter(m => m.priority === 'LOW').length

  const confidence = calculateConfidence(rounds.length, "rounds")

  const insight = highCount + mediumCount > 0
    ? `${highCount + mediumCount} rounds worth rewatching, ${highCount} of them must-watch.`
    : "No round stood out enough to flag."
  const recommendation = highCount > 0 ? "Start with the must-watch rounds: lost pistols and rounds that came down to the last player." : null

  const response: MacroInsightResponse<{
    moments: CriticalMoment[]
    counts: { high: number; medium: number; low: number }
  }> = {
    team_id: teamId,
    metric: "critical_moments",
    data: {
      moments: filtered,
      counts: { high: highCount, medium: mediumCount, low: lowCount },
    },
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function economyInsight(teamId: string, tournamentId?: string | null) {
  const rows = await queryEconomyManagement(teamId, tournamentId ?? undefined)

  const decisions: EconomyDecisionData[] = rows.map(row => ({
    economy_decision: row.economy_decision,
    rounds: parseInt(row.rounds),
    wins: parseInt(row.wins),
    win_rate: parseFloat(row.win_rate),
    avg_loadout_value: parseFloat(row.avg_loadout_value),
  }))

  const totalRounds = decisions.reduce((sum, d) => sum + d.rounds, 0)

  const data: EconomyManagementData = {
    decisions,
    total_rounds: totalRounds,
  }

  const confidence = calculateConfidence(totalRounds, "rounds")

  let insight = ""
  let recommendation: string | null = null
  const eco = decisions.find(d => d.economy_decision === 'eco')
  const full = decisions.find(d => d.economy_decision === 'full_buy')
  const fullLevel = full ? band(full.win_rate, BENCH.team.fullBuyWinRate) : "typical"
  const ecoLevel = eco ? band(eco.win_rate, BENCH.team.ecoWinRate) : "typical"
  if (full && fullLevel === "low") {
    insight = `Won ${pctText(full.win_rate)} of full-buy rounds, below most pro teams (${pctText(BENCH.team.fullBuyWinRate.low)} to ${pctText(BENCH.team.fullBuyWinRate.high)}).`
    recommendation = "Review lost full buys: with even guns, the plan or the trades decided them."
  } else if (eco && ecoLevel === "high") {
    insight = `Steals ${pctText(eco.win_rate)} of low-spend rounds, more than most teams.`
  } else if (full && fullLevel === "high") {
    insight = `Wins ${pctText(full.win_rate)} of full-buy rounds, better than most teams.`
  } else {
    insight = "Wins rounds at about the usual rate for each kind of buy."
  }

  const response: MacroInsightResponse<EconomyManagementData> = {
    team_id: teamId,
    metric: "economy_management",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function firstBloodInsight(teamId: string, tournamentId?: string | null) {
  const row = await queryFirstBloodConversion(teamId, tournamentId ?? undefined)

  const firstBloods = parseInt(row.first_bloods)
  const firstBloodWins = parseInt(row.first_blood_wins)
  const conversionRate = parseFloat(row.first_blood_conversion_rate) / 100

  const data: FirstBloodConversionData = {
    first_bloods: firstBloods,
    first_blood_wins: firstBloodWins,
    conversion_rate: conversionRate,
  }

  const confidence = calculateConfidence(firstBloods, "rounds")

  const level = band(conversionRate, BENCH.team.firstBloodConversion)
  const insight = level === "high"
    ? "Turns the first kill into a round win more often than most teams."
    : level === "low"
      ? `Wins only ${pctText(conversionRate)} of rounds after getting the first kill (most teams: ${pctText(BENCH.team.firstBloodConversion.low)} to ${pctText(BENCH.team.firstBloodConversion.high)}).`
      : "Converts first kills at a typical pro rate."
  const recommendation = level === "low" ? "After an early pick, slow down and take space together instead of chasing more fights." : null

  const response: MacroInsightResponse<FirstBloodConversionData> = {
    team_id: teamId,
    metric: "first_blood_conversion",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function openingDuelsInsight(teamId: string, tournamentId?: string | null) {
  const rows = await queryOpeningDuelsByPlayer(teamId, tournamentId ?? undefined)

  const players: PlayerOpeningDuelsData[] = rows.map(row => {
    const firstKills = parseInt(row.first_kills)
    const firstDeaths = parseInt(row.first_deaths)
    const totalRounds = parseInt(row.total_rounds)
    const openingDuelRate = totalRounds > 0 ? (firstKills + firstDeaths) / totalRounds : 0
    const successRate = (firstKills + firstDeaths) > 0 ? firstKills / (firstKills + firstDeaths) : 0

    return {
      player_id: row.player_id,
      player_name: playerName(getDb(), row.player_id),
      first_kills: firstKills,
      first_deaths: firstDeaths,
      opening_duel_rate: openingDuelRate,
      success_rate: successRate,
    }
  })

  const totalRounds = players.length > 0 ? parseInt(rows[0].total_rounds) : 0
  const confidence = calculateConfidence(totalRounds, "rounds")

  let insight = ""
  const regular = players.filter(p => p.first_kills + p.first_deaths >= 10)
  if (regular.length >= 2) {
    const best = regular.reduce((a, b) => (a.success_rate > b.success_rate ? a : b))
    const worst = regular.reduce((a, b) => (a.success_rate < b.success_rate ? a : b))
    insight = `${best.player_name} wins the most opening duels (${pctText(best.success_rate)}); ${worst.player_name} the fewest (${pctText(worst.success_rate)}).`
  } else {
    insight = "Not enough opening duels yet to compare players."
  }

  const response: MacroInsightResponse<{ players: PlayerOpeningDuelsData[] }> = {
    team_id: teamId,
    metric: "opening_duels_by_player",
    data: { players },
    insight,
    recommendation: null, // Player-specific, no team-level recommendation
    confidence,
  }

  return response
}

export async function pistolInsight(teamId: string, tournamentId?: string | null) {
  const row = await queryPistolAnalysis(teamId, tournamentId ?? undefined)

  const pistolRounds = parseInt(row.pistol_rounds)
  const pistolWins = parseInt(row.pistol_wins)
  const bonusWins = parseInt(row.bonus_wins)
  const bonusRounds = parseInt(row.total_bonus_rounds)
  const pistolWinRate = parseFloat(row.pistol_win_rate) / 100
  const conversionRate = bonusRounds > 0 ? bonusWins / bonusRounds : 0

  const data: PistolAnalysisData = {
    pistol_rounds: pistolRounds,
    pistol_wins: pistolWins,
    pistol_win_rate: pistolWinRate,
    bonus_wins: bonusWins,
    bonus_rounds: bonusRounds,
    conversion_rate: conversionRate,
  }

  const confidence = calculateConfidence(pistolRounds, "rounds")

  const level = band(pistolWinRate, BENCH.team.pistolWinRate)
  const insight = level === "high"
    ? `Wins more pistol rounds than most teams (typical: ${pctText(BENCH.team.pistolWinRate.low)} to ${pctText(BENCH.team.pistolWinRate.high)}).`
    : level === "low"
      ? "Loses more pistol rounds than most teams, which costs the next round's buy too."
      : "Wins pistol rounds at a typical rate."
  const recommendation = level === "low" ? "Drill two pistol setups per side and agree the default buys." : null

  const response: MacroInsightResponse<PistolAnalysisData> = {
    team_id: teamId,
    metric: "pistol_round_analysis",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function roundBreakdownInsight(teamId: string, tournamentId?: string | null, gameId?: string | null) {
  const rows = await queryRoundBreakdown(
    teamId,
    gameId ?? undefined,
    tournamentId ?? undefined
  )

  const rounds = rows.map(row => {
    const teamLoadoutValue = parseInt(row.team_loadout_value)
    const isWin = row.winning_team_id === teamId
    const economyType = teamLoadoutValue >= 20000
      ? 'full_buy'
      : teamLoadoutValue >= 10000
      ? 'force_buy'
      : 'eco'

    const roundData: RoundBreakdownData & {
      is_win: boolean
      economy_type: string
      team_a_alive: number
      team_b_alive: number
    } = {
      round_id: row.round_id,
      round_number: parseInt(row.round_number),
      game_id: row.game_id,
      map_name: row.map_name,
      winning_team_id: row.winning_team_id,
      first_blood_team_id: row.first_blood_team_id,
      spike_planted: row.spike_planted === 'true' || row.spike_planted === 't',
      spike_defused: row.spike_defused === 'true' || row.spike_defused === 't',
      team_loadout_value: teamLoadoutValue,
      opponent_loadout_value: parseInt(row.opponent_loadout_value),
      duration_ms: parseInt(row.duration_ms),
      is_win: isWin,
      economy_type: economyType,
      team_a_alive: parseInt(row.team_a_alive),
      team_b_alive: parseInt(row.team_b_alive),
    }

    return roundData
  })

  const totalRounds = rounds.length
  const wins = rounds.filter(r => r.is_win).length
  const winRate = totalRounds > 0 ? (wins / totalRounds) * 100 : 0

  const confidence = calculateConfidence(totalRounds, "rounds")

  const insight = `Win rate: ${winRate.toFixed(1)}% across ${totalRounds} rounds`
  const recommendation = null // This is raw data for display, no recommendations

  const response: MacroInsightResponse<{
    rounds: (RoundBreakdownData & { is_win: boolean; economy_type: string })[]
    total_rounds: number
    wins: number
  }> = {
    team_id: teamId,
    metric: "round_breakdown",
    data: {
      rounds,
      total_rounds: totalRounds,
      wins,
    },
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function timingInsight(teamId: string, tournamentId?: string | null) {
  const row = await queryTimingPatterns(teamId, tournamentId ?? undefined)

  const avgRoundDurationMs = parseFloat(row.avg_round_duration_ms)
  const avgFirstKillTimeMs = parseFloat(row.avg_first_kill_time_ms)
  const roundsAnalyzed = parseInt(row.rounds_analyzed)

  const data: TimingPatternData = {
    avg_round_duration_ms: avgRoundDurationMs,
    avg_first_kill_time_ms: avgFirstKillTimeMs,
    rounds_analyzed: roundsAnalyzed,
  }

  const confidence = calculateConfidence(roundsAnalyzed, "rounds")

  const seconds = avgFirstKillTimeMs / 1000
  const level = band(seconds, BENCH.team.firstKillSeconds)
  const insight = level === "low"
    ? `Rounds open fast: the first kill comes about ${Math.round(seconds)} seconds in, earlier than most teams.`
    : level === "high"
      ? `Rounds open slowly: the first kill comes about ${Math.round(seconds)} seconds in, later than most teams.`
      : `The first kill comes about ${Math.round(seconds)} seconds in, a typical pace.`
  const recommendation = null

  const response: MacroInsightResponse<TimingPatternData> = {
    team_id: teamId,
    metric: "timing_patterns",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function tradingInsight(teamId: string, tournamentId?: string | null) {
  const row = await queryTradeDiscipline(teamId, tournamentId ?? undefined)

  const totalDeaths = parseInt(row.total_deaths)
  const tradedDeaths = parseInt(row.traded_deaths)
  const firstDeaths = parseInt(row.first_deaths)
  const firstDeathsTraded = parseInt(row.first_deaths_traded)
  const overallTradeRate = parseFloat(row.overall_trade_rate) / 100
  const firstDeathTradeRate = parseFloat(row.first_death_trade_rate) / 100

  const data: TradeDisciplineData = {
    total_deaths: totalDeaths,
    traded_deaths: tradedDeaths,
    first_deaths: firstDeaths,
    first_deaths_traded: firstDeathsTraded,
    overall_trade_rate: overallTradeRate,
    first_death_trade_rate: firstDeathTradeRate,
  }

  const confidence = calculateConfidence(firstDeaths, "rounds")

  const level = band(overallTradeRate, BENCH.team.tradeRate)
  const insight = level === "high"
    ? `Trades ${pctText(overallTradeRate)} of deaths, more than most teams.`
    : level === "low"
      ? `Trades only ${pctText(overallTradeRate)} of deaths (most teams: ${pctText(BENCH.team.tradeRate.low)} to ${pctText(BENCH.team.tradeRate.high)}).`
      : `Trades ${pctText(overallTradeRate)} of deaths, a typical pro rate.`
  const recommendation = level === "low" ? "Set up crossfires so every first contact can be traded." : null

  const response: MacroInsightResponse<TradeDisciplineData> = {
    team_id: teamId,
    metric: "trade_discipline",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function ultimatesInsight(teamId: string, tournamentId?: string | null) {
  const row = await queryUltimateEconomy(teamId, tournamentId ?? undefined)

  const totalRounds = parseInt(row.total_rounds)
  const ultimatesUsed = parseInt(row.ultimates_used)
  const usageRate = parseFloat(row.usage_rate)
  const roundsWithUltAvailable = parseInt(row.rounds_with_ult_available)
  const ultAvailabilityWinRate = parseFloat(row.ult_availability_win_rate)

  const data: UltimateEconomyData = {
    total_rounds: totalRounds,
    ultimates_used: ultimatesUsed,
    usage_rate: usageRate,
    rounds_with_ult_available: roundsWithUltAvailable,
    ult_availability_win_rate: ultAvailabilityWinRate,
  }

  const confidence = calculateConfidence(roundsWithUltAvailable, "rounds")

  const level = band(ultAvailabilityWinRate, BENCH.team.ultWinRate)
  const insight = level === "high"
    ? `Wins ${pctText(ultAvailabilityWinRate)} of rounds with an ultimate charged, more than most teams.`
    : level === "low"
      ? `Wins only ${pctText(ultAvailabilityWinRate)} of rounds with an ultimate charged: charged ultimates aren't turning into rounds.`
      : `Wins ${pctText(ultAvailabilityWinRate)} of rounds with an ultimate charged, a typical rate.`
  const recommendation = level === "low" ? "Plan which rounds each ultimate is for, and use them together." : null

  const response: MacroInsightResponse<UltimateEconomyData> = {
    team_id: teamId,
    metric: "ultimate_economy",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}
