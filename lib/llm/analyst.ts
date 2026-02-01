import OpenAI from 'openai'
import {
  SYSTEM_PROMPT,
  MATCH_REVIEW_PROMPT,
  PLAYER_ANALYSIS_PROMPT,
  ROUND_ANALYSIS_PROMPT,
  HYPOTHETICAL_PROMPT,
  formatMapMetrics,
  formatOpeningDuels,
  formatKillTimeline,
  formatPlayerStates,
} from './prompts'
import type {
  SeriesSummary,
  MapMetrics,
  PlayerOpeningDuels,
  RoundContext,
  ScenarioMatch,
  ScenarioStats,
  AntiStratSignal,
  ForcedMistake,
} from '../analytics/coaching-types'

// OpenAI client - only created if API key exists
let openai: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }
    openai = new OpenAI({ apiKey })
  }
  return openai
}

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export interface LLMAnalysisResult {
  analysis: string
  model: string
  tokens_used: number
}

/**
 * Check if LLM is available
 */
export function isLLMAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY
}

/**
 * Generate match review analysis
 */
export async function generateMatchReview(
  summary: SeriesSummary,
  mapMetrics: MapMetrics[],
  openingDuels: PlayerOpeningDuels[],
  antiStratSignals: AntiStratSignal[],
  forcedMistakes: ForcedMistake[]
): Promise<LLMAnalysisResult> {
  const client = getOpenAIClient()

  const prompt = MATCH_REVIEW_PROMPT
    .replace('{summary}', JSON.stringify(summary, null, 2))
    .replace('{mapMetrics}', formatMapMetrics(mapMetrics))
    .replace('{openingDuels}', formatOpeningDuels(openingDuels))
    .replace('{antiStratSignals}', antiStratSignals.map(s => `- [${s.severity.toUpperCase()}] ${s.signal}: ${s.detail}`).join('\n') || 'None detected')
    .replace('{forcedMistakes}', forcedMistakes.map(m => `- [${m.severity.toUpperCase()}] ${m.mistake}: ${m.detail}`).join('\n') || 'None detected')

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 1500,
  })

  return {
    analysis: response.choices[0]?.message?.content || 'Analysis unavailable',
    model: MODEL,
    tokens_used: response.usage?.total_tokens || 0,
  }
}

/**
 * Generate player-focused analysis
 */
export async function generatePlayerAnalysis(
  playerName: string,
  agents: string[],
  openingDuels: PlayerOpeningDuels,
  clutchStats: { situations: number; wins: number },
  tradeRate: number,
  notableRounds: { round_number: number; map_name: string; detail: string }[]
): Promise<LLMAnalysisResult> {
  const client = getOpenAIClient()

  const clutchRate = clutchStats.situations > 0
    ? ((clutchStats.wins / clutchStats.situations) * 100).toFixed(1)
    : '0'

  const prompt = PLAYER_ANALYSIS_PROMPT
    .replace('{playerName}', playerName)
    .replace('{agents}', agents.join(', '))
    .replace('{firstKills}', String(openingDuels.first_kills))
    .replace('{firstDeaths}', String(openingDuels.first_deaths))
    .replace('{net}', `${openingDuels.net >= 0 ? '+' : ''}${openingDuels.net}`)
    .replace('{fkConversion}', (openingDuels.fk_conversion_rate * 100).toFixed(1))
    .replace('{fdLoss}', (openingDuels.fd_loss_rate * 100).toFixed(1))
    .replace('{totalRounds}', String(openingDuels.total_rounds))
    .replace('{clutchSituations}', String(clutchStats.situations))
    .replace('{clutchWins}', String(clutchStats.wins))
    .replace('{clutchRate}', clutchRate)
    .replace('{tradeRate}', (tradeRate * 100).toFixed(1))
    .replace('{notableRounds}', notableRounds.map(r => `- ${r.map_name} R${r.round_number}: ${r.detail}`).join('\n') || 'None')

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 1000,
  })

  return {
    analysis: response.choices[0]?.message?.content || 'Analysis unavailable',
    model: MODEL,
    tokens_used: response.usage?.total_tokens || 0,
  }
}

/**
 * Generate round analysis
 */
