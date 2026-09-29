import { calculateConfidence } from '@/lib/analytics/confidence'
import { BENCH, band, pctText } from '@/lib/analytics/benchmarks'
import { queryAgentPerformance, queryClutchPerformance, queryEcoRoundPerformance, queryFirstDeathImpact, queryMultiKillRounds, queryOpeningDuels, queryTradingEfficiency } from '@/lib/analytics/queries'
import type { AgentData, AgentStats, ClutchData, EcoRoundData, FirstDeathData, InsightResponse, MultiKillData, OpeningDuelsData, PhaseStats, TradingData } from '@/lib/analytics/types'

/*
 * Player insights: the numbers, a plain-English insight, a recommendation and a confidence
 * level. The API routes return these as JSON and the page renders them on the server, so both
 * show the same thing.
 */

export async function agentPerformanceInsight(playerId: string, tournamentId?: string | null) {
  // Query agent performance data
  const rows = await queryAgentPerformance(playerId, tournamentId ?? undefined)

  let totalRounds = 0
  const agents: AgentStats[] = rows.map(row => {
    const roundsPlayed = parseInt(row.rounds_played)
    const totalKills = parseInt(row.total_kills)
    const totalDeaths = parseInt(row.total_deaths)
    const firstKills = parseInt(row.first_kills)
    const firstDeaths = parseInt(row.first_deaths)
    const roundsWon = parseInt(row.rounds_won)

    totalRounds += roundsPlayed

    const kdRatio = totalDeaths > 0 ? totalKills / totalDeaths : totalKills
    const killsPerRound = roundsPlayed > 0 ? totalKills / roundsPlayed : 0
    const firstKillRate = roundsPlayed > 0 ? firstKills / roundsPlayed : 0
    const firstDeathRate = roundsPlayed > 0 ? firstDeaths / roundsPlayed : 0
    const winRate = roundsPlayed > 0 ? roundsWon / roundsPlayed : 0

    const confidence = calculateConfidence(roundsPlayed, "rounds")

    return {
      agent: row.agent,
      rounds_played: roundsPlayed,
      kd_ratio: kdRatio,
      kills_per_round: killsPerRound,
      first_kill_rate: firstKillRate,
      first_death_rate: firstDeathRate,
      win_rate: winRate,
      confidence: confidence.level,
    }
  })

  const data: AgentData = {
    agents,
    total_rounds: totalRounds,
  }

  const confidence = calculateConfidence(totalRounds, "rounds")

  let insight = ""
  let recommendation: string | null = null
  const label = (a: string) => a.charAt(0).toUpperCase() + a.slice(1)
  const regular = agents.filter(a => a.rounds_played >= 20)
  if (agents.length === 0) {
    insight = "No agent data available."
  } else if (regular.length <= 1) {
    const main = regular[0] ?? agents[0]
    insight = `Plays mostly ${label(main.agent)}: the team won ${pctText(main.win_rate)} of those rounds.`
  } else {
    const best = regular.reduce((a, b) => (a.win_rate > b.win_rate ? a : b))
    const worst = regular.reduce((a, b) => (a.win_rate < b.win_rate ? a : b))
    insight = `Rounds go best on ${label(best.agent)} (${pctText(best.win_rate)} won) and worst on ${label(worst.agent)} (${pctText(worst.win_rate)}).`
    recommendation = best.win_rate - worst.win_rate >= 0.1 ? `Lean on ${label(best.agent)} when the map allows it.` : null
  }

  const response: InsightResponse<AgentData> = {
    player_id: playerId,
    metric: "agent_performance",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function clutchInsight(playerId: string, tournamentId?: string | null) {
  // Query clutch performance data
  const row = await queryClutchPerformance(playerId, tournamentId ?? undefined)

  // Handle null/NaN values properly
  const clutchSituations = parseInt(row.clutch_situations) || 0
  const clutchesWon = parseInt(row.clutches_won) || 0
  const clutchRate = clutchSituations > 0 ? clutchesWon / clutchSituations : 0

  // Don't return a card if there's no clutch data
  if (clutchSituations === 0) {
    return null
  }

  const data: ClutchData = {
    clutches_won: clutchesWon,
    clutch_situations: clutchSituations,
    clutch_rate: clutchRate,
  }

  const confidence = calculateConfidence(clutchSituations, "clutch situations")

  const level = band(clutchRate, BENCH.player.clutchRate)
  const insight = level === "high"
    ? `Wins more clutches than most pros (typical: ${pctText(BENCH.player.clutchRate.low)} to ${pctText(BENCH.player.clutchRate.high)}).`
    : level === "low"
      ? "Wins fewer clutches than most pros."
      : "Wins clutches at a typical pro rate."
  const recommendation = level === "low" ? "Review lost clutches: play for time and isolate one fight at a time." : null

  const response: InsightResponse<ClutchData> = {
    player_id: playerId,
    metric: "clutch_performance",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function ecoRoundInsight(playerId: string, tournamentId?: string | null) {
  // Query eco round performance data
  const rows = await queryEcoRoundPerformance(playerId, tournamentId ?? undefined)

  const phases: Record<string, PhaseStats> = {}
  let totalRounds = 0

  rows.forEach(row => {
    // Handle null/NaN values properly
    const rounds = parseInt(row.rounds) || 0
    const totalKills = parseInt(row.total_kills) || 0
    const totalDeaths = parseInt(row.total_deaths) || 0
    const roundsWon = parseInt(row.rounds_won) || 0

    if (rounds === 0) return // Skip phases with no data

    totalRounds += rounds

    const kdRatio = totalDeaths > 0 ? totalKills / totalDeaths : totalKills
    const winRate = rounds > 0 ? roundsWon / rounds : 0

    phases[row.phase] = {
      rounds,
      kd_ratio: kdRatio,
      win_rate: winRate,
    }
  })

  // Don't return a card if there's no data
  if (totalRounds === 0) {
    return null
  }

  const data: EcoRoundData = {
    phases,
    total_rounds: totalRounds,
  }

  const confidence = calculateConfidence(totalRounds, "rounds")

  let insight = ""
  let recommendation: string | null = null
  const names: Record<string, string> = { pistol: "pistol rounds", eco: "eco rounds", force: "force buys", full: "full buys" }
  const phaseEntries = Object.entries(phases).filter(([, v]) => v.rounds >= 10)
  if (phaseEntries.length === 0) {
    insight = "Not enough rounds of any one type yet."
  } else {
    const best = phaseEntries.reduce((a, b) => (a[1].kd_ratio > b[1].kd_ratio ? a : b))
    const worst = phaseEntries.reduce((a, b) => (a[1].kd_ratio < b[1].kd_ratio ? a : b))
    insight = `Fights best on ${names[best[0]] ?? best[0]} (K/D ${best[1].kd_ratio.toFixed(2)}) and worst on ${names[worst[0]] ?? worst[0]} (K/D ${worst[1].kd_ratio.toFixed(2)}).`
    recommendation = worst[1].kd_ratio < 0.9 ? `Plan ${names[worst[0]] ?? worst[0]} with the team: trade together instead of taking duels alone.` : null
  }

  const response: InsightResponse<EcoRoundData> = {
    player_id: playerId,
    metric: "eco_round_performance",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function firstDeathInsight(playerId: string, tournamentId?: string | null) {
  // Query first death impact data
  const row = await queryFirstDeathImpact(playerId, tournamentId ?? undefined)

  // Handle null/NaN values properly
  const total = parseInt(row.total) || 0
  const losses = parseInt(row.losses) || 0
  const lossRate = total > 0 ? losses / total : 0

  // Don't return a card if there's no data
  if (total === 0) {
    return null
  }

  const data: FirstDeathData = {
    losses,
    total,
    loss_rate: lossRate,
  }

  const confidence = calculateConfidence(total, "rounds")

  const level = band(lossRate, BENCH.player.firstDeathLoss)
  const insight = level === "high"
    ? `The team loses more often than usual when this player dies first (typical: ${pctText(BENCH.player.firstDeathLoss.low)} to ${pctText(BENCH.player.firstDeathLoss.high)}).`
    : level === "low"
      ? "The team recovers from this player's first deaths better than most."
      : "Dying first costs the round about as often as it does for most pros."
  const recommendation = level === "high" ? "Take first contact with a teammate close enough to trade." : null

  const response: InsightResponse<FirstDeathData> = {
    player_id: playerId,
    metric: "first_death_impact",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function multiKillInsight(playerId: string, tournamentId?: string | null) {
  // Query multi-kill rounds data
  const row = await queryMultiKillRounds(playerId, tournamentId ?? undefined)

  // Handle null/NaN values properly
  const totalRounds = parseInt(row.total_rounds) || 0
  const totalKills = parseInt(row.total_kills) || 0
  const twoPlusKills = parseInt(row.two_plus_kills) || 0
  const threePlusKills = parseInt(row.three_plus_kills) || 0
  const fourPlusKills = parseInt(row.four_plus_kills) || 0
  const aces = parseInt(row.aces) || 0
  const killsPerRound = totalRounds > 0 ? totalKills / totalRounds : 0

  // Don't return a card if there's no data
  if (totalRounds === 0) {
    return null
  }

  const data: MultiKillData = {
    two_plus_kills: twoPlusKills,
    three_plus_kills: threePlusKills,
    four_plus_kills: fourPlusKills,
    aces,
    total_rounds: totalRounds,
    kills_per_round: killsPerRound,
  }

  const confidence = calculateConfidence(totalRounds, "rounds")

  const multiKillRate = totalRounds > 0 ? twoPlusKills / totalRounds : 0
  const level = band(multiKillRate, BENCH.player.multiKillRate)
  const insight = `${pctText(multiKillRate)} of rounds with 2+ kills: ` + (level === "high"
    ? "more than most pros."
    : level === "low"
      ? "fewer than most pros, which fits a support or anchor role."
      : "about typical for a pro.") + (aces > 0 ? ` Includes ${aces} ace${aces > 1 ? "s" : ""}.` : "")
  const recommendation = null

  const response: InsightResponse<MultiKillData> = {
    player_id: playerId,
    metric: "multi_kill",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function openingDuelsInsight(playerId: string, tournamentId?: string | null) {
  // Query opening duels data
  const row = await queryOpeningDuels(playerId, tournamentId ?? undefined)

  // Handle null/NaN values properly
  const totalRounds = parseInt(row.total_rounds) || 0
  const firstKills = parseInt(row.first_kills) || 0
  const firstDeaths = parseInt(row.first_deaths) || 0
  const openingDuels = firstKills + firstDeaths
  const openingDuelRate = totalRounds > 0 ? openingDuels / totalRounds : 0
  const successRate = openingDuels > 0 ? firstKills / openingDuels : 0

  // Don't return a card if there's no data
  if (totalRounds === 0) {
    return null
  }

  const data: OpeningDuelsData = {
    first_kills: firstKills,
    first_deaths: firstDeaths,
    total_rounds: totalRounds,
    opening_duel_rate: openingDuelRate,
    success_rate: successRate,
  }

  const confidence = calculateConfidence(openingDuels, "opening duels")

  const level = band(successRate, BENCH.player.openingSuccess)
  const insight = level === "high"
    ? `Wins more opening duels than most pros (typical: ${pctText(BENCH.player.openingSuccess.low)} to ${pctText(BENCH.player.openingSuccess.high)}).`
    : level === "low"
      ? "Loses more opening duels than most pros."
      : "Wins opening duels at a typical pro rate."
  const recommendation = level === "low" ? "Take fewer dry first fights: use utility or a teammate's info before peeking." : null

  const response: InsightResponse<OpeningDuelsData> = {
    player_id: playerId,
    metric: "opening_duels",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}

export async function tradingInsight(playerId: string, tournamentId?: string | null) {
  // Query trading efficiency data
  const row = await queryTradingEfficiency(playerId, tournamentId ?? undefined)

  // Handle null/NaN values properly
  const totalDeaths = parseInt(row.total_deaths) || 0
  const traded = parseInt(row.traded) || 0
  const tradeRate = totalDeaths > 0 ? traded / totalDeaths : 0

  // Don't return a card if there's no data
  if (totalDeaths === 0) {
    return null
  }

  const data: TradingData = {
    traded,
    total_deaths: totalDeaths,
    trade_rate: tradeRate,
  }

  const confidence = calculateConfidence(totalDeaths, "deaths")

  const level = band(tradeRate, BENCH.player.tradeRate)
  const insight = level === "high"
    ? `Teammates trade this player's deaths more than most (typical: ${pctText(BENCH.player.tradeRate.low)} to ${pctText(BENCH.player.tradeRate.high)}).`
    : level === "low"
      ? "Deaths are traded less often than for most pros: often dying out of teammates' reach."
      : "Deaths are traded at a typical pro rate."
  const recommendation = level === "low" ? "Play closer to teammates so a death can be traded." : null

  const response: InsightResponse<TradingData> = {
    player_id: playerId,
    metric: "trading_efficiency",
    data,
    insight,
    recommendation,
    confidence,
  }

  return response
}
