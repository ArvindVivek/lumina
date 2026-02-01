/**
 * LLM Prompts for VALORANT Analytics
 * Used with GPT-4o-mini for coaching insights
 */

export const SYSTEM_PROMPT = `You are an expert VALORANT esports analyst and coach. You analyze professional matches to provide actionable coaching insights.

Your expertise includes:
- Tactical analysis (site executes, rotations, post-plant plays)
- Economy management (save/force/full buy decisions)
- Trading patterns and positioning
- Agent compositions and synergies
- Anti-stratting and adaptation patterns
- Individual player performance and role fulfillment

When analyzing:
1. Be specific and cite concrete examples from the data
2. Focus on actionable improvements
3. Consider the context (map, score state, economy)
4. Identify patterns, not just individual plays
5. Be direct and avoid filler language

Format your responses in clear sections when appropriate.`

export const MATCH_REVIEW_PROMPT = `Analyze this VALORANT series and provide coaching insights.

Series Summary:
{summary}

Key Metrics by Map:
{mapMetrics}

Opening Duels by Player:
{openingDuels}

Anti-Strat Signals Detected:
{antiStratSignals}

Forced Mistakes Detected:
{forcedMistakes}

Provide:
1. **Series Overview** (2-3 sentences on the overall story)
2. **Key Strengths** (2-3 things the team did well)
3. **Critical Issues** (2-3 things to immediately address)
4. **Recommended Focus Areas** for next practice session
5. **Anti-Strat Defense** suggestions if opponent adapts similarly`

export const PLAYER_ANALYSIS_PROMPT = `Analyze this player's performance in the series.

Player: {playerName}
Agent(s) Played: {agents}

Stats:
- First Kills: {firstKills}, First Deaths: {firstDeaths} (Net: {net})
- FK Conversion Rate: {fkConversion}%
- FD Loss Rate: {fdLoss}%
- Total Rounds: {totalRounds}

Clutch Situations: {clutchSituations} attempts, {clutchWins} wins ({clutchRate}%)
Trading: {tradeRate}% of deaths traded

Notable Rounds:
{notableRounds}

Provide:
1. **Role Fulfillment** - How well did they play their role?
2. **Opening Duel Assessment** - Are they creating value or costing rounds?
3. **Clutch Ability** - Can they be trusted in late-round scenarios?
4. **Improvement Areas** - Specific things to work on
5. **Comparison** - How does this compare to expected pro-level performance?`

export const ROUND_ANALYSIS_PROMPT = `Analyze this specific round and explain what happened.

Round Context:
- Map: {mapName}, Round {roundNumber}
- Score Before: {scoreBefore}
- Result: {result} ({winningCondition})
- Spike: {spikeStatus}

Kill Timeline:
{killTimeline}

Player States at End:
{playerStates}

Questions to Answer:
1. What was the key turning point?
2. Were there positioning or trading mistakes?
3. What could have been done differently?
4. What can be learned from this round?`

export const HYPOTHETICAL_PROMPT = `Based on historical data from similar scenarios, analyze this situation.

Current Situation:
- {attackerAlive} attackers vs {defenderAlive} defenders
- Spike: {spikeStatus}
- Map: {mapName}

Historical Win Rate: {winRate}% (n={sampleSize})

Similar Scenarios:
{similarScenarios}

Questions:
1. What are the key factors that determine success in this scenario?
2. What should the team prioritize (time, positioning, trades)?
3. What's the recommended play call?`

export const ANTI_STRAT_ANALYSIS_PROMPT = `Analyze these detected anti-strat signals and provide defensive recommendations.

Detected Signals:
{signals}

For each signal:
1. What is the opponent likely preparing for?
2. How can the team vary their approach?
3. What misdirection could help?
4. What timing adjustments would help?`

export const ECONOMY_ANALYSIS_PROMPT = `Analyze the team's economy management in this series.

Economy Data:
{economyData}

Win Rates by Buy Type:
- Full Buy: {fullBuyWinRate}% ({fullBuyRounds} rounds)
- Force Buy: {forceBuyWinRate}% ({forceBuyRounds} rounds)
- Eco: {ecoWinRate}% ({ecoRounds} rounds)

Thrifty Rounds (wins on eco vs opponent full): {thriftyCount}

Analyze:
1. Is the team managing economy efficiently?
2. Are force buys justified based on results?
3. What eco round adjustments could help?
4. Economy-related recommendations`

/**
 * Format data for LLM prompts
 */
export function formatMapMetrics(metrics: { map_name: string; score: string; fb_win_rate: number; fb_conversion_rate: number; trade_rate: number; untraded_deaths: number }[]): string {
  return metrics.map(m =>
    `${m.map_name} (${m.score}): FB ${(m.fb_win_rate * 100).toFixed(0)}%, Convert ${(m.fb_conversion_rate * 100).toFixed(0)}%, Trade ${(m.trade_rate * 100).toFixed(0)}%, Untraded: ${m.untraded_deaths}`
  ).join('\n')
}

export function formatOpeningDuels(duels: { player_name: string; first_kills: number; first_deaths: number; net: number; fk_conversion_rate: number }[]): string {
  return duels.map(d =>
    `${d.player_name}: FK ${d.first_kills}, FD ${d.first_deaths} (${d.net >= 0 ? '+' : ''}${d.net}), Convert ${(d.fk_conversion_rate * 100).toFixed(0)}%`
  ).join('\n')
}

export function formatKillTimeline(kills: { game_time_ms: number; killer_name: string; victim_name: string; weapon: string; headshot: boolean; is_trade: boolean }[]): string {
  return kills.map(k =>
    `${(k.game_time_ms / 1000).toFixed(1)}s: ${k.killer_name} → ${k.victim_name} (${k.weapon}${k.headshot ? ', HS' : ''}${k.is_trade ? ', trade' : ''})`
  ).join('\n')
}

export function formatPlayerStates(states: { player_name: string; agent: string; kills: number; deaths: number; clutch_situation: boolean; clutch_won: boolean }[]): string {
  return states.map(s =>
    `${s.player_name} (${s.agent}): ${s.kills}K/${s.deaths}D${s.clutch_situation ? (s.clutch_won ? ' [clutch won]' : ' [clutch lost]') : ''}`
  ).join('\n')
}
