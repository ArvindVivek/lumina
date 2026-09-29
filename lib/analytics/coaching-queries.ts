import { getDb } from '@/lib/data'
import { mapLabel } from '@/lib/data/names'
import { attackerOf, playerName, replayRound, seriesOfGame, sideOf, teamName, type Db } from '@/lib/data/db'
import type {
  SeriesSummary,
  MapMetrics,
  PlayerOpeningDuels,
  RoundForReview,
  RoundContext,
  ScenarioMatch,
  VODPriority,
  NotableEvent,
} from './coaching-types'

/*
 * Coaching-report queries, computed from the bundled fixture. Each `*From` function is pure over
 * the db (tests pass synthetic data); the async wrappers keep the old call sites unchanged.
 */

function seriesRounds(db: Db, seriesId: string) {
  return (db.gamesBySeries.get(seriesId) ?? []).flatMap((game) =>
    (db.roundsByGame.get(game.id) ?? []).map((round) => ({ game, round })),
  )
}

export function seriesSummaryFrom(db: Db, seriesId: string, teamId: string): SeriesSummary | null {
  const s = db.seriesById.get(seriesId)
  if (!s || (s.team_a_id !== teamId && s.team_b_id !== teamId)) return null
  const isTeamA = s.team_a_id === teamId
  const opponentId = isTeamA ? s.team_b_id : s.team_a_id
  const games = db.gamesBySeries.get(seriesId) ?? []
  const wins = games.filter((g) => g.winner_id === teamId).length
  const losses = games.filter((g) => g.winner_id === opponentId).length
  return {
    series_id: seriesId,
    team_id: teamId,
    team_name: teamName(db, teamId),
    opponent_id: opponentId,
    opponent_name: teamName(db, opponentId),
    result: s.winner_id === teamId ? 'win' : 'loss',
    score: `${wins}-${losses}`,
    total_rounds: seriesRounds(db, seriesId).length,
    total_maps: games.length,
    maps: games.map((g) => ({
      game_id: g.id,
      map_name: g.map_name,
      team_score: isTeamA ? g.team_a_score : g.team_b_score,
      opponent_score: isTeamA ? g.team_b_score : g.team_a_score,
      result: g.winner_id === teamId ? ('win' as const) : ('loss' as const),
    })),
    key_strength: '',
    key_weakness: '',
  }
}

/** Per-map first-blood, trade and post-plant numbers for one team in one series. */
export function mapMetricsFrom(db: Db, seriesId: string, teamId: string): MapMetrics[] {
  const s = db.seriesById.get(seriesId)
  if (!s) return []
  const isTeamA = s.team_a_id === teamId
  return (db.gamesBySeries.get(seriesId) ?? []).map((g) => {
    const rounds = db.roundsByGame.get(g.id) ?? []
    let fbRounds = 0
    let fbOurs = 0
    let fbOursWon = 0
    let deaths = 0
    let traded = 0
    let planted = 0
    let plantedWon = 0
    for (const r of rounds) {
      const stats = db.prsByRound.get(r.id) ?? []
      const fb = stats.find((p) => p.first_kill)
      if (fb) {
        fbRounds++
        if (fb.team_id === teamId) {
          fbOurs++
          if (r.winning_team_id === teamId) fbOursWon++
        }
      }
      for (const p of stats) {
        if (p.team_id !== teamId || p.deaths === 0) continue
        deaths++
        if (p.traded) traded++
      }
      if (r.spike_planted) {
        planted++
        if (r.winning_team_id === teamId) plantedWon++
      }
    }
    const rate = (a: number, b: number) => (b > 0 ? a / b : 0)
    const teamScore = isTeamA ? g.team_a_score : g.team_b_score
    const oppScore = isTeamA ? g.team_b_score : g.team_a_score
    return {
      game_id: g.id,
      map_name: g.map_name,
      score: `${teamScore}-${oppScore}`,
      fb_win_rate: rate(fbOurs, fbRounds),
      fb_conversion_rate: rate(fbOursWon, fbOurs),
      trade_rate: rate(traded, deaths),
      untraded_deaths: deaths - traded,
      post_plant_win_rate: rate(plantedWon, planted),
    }
  })
}

