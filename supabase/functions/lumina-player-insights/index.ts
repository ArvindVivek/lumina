import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { Hono } from "npm:hono@4.6.14"
import pg from "npm:pg@8.13.1"
import { corsHeaders } from "../_shared/cors.ts"
import { calculateConfidence } from "../_shared/confidence.ts"
import { jsonResponse, errorResponse } from "../_shared/response.ts"
import * as queries from "./queries.ts"
import type {
  InsightResponse,
  FirstDeathData,
  TradingData,
  OpeningDuelsData,
  ClutchData,
  AgentData,
  AgentStats,
  MultiKillData,
  EcoRoundData,
  PhaseStats,
} from "./types.ts"

const app = new Hono()

// CORS preflight for all routes
app.options("*", (c) => new Response("ok", { headers: corsHeaders }))

/**
 * Get database client
 */
async function getClient(): Promise<pg.Client> {
  // Use SUPABASE_DB_URL (standard edge runtime env) or DATABASE_URL (custom)
  const connectionString = Deno.env.get("SUPABASE_DB_URL") || Deno.env.get("DATABASE_URL")!
  const client = new pg.Client({
    connectionString,
  })
  await client.connect()
  return client
}

/**
 * PLAY-01: First Death Impact Analysis
 * GET /lumina-player-insights/first-death/:playerId
 */
app.get("/lumina-player-insights/first-death/:playerId", async (c) => {
  const playerId = c.req.param("playerId")
  const tournamentId = c.req.query("tournament_id")

  const client = await getClient()
  try {
    const row = await queries.queryFirstDeathImpact(client, playerId, tournamentId)

    const total = parseInt(row.total)
    const losses = parseInt(row.losses)
    const lossRate = total > 0 ? losses / total : 0

    const data: FirstDeathData = {
      losses,
      total,
      loss_rate: lossRate,
    }

    const confidence = calculateConfidence(total, "rounds")

    let insight = ""
    let recommendation: string | null = null

    if (lossRate > 0.75) {
      insight = "Critical issue: Dying first without contributing leads to round losses."
      recommendation = "Focus on positioning and avoid unnecessary early engagements."
    } else if (lossRate > 0.5) {
      insight = "Moderate impact: First deaths correlate with round losses."
      recommendation = "Review positioning to minimize valueless first deaths."
    } else {
      insight = "Low impact: Team can often recover from player's first deaths."
      recommendation = null
    }

    const response: InsightResponse<FirstDeathData> = {
      player_id: playerId,
      metric: "first_death_impact",
      data,
      insight,
      recommendation,
      confidence,
    }

    return jsonResponse(response)
  } catch (error) {
    return errorResponse(`Failed to query first death impact: ${error.message}`, 500)
  } finally {
    await client.end()
  }
})

/**
 * PLAY-02: Trading Efficiency Metrics
 * GET /lumina-player-insights/trading/:playerId
 */
app.get("/lumina-player-insights/trading/:playerId", async (c) => {
  const playerId = c.req.param("playerId")
  const tournamentId = c.req.query("tournament_id")

  const client = await getClient()
  try {
    const row = await queries.queryTradingEfficiency(client, playerId, tournamentId)

    const totalDeaths = parseInt(row.total_deaths)
    const traded = parseInt(row.traded)
    const tradeRate = totalDeaths > 0 ? traded / totalDeaths : 0

    const data: TradingData = {
      traded,
      total_deaths: totalDeaths,
      trade_rate: tradeRate,
    }

    const confidence = calculateConfidence(totalDeaths, "deaths")

    let insight = ""
    let recommendation: string | null = null

    if (tradeRate < 0.3) {
      insight = "Low trade rate: Deaths often go unpunished."
      recommendation = "Play closer to teammates to enable trade opportunities."
    } else if (tradeRate < 0.5) {
      insight = "Below average trade rate: Room for improvement."
      recommendation = "Coordinate timing with teammates for better trading."
    } else if (tradeRate < 0.7) {
      insight = "Good trade rate: Deaths are often traded."
      recommendation = null
    } else {
      insight = "Excellent trade rate: Team consistently trades deaths."
      recommendation = null
    }

    const response: InsightResponse<TradingData> = {
      player_id: playerId,
      metric: "trading_efficiency",
      data,
      insight,
      recommendation,
      confidence,
    }

    return jsonResponse(response)
  } catch (error) {
    return errorResponse(`Failed to query trading efficiency: ${error.message}`, 500)
  } finally {
    await client.end()
  }
})

/**
 * PLAY-03: Opening Duel Performance
 * GET /lumina-player-insights/opening-duels/:playerId
 */
