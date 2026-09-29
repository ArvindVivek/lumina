import { getDb } from '@/lib/data'
import { attackerOf, replayRound, seriesOfGame, type Db } from '@/lib/data/db'
import { economyDecision } from './macro-queries'
import {
  SaveRetakeQuery,
  SaveRetakeMatch,
  SaveRetakeEV,
  ForceEcoQuery,
  ForceEcoMatch,
  ClutchQuery,
  ClutchMatch,
} from './scenario-types'

// VALORANT economy constants
const ROUND_WIN_BONUS = 3000
const ECONOMY_SAVE_BONUS = 1900

/** Spike timer: once planted, defenders have 45 seconds to defuse. */
const SPIKE_TIMER_MS = 45000

/**
 * Every post-plant situation in the fixture: alive counts and the defenders' loadout at the moment
 * of the plant, and whether the defenders won. (The old scenario table stored end-of-round counts.)
 */
export function postPlantSituations(db: Db): SaveRetakeMatch[] {
  const out: SaveRetakeMatch[] = []
  for (const round of db.rounds) {
    if (!round.spike_planted) continue
    const replay = replayRound(db, round.id)
    const attacker = attackerOf(db, round)
    const series = seriesOfGame(db, round.game_id)
    const game = db.game.get(round.game_id)
    if (!replay.atPlant || !attacker || !series || !game) continue
    const defenderIsA = series.team_a_id !== attacker
    out.push({
      round_id: round.id,
      game_id: round.game_id,
      map_name: game.map_name,
      defender_economy: defenderIsA ? round.team_a_loadout_value : round.team_b_loadout_value,
      defender_alive: replay.atPlant.defendersAlive,
      attacker_alive: replay.atPlant.attackersAlive,
      time_remaining_ms: SPIKE_TIMER_MS,
      defender_won: round.winning_team_id !== attacker,
      similarity_score: 0,
    })
  }
  return out
}

/**
 * SCEN-01: the 50 most similar post-plant situations (weighted distance under 0.25, the same
 * weights as the old SQL: economy 35%, defenders alive 30%, attackers alive 25%, time 10%).
 */
export function matchSaveRetakeFrom(db: Db, params: SaveRetakeQuery): SaveRetakeMatch[] {
  const time = params.time_remaining_ms ?? SPIKE_TIMER_MS
  return postPlantSituations(db)
    .filter((s) => !params.map_name || s.map_name === params.map_name)
    .map((s) => {
      const distance =
        (Math.abs(s.defender_economy - params.defender_economy) / 25000) * 0.35 +
        (Math.abs(s.defender_alive - params.defender_alive) / 5) * 0.3 +
        (Math.abs(s.attacker_alive - params.attacker_alive) / 5) * 0.25 +
        (Math.abs(s.time_remaining_ms - time) / 45000) * 0.1
      return { ...s, similarity_score: 1 - distance, distance }
    })
    .filter((s) => s.distance < 0.25)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 50)
    .map(({ distance: _distance, ...s }) => s)
}

export async function matchSaveRetakeSituations(params: SaveRetakeQuery): Promise<SaveRetakeMatch[]> {
  return matchSaveRetakeFrom(getDb(), params)
}

/**
 * Calculate expected value for save vs retake decision.
 * SCEN-02: Save/Retake EV Analysis
 */
export function calculateSaveRetakeEV(
  matches: SaveRetakeMatch[],
  avgWeaponValue: number
): SaveRetakeEV {
  const totalMatches = matches.length
  const wins = matches.filter(m => m.defender_won).length
  const retakeWinProb = totalMatches > 0 ? wins / totalMatches : 0

  // Retake EV: (win_prob * win_bonus) - (loss_prob * weapon_value)
  const retakeEV = (retakeWinProb * ROUND_WIN_BONUS) - ((1 - retakeWinProb) * avgWeaponValue)

  // Save EV: weapon_value + save_bonus
  const saveEV = avgWeaponValue + ECONOMY_SAVE_BONUS

  const evDifference = Math.abs(retakeEV - saveEV)
  const recommendedDecision = retakeEV > saveEV ? 'retake' : 'save'

  return {
    retake: {
      expected_value: Math.round(retakeEV),
      win_probability: retakeWinProb,
    },
    save: {
      expected_value: Math.round(saveEV),
      guaranteed_retention: avgWeaponValue,
    },
    recommended_decision: recommendedDecision,
    ev_difference: Math.round(evDifference),
  }
}

/**
 * SCEN-03: rounds where a team's spend fell in the same band (eco, force, full buy) and the
 * opponent's loadout was within 5,000 of the one asked about, closest spend first. Each round is
 * counted from both teams' side (the old SQL only looked from team A's).
 */
export function matchForceEcoFrom(db: Db, params: ForceEcoQuery): ForceEcoMatch[] {
  const category = economyDecision(params.team_economy)
  const out: (ForceEcoMatch & { gap: number })[] = []
  for (const round of db.rounds) {
    const series = seriesOfGame(db, round.game_id)
    const game = db.game.get(round.game_id)
    if (!series || !game) continue
    if (params.map_name && game.map_name !== params.map_name) continue
    for (const isA of [true, false]) {
      const team = isA ? round.team_a_loadout_value : round.team_b_loadout_value
      const opp = isA ? round.team_b_loadout_value : round.team_a_loadout_value
      if (economyDecision(team) !== category || Math.abs(opp - params.opponent_economy) >= 5000) continue
      out.push({
        round_id: round.id,
        round_number: round.round_number,
        map_name: game.map_name,
        team_economy: team,
        opponent_economy: opp,
        economy_category: category,
        opponent_category: economyDecision(opp),
        team_won: round.winning_team_id === (isA ? series.team_a_id : series.team_b_id),
        gap: Math.abs(team - params.team_economy),
      })
    }
  }
  return out
    .sort((a, b) => a.gap - b.gap)
    .slice(0, 100)
    .map(({ gap: _gap, ...m }) => m)
}

export async function matchForceEcoSituations(params: ForceEcoQuery): Promise<ForceEcoMatch[]> {
  return matchForceEcoFrom(getDb(), params)
}

/**
 * SCEN-04: 1vX clutches against `opponent_count` enemies, counted when the clutch began (the old
 * SQL compared the enemies alive at round end). Spike sites aren't in GRID's feed, so `site` is
 * ignored.
 */
export function matchClutchFrom(db: Db, params: ClutchQuery): ClutchMatch[] {
  const out: ClutchMatch[] = []
  for (const round of db.rounds) {
    const game = db.game.get(round.game_id)
    if (!game || (params.map_name && game.map_name !== params.map_name)) continue
    const stats = db.prsByRound.get(round.id) ?? []
    if (!stats.some((p) => p.clutch_situation)) continue
    for (const c of replayRound(db, round.id).clutches) {
      if (c.opponentsAlive !== params.opponent_count) continue
      const player = stats.find((p) => p.player_id === c.playerId)
      out.push({
        round_id: round.id,
        player_id: c.playerId,
        agent: player?.agent ?? 'unknown',
        clutch_won: round.winning_team_id === c.teamId,
        round_number: round.round_number,
        map_name: game.map_name,
        site: null,
      })
    }
  }
  return out.sort((a, b) => b.round_number - a.round_number).slice(0, 100)
}

export async function matchClutchSituations(params: ClutchQuery): Promise<ClutchMatch[]> {
  return matchClutchFrom(getDb(), params)
}