/** Each player's opening duels in one series, best net first. */
export function playerOpeningDuelsFrom(db: Db, seriesId: string, teamId: string): PlayerOpeningDuels[] {
  const byPlayer = new Map<string, { fk: number; fd: number; rounds: number; fkWins: number; fdLosses: number }>()
  for (const { round } of seriesRounds(db, seriesId)) {
    for (const p of db.prsByRound.get(round.id) ?? []) {
      if (p.team_id !== teamId) continue
      const acc = byPlayer.get(p.player_id) ?? { fk: 0, fd: 0, rounds: 0, fkWins: 0, fdLosses: 0 }
      acc.rounds++
      if (p.first_kill) {
        acc.fk++
        if (round.winning_team_id === teamId) acc.fkWins++
      }
      if (p.first_death) {
        acc.fd++
        if (round.winning_team_id !== teamId) acc.fdLosses++
      }
      byPlayer.set(p.player_id, acc)
    }
  }
  return [...byPlayer.entries()]
    .map(([id, a]) => ({
      player_id: id,
      player_name: playerName(db, id),
      first_kills: a.fk,
      first_deaths: a.fd,
      net: a.fk - a.fd,
      fk_conversion_rate: a.fk > 0 ? a.fkWins / a.fk : 0,
      fd_loss_rate: a.fd > 0 ? a.fdLosses / a.fd : 0,
      total_rounds: a.rounds,
    }))
    .sort((x, y) => y.net - x.net || y.first_kills - x.first_kills)
}

/** Every round of the series from one team's view, with a review priority. */
export function roundsForReviewFrom(db: Db, seriesId: string, teamId: string): RoundForReview[] {
  const s = db.seriesById.get(seriesId)
  if (!s) return []
  const isTeamA = s.team_a_id === teamId
  const out: RoundForReview[] = []
  for (const game of db.gamesBySeries.get(seriesId) ?? []) {
    let ours = 0
    let theirs = 0
    for (const round of db.roundsByGame.get(game.id) ?? []) {
      const stats = db.prsByRound.get(round.id) ?? []
      const won = round.winning_team_id === teamId
      const fb = stats.find((p) => p.first_kill)
      const fbKill = (db.killsByRound.get(round.id) ?? []).find((k) => k.is_first_kill)
      const untraded = stats.filter((p) => p.team_id === teamId && p.deaths > 0 && !p.traded).length
      const notableEvents: NotableEvent[] = []
      for (const p of stats) {
        if (p.team_id !== teamId) continue
        const name = playerName(db, p.player_id)
        if (p.kills >= 5) notableEvents.push({ type: 'ace', player_id: p.player_id, player_name: name, detail: `${name} got an ACE` })
        else if (p.kills >= 3) notableEvents.push({ type: 'multi_kill', player_id: p.player_id, player_name: name, detail: `${name} got ${p.kills}K` })
        if (p.clutch_situation) {
          notableEvents.push({
            type: p.clutch_won ? 'clutch_won' : 'clutch_lost',
            player_id: p.player_id,
            player_name: name,
            detail: p.clutch_won ? `${name} won clutch` : `${name} lost clutch`,
          })
        }
      }
      const { priority, reason } = calculateVODPriority(
        won,
        untraded,
        fb?.team_id === teamId,
        !!fb,
        notableEvents,
        round.spike_planted,
        round.winning_condition,
      )
      out.push({
        round_id: round.id,
        game_id: game.id,
        map_name: game.map_name,
        round_number: round.round_number,
        side: sideOf(round, isTeamA) ?? (round.round_number <= 12 === isTeamA ? 'attack' : 'defense'),
        result: won ? 'win' : 'loss',
        score_before: `${ours}-${theirs}`,
        score_after: won ? `${ours + 1}-${theirs}` : `${ours}-${theirs + 1}`,
        first_blood: fb
          ? { player_id: fb.player_id, player_name: playerName(db, fb.player_id), team_id: fb.team_id, time_ms: fbKill?.game_time_ms ?? 0 }
          : null,
        untraded_deaths: untraded,
        spike_planted: round.spike_planted,
        winning_condition: round.winning_condition,
        notable_events: notableEvents,
        review_priority: priority,
        priority_reason: reason,
      })
      if (won) ours++
      else theirs++
    }
  }
  return out
}

