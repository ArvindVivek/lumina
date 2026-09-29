import { CriticalMoment, CriticalMomentFactors } from './macro-types'

/**
 * Round data required for critical moment classification
 */
export interface RoundDataForClassification {
  round_id: string
  round_number: number
  game_id: string
  winning_team_id: string
  team_a_alive: number
  team_b_alive: number
  team_loadout_value: number
  spike_planted: boolean
  first_death_traded: boolean
  is_pistol_round: boolean
  is_eco_round: boolean
}

/**
 * Classify a round as a critical moment based on scoring algorithm
 *
 * Scoring factors:
 * 1. Round impact (0-4): Based on alive count difference
 * 2. Pattern deviation (0-3): Unusual events (pistol loss, eco win, failed trade)
 * 3. Economic consequence (0-3): Impact on future rounds
 *
 * Classification thresholds:
 * - HIGH: score >= 8
 * - MEDIUM: score >= 5
 * - LOW: score >= 2
 * - null: score < 2 (not critical)
 */
export function classifyCriticalMoment(
  round: RoundDataForClassification,
  teamId: string
): CriticalMoment | null {
  // Calculate factors
  const factors: CriticalMomentFactors = {
    round_impact: 0,
    pattern_deviation: 0,
    economic_consequence: 0
  }

  // Round impact: how close the finish was (players left standing on each side). Pros usually
  // finish rounds with a 1-3 player gap, so only a one-player finish scores the top mark.
  const aliveCountDiff = Math.abs(round.team_a_alive - round.team_b_alive)
  if (aliveCountDiff <= 1) factors.round_impact = 3
  else if (aliveCountDiff === 2) factors.round_impact = 2
  else if (aliveCountDiff === 3) factors.round_impact = 1

  // Pattern deviation. An untraded first death happens in about three rounds out of four, so it
  // only nudges the score.
  if (round.is_pistol_round && round.winning_team_id !== teamId) {
    factors.pattern_deviation = 3  // Lost pistol
  } else if (round.is_eco_round && round.winning_team_id === teamId) {
    factors.pattern_deviation = 3  // Won on an eco
  } else if (!round.first_death_traded) {
    factors.pattern_deviation = 1  // First death not traded
  }

  // Economic consequence: pistols decide the next rounds' buys; the last round of a half is the
  // last chance before the switch.
  if ([1, 13].includes(round.round_number)) {
    factors.economic_consequence = 2
  } else if ([12, 24].includes(round.round_number)) {
    factors.economic_consequence = 2
  }

  const score = factors.round_impact + factors.pattern_deviation + factors.economic_consequence

  if (score < 2) return null

  const priority = score >= 8 ? 'HIGH' : score >= 6 ? 'MEDIUM' : 'LOW'

  return {
    round_id: round.round_id,
    round_number: round.round_number,
    game_id: round.game_id,
    moment_type: determineMomentType(round, teamId),
    description: generateDescription(round, factors, teamId),
    priority,
    score,
    factors
  }
}

/**
 * Determine the type of critical moment based on round characteristics
 */
function determineMomentType(round: RoundDataForClassification, teamId: string): string {
  if (round.is_pistol_round && round.winning_team_id !== teamId) return 'pistol_loss'
  if (round.is_eco_round && round.winning_team_id === teamId) return 'eco_round_win'
  if (!round.first_death_traded) return 'failed_trade'
  return 'close_round'
}

/**
 * Generate human-readable description of the critical moment
 */
function generateDescription(
  round: RoundDataForClassification,
  factors: CriticalMomentFactors,
  teamId: string
): string {
  const parts: string[] = []

  if (round.is_pistol_round && round.winning_team_id !== teamId) {
    parts.push('Lost the pistol round')
  }
  if (round.is_eco_round && round.winning_team_id === teamId) {
    parts.push('Won on an eco buy')
  }
  if (!round.first_death_traded) {
    parts.push("First death wasn't traded")
  }
  if (factors.round_impact >= 3 && round.team_a_alive + round.team_b_alive > 0) {
    parts.push('Finished with at most one player between the teams')
  }

  return parts.length ? `${parts.join('. ')}.` : `Round ${round.round_number}.`
}

/**
 * Batch classification for all rounds in a game
 * Returns critical moments sorted by priority (highest score first)
 */
export function classifyRoundsAsCriticalMoments(
  rounds: RoundDataForClassification[],
  teamId: string
): CriticalMoment[] {
  return rounds
    .map(round => classifyCriticalMoment(round, teamId))
    .filter((moment): moment is CriticalMoment => moment !== null)
    .sort((a, b) => b.score - a.score)  // Highest priority first
}