app.get("/lumina-player-insights/opening-duels/:playerId", async (c) => {
  const playerId = c.req.param("playerId")
  const tournamentId = c.req.query("tournament_id")

  const client = await getClient()
  try {
    const row = await queries.queryOpeningDuels(client, playerId, tournamentId)

    const totalRounds = parseInt(row.total_rounds)
    const firstKills = parseInt(row.first_kills)
    const firstDeaths = parseInt(row.first_deaths)
    const openingDuels = firstKills + firstDeaths
    const openingDuelRate = totalRounds > 0 ? openingDuels / totalRounds : 0
    const successRate = openingDuels > 0 ? firstKills / openingDuels : 0

    const data: OpeningDuelsData = {
      first_kills: firstKills,
      first_deaths: firstDeaths,
      total_rounds: totalRounds,
      opening_duel_rate: openingDuelRate,
      success_rate: successRate,
    }

    const confidence = calculateConfidence(openingDuels, "opening duels")

    let insight = ""
    let recommendation: string | null = null

    if (successRate > 0.6) {
      insight = "Dominant opening duelist with high success rate."
      recommendation = null
    } else if (successRate > 0.5) {
      insight = "Solid opening duel performance."
      recommendation = null
    } else if (successRate > 0.4) {
      insight = "Below average opening duel success."
      recommendation = "Practice crosshair placement and pre-aiming common angles."
    } else {
      insight = "Struggles in opening duels."
      recommendation = "Consider adjusting role or reviewing VODs to improve aim and positioning."
    }

    const response: InsightResponse<OpeningDuelsData> = {
      player_id: playerId,
      metric: "opening_duels",
      data,
      insight,
      recommendation,
      confidence,
    }

    return jsonResponse(response)
  } catch (error) {
    return errorResponse(`Failed to query opening duels: ${error.message}`, 500)
  } finally {
    await client.end()
  }
})

/**
 * PLAY-04: Clutch Situation Analysis
 * GET /lumina-player-insights/clutch/:playerId
 */
app.get("/lumina-player-insights/clutch/:playerId", async (c) => {
  const playerId = c.req.param("playerId")
  const tournamentId = c.req.query("tournament_id")

  const client = await getClient()
  try {
    const row = await queries.queryClutchPerformance(client, playerId, tournamentId)

    const clutchSituations = parseInt(row.clutch_situations)
    const clutchesWon = parseInt(row.clutches_won)
    const clutchRate = clutchSituations > 0 ? clutchesWon / clutchSituations : 0

    const data: ClutchData = {
      clutches_won: clutchesWon,
      clutch_situations: clutchSituations,
      clutch_rate: clutchRate,
    }

    const confidence = calculateConfidence(clutchSituations, "clutch situations")

    let insight = ""
    let recommendation: string | null = null

    if (clutchRate > 0.4) {
      insight = "Exceptional clutch player with high win rate."
      recommendation = null
    } else if (clutchRate > 0.25) {
      insight = "Above average clutch performance."
      recommendation = null
    } else if (clutchRate > 0.15) {
      insight = "Average clutch performance."
      recommendation = "Practice 1vX scenarios in deathmatch or custom games."
    } else {
      insight = "Struggles in clutch situations."
      recommendation = "Focus on positioning, utility usage, and staying calm under pressure."
    }

    const response: InsightResponse<ClutchData> = {
      player_id: playerId,
      metric: "clutch_performance",
      data,
      insight,
      recommendation,
      confidence,
    }

    return jsonResponse(response)
  } catch (error) {
    return errorResponse(`Failed to query clutch performance: ${error.message}`, 500)
  } finally {
    await client.end()
  }
})

/**
 * PLAY-05: Agent Performance Comparison
 * GET /lumina-player-insights/agent-performance/:playerId
 */
app.get("/lumina-player-insights/agent-performance/:playerId", async (c) => {
  const playerId = c.req.param("playerId")
  const tournamentId = c.req.query("tournament_id")

  const client = await getClient()
  try {
    const rows = await queries.queryAgentPerformance(client, playerId, tournamentId)

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

    if (agents.length === 0) {
      insight = "No agent data available."
      recommendation = null
    } else if (agents.length === 1) {
      insight = `One-trick on ${agents[0].agent} with ${agents[0].win_rate.toFixed(1)}% win rate.`
      recommendation = agents[0].win_rate < 0.45 ? "Consider expanding agent pool or improving mechanics." : null
    } else {
      const bestAgent = agents.reduce((a, b) => a.win_rate > b.win_rate ? a : b)
      insight = `Best performance on ${bestAgent.agent} with ${bestAgent.win_rate.toFixed(1)}% win rate.`
      recommendation = `Consider prioritizing ${bestAgent.agent} in competitive matches.`
    }

    const response: InsightResponse<AgentData> = {
      player_id: playerId,
      metric: "agent_performance",
      data,
      insight,
      recommendation,
      confidence,
    }

    return jsonResponse(response)
  } catch (error) {
    return errorResponse(`Failed to query agent performance: ${error.message}`, 500)
  } finally {
    await client.end()
  }
})