/**
 * How much a round can teach, from one team's side. Tuned on the bundled matches: pro teams
 * lose four or five untraded players in most lost rounds, so "untraded deaths" alone can't be
 * critical (it flagged 40% of all rounds). Critical is kept for rounds that were winnable.
 */
export function calculateVODPriority(
  won: boolean,
  untradedDeaths: number,
  gotFirstBlood: boolean,
  hadFirstBlood: boolean,
  notableEvents: NotableEvent[],
  spikePlanted: boolean,
  winningCondition: string
): { priority: VODPriority; reason: string } {
  const clutchLost = notableEvents.some(e => e.type === 'clutch_lost')
  const clutchWon = notableEvents.some(e => e.type === 'clutch_won')
  const highlight = notableEvents.some(e => e.type === 'ace' || e.type === 'multi_kill')

  if (!won && gotFirstBlood) return { priority: 'critical', reason: 'Got the first kill but lost the round.' }
  if (!won && spikePlanted && winningCondition === 'spike_defuse') return { priority: 'critical', reason: 'Planted the spike, then it was defused.' }
  if (!won && clutchLost) return { priority: 'high', reason: 'Last player alive, and the clutch was lost.' }
  if (!won && untradedDeaths >= 5) return { priority: 'high', reason: 'Lost all five players and none of them were traded.' }
  if (!won && hadFirstBlood) return { priority: 'medium', reason: 'Lost the first fight and then the round.' }
  if (won && clutchWon) return { priority: 'medium', reason: 'Won a clutch: worth studying how.' }
  if (highlight) return { priority: 'low', reason: 'A multi-kill round for the highlight reel.' }
  if (won && untradedDeaths === 0) return { priority: 'low', reason: 'A clean win with no untraded deaths.' }
  return { priority: 'skip', reason: 'A standard round.' }
}

/** Everything that happened in one round: kills in order, each player's round, the spike. */
export function roundContextFrom(db: Db, roundId: string): RoundContext | null {
  const round = db.round.get(roundId)
  const game = round && db.game.get(round.game_id)
  const series = round && seriesOfGame(db, round.game_id)
  if (!round || !game || !series) return null
  const stats = db.prsByRound.get(roundId) ?? []
  const agentOf = (id: string | null) => stats.find((p) => p.player_id === id)?.agent ?? 'unknown'
  // Score before this round, from the rounds already played in the game.
  let a = 0
  let b = 0
  for (const r of db.roundsByGame.get(game.id) ?? []) {
    if (r.round_number >= round.round_number) break
    if (r.winning_team_id === series.team_a_id) a++
    else b++
  }
  const kills = db.killsByRound.get(roundId) ?? []
  const fbKill = kills.find((k) => k.is_first_kill)
  const fbStats = fbKill && stats.find((p) => p.player_id === fbKill.killer_id)
  return {
    round_id: round.id,
    game_id: game.id,
    map_name: game.map_name,
    round_number: round.round_number,
    team_a_id: series.team_a_id,
    team_b_id: series.team_b_id,
    team_a_score: a,
    team_b_score: b,
    winning_team_id: round.winning_team_id,
    winning_condition: round.winning_condition,
    spike_planted: round.spike_planted,
    spike_defused: round.spike_defused,
    duration_ms: round.duration_ms ?? 0,
    phase: round.phase,
    attacker_team_id: attackerOf(db, round),
    alive_at_plant: (() => {
      const plant = replayRound(db, roundId).atPlant
      return plant ? { attackers: plant.attackersAlive, defenders: plant.defendersAlive } : null
    })(),
    kill_timeline: kills.map((k) => ({
      game_time_ms: k.game_time_ms,
      killer_id: k.killer_id,
      killer_name: k.killer_id ? playerName(db, k.killer_id) : 'Self',
      killer_agent: agentOf(k.killer_id),
      victim_id: k.victim_id,
      victim_name: playerName(db, k.victim_id),
      victim_agent: agentOf(k.victim_id),
      weapon: k.weapon,
      is_trade: k.is_trade,
      is_first_kill: k.is_first_kill,
    })),
    player_states: stats.map((p) => ({
      player_id: p.player_id,
      player_name: playerName(db, p.player_id),
      team_id: p.team_id,
      agent: p.agent,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      first_kill: p.first_kill,
      first_death: p.first_death,
      traded: p.traded,
      clutch_situation: p.clutch_situation,
      clutch_won: p.clutch_won,
      loadout_value: p.loadout_value,
    })),
    spike_events: (db.spikesByRound.get(roundId) ?? []).map((e) => ({
      game_time_ms: e.game_time_ms,
      event_type: e.event_type === 'plant_complete' ? 'plant' : e.event_type === 'defuse_complete' ? 'defuse' : 'explode',
      player_id: e.player_id,
      player_name: e.player_id ? playerName(db, e.player_id) : '',
      site: null,
    })),
    first_blood:
      fbKill && fbKill.killer_id
        ? {
            player_id: fbKill.killer_id,
            player_name: playerName(db, fbKill.killer_id),
            team_id: fbStats?.team_id ?? '',
            time_ms: fbKill.game_time_ms,
            weapon: fbKill.weapon,
          }
        : null,
  }
}