export async function generateRoundAnalysis(
  roundContext: RoundContext
): Promise<LLMAnalysisResult> {
  const client = getOpenAIClient()

  const won = roundContext.winning_team_id === roundContext.team_a_id
  const spikeStatus = roundContext.spike_planted
    ? (roundContext.spike_defused ? 'Planted, Defused' : 'Planted, Exploded/Eliminated')
    : 'Not Planted'

  const prompt = ROUND_ANALYSIS_PROMPT
    .replace('{mapName}', roundContext.map_name)
    .replace('{roundNumber}', String(roundContext.round_number))
    .replace('{scoreBefore}', `${roundContext.team_a_score}-${roundContext.team_b_score}`)
    .replace('{result}', won ? 'Won' : 'Lost')
    .replace('{winningCondition}', roundContext.winning_condition)
    .replace('{spikeStatus}', spikeStatus)
    .replace('{killTimeline}', formatKillTimeline(roundContext.kill_timeline))
    .replace('{playerStates}', formatPlayerStates(roundContext.player_states))

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 800,
  })

  return {
    analysis: response.choices[0]?.message?.content || 'Analysis unavailable',
    model: MODEL,
    tokens_used: response.usage?.total_tokens || 0,
  }
}

/**
 * Generate hypothetical scenario analysis
 */
export async function generateHypotheticalAnalysis(
  attackerAlive: number,
  defenderAlive: number,
  spikePlanted: boolean,
  mapName: string,
  scenarioStats: ScenarioStats,
  similarScenarios: ScenarioMatch[]
): Promise<LLMAnalysisResult> {
  const client = getOpenAIClient()

  const spikeStatus = spikePlanted ? 'Planted' : 'Not Planted'
  const winRate = (scenarioStats.attacker_win_rate * 100).toFixed(1)

  const scenarioSummary = similarScenarios.slice(0, 5).map(s =>
    `- ${s.map_name} R${s.round_number}: ${s.attacker_alive}v${s.defender_alive} ${s.spike_planted ? 'post-plant' : ''} → ${s.attacker_won ? 'Attackers won' : 'Defenders won'}`
  ).join('\n')

  const prompt = HYPOTHETICAL_PROMPT
    .replace('{attackerAlive}', String(attackerAlive))
    .replace('{defenderAlive}', String(defenderAlive))
    .replace('{spikeStatus}', spikeStatus)
    .replace('{mapName}', mapName)
    .replace('{winRate}', winRate)
    .replace('{sampleSize}', String(scenarioStats.total_matches))
    .replace('{similarScenarios}', scenarioSummary || 'No similar scenarios found')

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 600,
  })

  return {
    analysis: response.choices[0]?.message?.content || 'Analysis unavailable',
    model: MODEL,
    tokens_used: response.usage?.total_tokens || 0,
  }
}

/**
 * Answer a custom question about a series
 */
export async function answerQuestion(
  question: string,
  context: {
    summary?: SeriesSummary
    mapMetrics?: MapMetrics[]
    openingDuels?: PlayerOpeningDuels[]
    roundContext?: RoundContext
  }
): Promise<LLMAnalysisResult> {
  const client = getOpenAIClient()

  let contextStr = ''
  if (context.summary) {
    contextStr += `Series: ${context.summary.team_name} vs ${context.summary.opponent_name}\n`
    contextStr += `Result: ${context.summary.result} (${context.summary.score})\n\n`
  }
  if (context.mapMetrics) {
    contextStr += `Map Metrics:\n${formatMapMetrics(context.mapMetrics)}\n\n`
  }
  if (context.openingDuels) {
    contextStr += `Opening Duels:\n${formatOpeningDuels(context.openingDuels)}\n\n`
  }
  if (context.roundContext) {
    contextStr += `Round ${context.roundContext.round_number} on ${context.roundContext.map_name}:\n`
    contextStr += `Kill Timeline:\n${formatKillTimeline(context.roundContext.kill_timeline)}\n\n`
  }

  const prompt = `Based on the following VALORANT match data, answer this question:

${contextStr}

Question: ${question}`

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
    max_tokens: 800,
  })

  return {
    analysis: response.choices[0]?.message?.content || 'Analysis unavailable',
    model: MODEL,
    tokens_used: response.usage?.total_tokens || 0,
  }
}