/**
 * PLAY-06: Multi-Kill Round Tracking
 * GET /lumina-player-insights/multi-kill/:playerId
 */
app.get("/lumina-player-insights/multi-kill/:playerId", async (c) => {
  const playerId = c.req.param("playerId")
  const tournamentId = c.req.query("tournament_id")

  const client = await getClient()
  try {
    const row = await queries.queryMultiKillRounds(client, playerId, tournamentId)

    const totalRounds = parseInt(row.total_rounds)
    const totalKills = parseInt(row.total_kills)
    const twoPlusKills = parseInt(row.two_plus_kills)
    const threePlusKills = parseInt(row.three_plus_kills)
    const fourPlusKills = parseInt(row.four_plus_kills)
    const aces = parseInt(row.aces)
    const killsPerRound = totalRounds > 0 ? totalKills / totalRounds : 0

    const data: MultiKillData = {
      two_plus_kills: twoPlusKills,
      three_plus_kills: threePlusKills,
      four_plus_kills: fourPlusKills,
      aces,
      total_rounds: totalRounds,
      kills_per_round: killsPerRound,
    }

    const confidence = calculateConfidence(totalRounds, "rounds")

    let insight = ""
    let recommendation: string | null = null

    const multiKillRate = totalRounds > 0 ? twoPlusKills / totalRounds : 0

    if (aces > 0) {
      insight = `Delivered ${aces} ace${aces > 1 ? 's' : ''} with ${multiKillRate.toFixed(1)}% multi-kill rate.`
      recommendation = null
    } else if (multiKillRate > 0.4) {
      insight = "High impact player with frequent multi-kills."
      recommendation = null
    } else if (multiKillRate > 0.25) {
      insight = "Solid multi-kill frequency."
      recommendation = null
    } else {
      insight = "Low multi-kill frequency."
      recommendation = "Focus on positioning to secure multiple kills per round."
    }

    const response: InsightResponse<MultiKillData> = {
      player_id: playerId,
      metric: "multi_kill",
      data,
      insight,
      recommendation,
      confidence,
    }

    return jsonResponse(response)
  } catch (error) {
    return errorResponse(`Failed to query multi-kill rounds: ${error.message}`, 500)
  } finally {
    await client.end()
  }
})

/**
 * PLAY-07: Eco Round Performance by Phase
 * GET /lumina-player-insights/eco-round/:playerId
 */
app.get("/lumina-player-insights/eco-round/:playerId", async (c) => {
  const playerId = c.req.param("playerId")
  const tournamentId = c.req.query("tournament_id")

  const client = await getClient()
  try {
    const rows = await queries.queryEcoRoundPerformance(client, playerId, tournamentId)

    const phases: Record<string, PhaseStats> = {}
    let totalRounds = 0

    rows.forEach(row => {
      const rounds = parseInt(row.rounds)
      const totalKills = parseInt(row.total_kills)
      const totalDeaths = parseInt(row.total_deaths)
      const roundsWon = parseInt(row.rounds_won)

      totalRounds += rounds

      const kdRatio = totalDeaths > 0 ? totalKills / totalDeaths : totalKills
      const winRate = rounds > 0 ? roundsWon / rounds : 0

      phases[row.phase] = {
        rounds,
        kd_ratio: kdRatio,
        win_rate: winRate,
      }
    })

    const data: EcoRoundData = {
      phases,
      total_rounds: totalRounds,
    }

    const confidence = calculateConfidence(totalRounds, "rounds")

    let insight = ""
    let recommendation: string | null = null

    const phaseEntries = Object.entries(phases)
    if (phaseEntries.length === 0) {
      insight = "No phase data available."
      recommendation = null
    } else {
      const bestPhase = phaseEntries.reduce((a, b) => a[1].win_rate > b[1].win_rate ? a : b)
      const worstPhase = phaseEntries.reduce((a, b) => a[1].win_rate < b[1].win_rate ? a : b)

      insight = `Best in ${bestPhase[0]} (${(bestPhase[1].win_rate * 100).toFixed(1)}% WR), struggles in ${worstPhase[0]} (${(worstPhase[1].win_rate * 100).toFixed(1)}% WR).`

      if (worstPhase[1].win_rate < 0.4) {
        recommendation = `Focus on improving ${worstPhase[0]} round strategy and economy management.`
      } else {
        recommendation = null
      }
    }

    const response: InsightResponse<EcoRoundData> = {
      player_id: playerId,
      metric: "eco_round_performance",
      data,
      insight,
      recommendation,
      confidence,
    }

    return jsonResponse(response)
  } catch (error) {
    return errorResponse(`Failed to query eco round performance: ${error.message}`, 500)
  } finally {
    await client.end()
  }
})

Deno.serve(app.fetch)