/**
 * Rounds whose situation looked like the one asked about: attackers and defenders alive within one
 * of the request, scored like the old SQL (15% off per player of difference, 30% off when the
 * spike state differs). Situations are taken at the plant for planted rounds and at round end
 * otherwise, with sides from the logged attack/defense (not the round number).
 */
export function findSimilarScenariosFrom(
  db: Db,
  attackerAlive: number,
  defenderAlive: number,
  spikePlanted: boolean,
  mapName?: string,
  limit = 50,
): ScenarioMatch[] {
  const out: ScenarioMatch[] = []
  for (const round of db.rounds) {
    const game = db.game.get(round.game_id)
    const series = seriesOfGame(db, round.game_id)
    const attacker = attackerOf(db, round)
    if (!game || !series || !attacker) continue
    if (mapName && game.map_name !== mapName) continue
    const attackerIsA = series.team_a_id === attacker
    let atk = attackerIsA ? round.team_a_alive : round.team_b_alive
    let def = attackerIsA ? round.team_b_alive : round.team_a_alive
    if (round.spike_planted) {
      const plant = replayRound(db, round.id).atPlant
      if (plant) {
        atk = plant.attackersAlive
        def = plant.defendersAlive
      }
    }
    if (Math.abs(atk - attackerAlive) > 1 || Math.abs(def - defenderAlive) > 1) continue
    const score = 1 - Math.abs(atk - attackerAlive) * 0.15 - Math.abs(def - defenderAlive) * 0.15 - (round.spike_planted !== spikePlanted ? 0.3 : 0)
    out.push({
      round_id: round.id,
      game_id: game.id,
      map_name: game.map_name,
      round_number: round.round_number,
      attacker_alive: atk,
      defender_alive: def,
      spike_planted: round.spike_planted,
      attacker_won: round.winning_team_id === attacker,
      similarity_score: score,
    })
  }
  return out.sort((x, y) => y.similarity_score - x.similarity_score).slice(0, limit)
}

type AntiStratSignal = { signal: string; severity: 'critical' | 'moderate' | 'minor'; detail: string; implication: string; occurrences: number }

/** Players who died first 3+ times on the same map in this series: a pattern the opponent can time. */
export function detectAntiStratSignalsFrom(db: Db, seriesId: string, teamId: string): AntiStratSignal[] {
  const groups = new Map<string, { player: string; map: string; count: number; times: number[]; losses: number }>()
  for (const { game, round } of seriesRounds(db, seriesId)) {
    for (const p of db.prsByRound.get(round.id) ?? []) {
      if (p.team_id !== teamId || !p.first_death) continue
      const key = `${p.player_id}|${game.map_name}`
      const g = groups.get(key) ?? { player: p.player_id, map: game.map_name, count: 0, times: [], losses: 0 }
      g.count++
      const kill = (db.killsByRound.get(round.id) ?? []).find((k) => k.is_first_kill && k.victim_id === p.player_id)
      if (kill) g.times.push(kill.game_time_ms)
      if (round.winning_team_id !== teamId) g.losses++
      groups.set(key, g)
    }
  }
  return [...groups.values()]
    .filter((g) => g.count >= 3)
    .map((g) => ({ ...g, lossRate: g.losses / g.count }))
    .sort((a, b) => b.count - a.count || b.lossRate - a.lossRate)
    .slice(0, 3)
    .map((g) => {
      const name = playerName(db, g.player)
      const avg = g.times.length ? g.times.reduce((x, y) => x + y, 0) / g.times.length : 0
      const severity: AntiStratSignal['severity'] =
        g.lossRate > 0.7 && g.count >= 4 ? 'critical' : g.lossRate > 0.6 ? 'moderate' : 'minor'
      return {
        signal: `${name} keeps dying first on ${mapLabel(g.map)}`,
        severity,
        detail: `${name} died first ${g.count} times on ${mapLabel(g.map)}, on average ${(avg / 1000).toFixed(0)} seconds into the round`,
        implication: `The opponent may be timing ${name}'s position. Vary the approach or fake elsewhere.`,
        occurrences: g.count,
      }
    })
}

type ForcedMistake = { mistake: string; severity: 'critical' | 'high' | 'medium' | 'low'; detail: string; fix: string; rounds_impacted: number }

/** Maps where the team often lost 3+ players without a trade in one round. */
export function detectForcedMistakesFrom(db: Db, seriesId: string, teamId: string): ForcedMistake[] {
  const byMap = new Map<string, { rounds: number; losses: number }>()
  for (const { game, round } of seriesRounds(db, seriesId)) {
    const untraded = (db.prsByRound.get(round.id) ?? []).filter((p) => p.team_id === teamId && p.deaths > 0 && !p.traded).length
    if (untraded < 3) continue
    const m = byMap.get(game.map_name) ?? { rounds: 0, losses: 0 }
    m.rounds++
    if (round.winning_team_id !== teamId) m.losses++
    byMap.set(game.map_name, m)
  }
  return [...byMap.entries()]
    .sort((a, b) => b[1].losses - a[1].losses)
    .slice(0, 3)
    .map(([map, m]) => ({
      mistake: `Isolated deaths on ${mapLabel(map)}`,
      severity: m.losses >= 4 ? 'critical' : m.losses >= 3 ? 'high' : m.losses >= 2 ? 'medium' : 'low',
      detail: `Lost ${m.losses} rounds on ${mapLabel(map)} where 3 or more players died without a trade`,
      fix: 'Review positioning so a teammate can always trade. Avoid taking fights alone.',
      rounds_impacted: m.rounds,
    }))
}

export async function querySeriesSummary(seriesId: string, teamId: string) {
  return seriesSummaryFrom(getDb(), seriesId, teamId)
}
export async function queryMapMetrics(seriesId: string, teamId: string) {
  return mapMetricsFrom(getDb(), seriesId, teamId)
}
export async function queryPlayerOpeningDuels(seriesId: string, teamId: string) {
  return playerOpeningDuelsFrom(getDb(), seriesId, teamId)
}
export async function queryRoundsForReview(seriesId: string, teamId: string) {
  return roundsForReviewFrom(getDb(), seriesId, teamId)
}
export async function queryRoundContext(roundId: string) {
  return roundContextFrom(getDb(), roundId)
}
export async function findSimilarScenarios(
  attackerAlive: number,
  defenderAlive: number,
  spikePlanted: boolean,
  mapName?: string,
  limit: number = 50,
) {
  return findSimilarScenariosFrom(getDb(), attackerAlive, defenderAlive, spikePlanted, mapName, limit)
}
export async function detectAntiStratSignals(seriesId: string, teamId: string) {
  return detectAntiStratSignalsFrom(getDb(), seriesId, teamId)
}
export async function detectForcedMistakes(seriesId: string, teamId: string) {
  return detectForcedMistakesFrom(getDb(), seriesId, teamId)
}
