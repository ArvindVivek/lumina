import { getDb } from '@/lib/data'
import { teamGames, teamRounds, type Db } from '@/lib/data/db'
import {
  PistolAnalysisRow,
  FirstBloodConversionRow,
  TradeDisciplineRow,
  OpeningDuelsByPlayerRow,
  EconomyManagementRow,
  TimingPatternRow,
  UltimateEconomyRow,
  RoundBreakdownRow,
} from './macro-types'
import { RoundDataForClassification } from './priority-classifier'

/*
 * Team (macro) queries MACRO-01 to MACRO-08, computed from the bundled fixture. Rows keep the
 * string shapes of the old Postgres functions so the routes that format them are unchanged.
 */

const pct = (part: number, whole: number, digits = 2) => (whole > 0 ? ((part / whole) * 100).toFixed(digits) : (0).toFixed(digits))
const ratio = (part: number, whole: number, digits = 3) => (whole > 0 ? (part / whole).toFixed(digits) : null)

/** Team loadout bands shared with the fixture's round phases: under 10k eco, under 20k force. */
export function economyDecision(loadout: number): 'eco' | 'force_buy' | 'full_buy' {
  if (loadout >= 20000) return 'full_buy'
  if (loadout >= 10000) return 'force_buy'
  return 'eco'
}

function teamPlayerRows(db: Db, teamId: string, tournamentId?: string) {
  const out = []
  for (const { round } of teamRounds(db, teamId, { tournamentId })) {
    for (const stats of db.prsByRound.get(round.id) ?? []) {
      if (stats.team_id === teamId) out.push({ stats, round })
    }
  }
  return out
}

/** MACRO-01: pistol rounds (1 and 13) and the bonus rounds after them (2 and 14). */
export function pistolAnalysisFrom(db: Db, teamId: string, tournamentId?: string, mapName?: string): PistolAnalysisRow {
  const rounds = teamRounds(db, teamId, { tournamentId, mapName }).map((r) => r.round)
  const pistols = rounds.filter((r) => r.round_number === 1 || r.round_number === 13)
  const bonus = rounds.filter((r) => r.round_number === 2 || r.round_number === 14)
  const pistolWins = pistols.filter((r) => r.winning_team_id === teamId).length
  return {
    pistol_rounds: String(pistols.length),
    pistol_wins: String(pistolWins),
    bonus_wins: String(bonus.filter((r) => r.winning_team_id === teamId).length),
    total_bonus_rounds: String(bonus.length),
    pistol_win_rate: pct(pistolWins, pistols.length),
  }
}

/** MACRO-02: how often the team wins rounds where it got the first kill. */
export function firstBloodConversionFrom(db: Db, teamId: string, tournamentId?: string): FirstBloodConversionRow {
  let firstBloods = 0
  let wins = 0
  for (const { round } of teamRounds(db, teamId, { tournamentId })) {
    const fb = (db.prsByRound.get(round.id) ?? []).find((p) => p.first_kill)
    if (fb?.team_id !== teamId) continue
    firstBloods++
    if (round.winning_team_id === teamId) wins++
  }
  return {
    first_bloods: String(firstBloods),
    first_blood_wins: String(wins),
    first_blood_conversion_rate: pct(wins, firstBloods),
  }
}

/** MACRO-03: share of the team's deaths that a teammate traded. */
export function tradeDisciplineFrom(db: Db, teamId: string, tournamentId?: string): TradeDisciplineRow {
  const deaths = teamPlayerRows(db, teamId, tournamentId).filter(({ stats }) => stats.deaths > 0)
  const traded = deaths.filter(({ stats }) => stats.traded).length
  const first = deaths.filter(({ stats }) => stats.first_death)
  const firstTraded = first.filter(({ stats }) => stats.traded).length
  return {
    total_deaths: String(deaths.length),
    traded_deaths: String(traded),
    first_deaths: String(first.length),
    first_deaths_traded: String(firstTraded),
    overall_trade_rate: pct(traded, deaths.length),
    first_death_trade_rate: pct(firstTraded, first.length),
  }
}

/** MACRO-04: first kills and first deaths per player, most first kills first. */
export function openingDuelsByPlayerFrom(db: Db, teamId: string, tournamentId?: string): OpeningDuelsByPlayerRow[] {
  const byPlayer = new Map<string, { fk: number; fd: number; rounds: number }>()
  for (const { stats } of teamPlayerRows(db, teamId, tournamentId)) {
    const p = byPlayer.get(stats.player_id) ?? { fk: 0, fd: 0, rounds: 0 }
    p.rounds++
    if (stats.first_kill) p.fk++
    if (stats.first_death) p.fd++
    byPlayer.set(stats.player_id, p)
  }
  return [...byPlayer.entries()]
    .sort((a, b) => b[1].fk - a[1].fk)
    .map(([player_id, p]) => ({
      player_id,
      first_kills: String(p.fk),
      first_deaths: String(p.fd),
      total_rounds: String(p.rounds),
    }))
}

/** MACRO-05: win rate by how much the team spent (eco, force buy, full buy). */
export function economyManagementFrom(db: Db, teamId: string, tournamentId?: string): EconomyManagementRow[] {
  const groups = new Map<string, { rounds: number; wins: number; loadout: number }>()
  for (const { round, isTeamA } of teamRounds(db, teamId, { tournamentId })) {
    const loadout = isTeamA ? round.team_a_loadout_value : round.team_b_loadout_value
    const key = economyDecision(loadout)
    const g = groups.get(key) ?? { rounds: 0, wins: 0, loadout: 0 }
    g.rounds++
    g.loadout += loadout
    if (round.winning_team_id === teamId) g.wins++
    groups.set(key, g)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([economy_decision, g]) => ({
      economy_decision,
      rounds: String(g.rounds),
      wins: String(g.wins),
      win_rate: ratio(g.wins, g.rounds) ?? '0',
      avg_loadout_value: (g.loadout / g.rounds).toFixed(0),
    }))
}

/** MACRO-06: average round length and how early the first kill lands. */
export function timingPatternsFrom(db: Db, teamId: string, tournamentId?: string): TimingPatternRow {
  const rounds = teamRounds(db, teamId, { tournamentId }).map((r) => r.round)
  const durations = rounds.map((r) => r.duration_ms).filter((d): d is number => d != null)
  const firstKills = rounds
    .map((r) => (db.killsByRound.get(r.id) ?? []).find((k) => k.is_first_kill)?.game_time_ms)
    .filter((t): t is number => t != null)
  const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(0) : '0')
  return {
    avg_round_duration_ms: avg(durations),
    avg_first_kill_time_ms: avg(firstKills),
    rounds_analyzed: String(rounds.length),
  }
}

/** MACRO-07: how often ultimates are used and how rounds go when one is charged. */
export function ultimateEconomyFrom(db: Db, teamId: string, tournamentId?: string): UltimateEconomyRow {
  const rows = teamPlayerRows(db, teamId, tournamentId)
  const used = rows.filter(({ stats }) => stats.ultimate_used).length
  const ready = rows.filter(({ stats }) => stats.ult_ready)
  const readyWins = ready.filter(({ round }) => round.winning_team_id === teamId).length
  return {
    total_rounds: String(rows.length),
    ultimates_used: String(used),
    usage_rate: ratio(used, rows.length) ?? '0',
    rounds_with_ult_available: String(ready.length),
    ult_availability_win_rate: ratio(readyWins, ready.length) ?? '0',
  }
}

/**
 * The team's games for round-level review: one game when `gameId` is given, else every game the
 * team played (optionally in one tournament). The old query took the first game in the whole
 * database when no game was chosen and judged "team A" from it, so other teams' rounds and flipped
 * loadouts leaked in; here each game uses its own series to decide the team's side.
 */
function reviewGames(db: Db, teamId: string, gameId?: string, tournamentId?: string) {
  return teamGames(db, teamId, { tournamentId }).filter(({ game }) => !gameId || game.id === gameId)
}

/** REVW-01: chronological rounds for game review. */
export function roundBreakdownFrom(db: Db, teamId: string, gameId?: string, tournamentId?: string): RoundBreakdownRow[] {
  const out: RoundBreakdownRow[] = []
  for (const { game, isTeamA } of reviewGames(db, teamId, gameId, tournamentId)) {
    for (const row of db.roundsByGame.get(game.id) ?? []) {
      const fb = (db.prsByRound.get(row.id) ?? []).find((p) => p.first_kill)
      out.push({
        round_id: row.id,
        round_number: String(row.round_number),
        game_id: row.game_id,
        map_name: game.map_name,
        winning_team_id: row.winning_team_id,
        spike_planted: String(row.spike_planted),
        spike_defused: String(row.spike_defused),
        team_a_alive: String(row.team_a_alive),
        team_b_alive: String(row.team_b_alive),
        team_loadout_value: String(isTeamA ? row.team_a_loadout_value : row.team_b_loadout_value),
        opponent_loadout_value: String(isTeamA ? row.team_b_loadout_value : row.team_a_loadout_value),
        duration_ms: String(row.duration_ms ?? 0),
        first_blood_team_id: fb?.team_id ?? null,
      })
    }
  }
  return out
}

/** MACRO-08 / REVW-02: rounds with what the critical-moment classifier needs. */
export function roundsForCriticalMomentsFrom(
  db: Db,
  teamId: string,
  gameId?: string,
  tournamentId?: string,
): RoundDataForClassification[] {
  const out: RoundDataForClassification[] = []
  for (const { game, isTeamA } of reviewGames(db, teamId, gameId, tournamentId)) {
    for (const row of db.roundsByGame.get(game.id) ?? []) {
      const teamLoadout = isTeamA ? row.team_a_loadout_value : row.team_b_loadout_value
      const firstDeath = (db.prsByRound.get(row.id) ?? []).find((p) => p.first_death && p.team_id === teamId)
      out.push({
        round_id: row.id,
        round_number: row.round_number,
        game_id: row.game_id,
        winning_team_id: row.winning_team_id,
        team_a_alive: row.team_a_alive,
        team_b_alive: row.team_b_alive,
        team_loadout_value: teamLoadout,
        spike_planted: row.spike_planted,
        first_death_traded: firstDeath ? firstDeath.traded : true,
        is_pistol_round: row.round_number === 1 || row.round_number === 13,
        // Pistol rounds are always under 10k; they're scored as pistols, not ecos.
        is_eco_round: teamLoadout < 10000 && row.round_number !== 1 && row.round_number !== 13,
      })
    }
  }
  return out
}

export async function queryPistolAnalysis(teamId: string, tournamentId?: string, mapName?: string) {
  return pistolAnalysisFrom(getDb(), teamId, tournamentId, mapName)
}
export async function queryFirstBloodConversion(teamId: string, tournamentId?: string) {
  return firstBloodConversionFrom(getDb(), teamId, tournamentId)
}
export async function queryTradeDiscipline(teamId: string, tournamentId?: string) {
  return tradeDisciplineFrom(getDb(), teamId, tournamentId)
}
export async function queryOpeningDuelsByPlayer(teamId: string, tournamentId?: string) {
  return openingDuelsByPlayerFrom(getDb(), teamId, tournamentId)
}
export async function queryEconomyManagement(teamId: string, tournamentId?: string) {
  return economyManagementFrom(getDb(), teamId, tournamentId)
}
export async function queryTimingPatterns(teamId: string, tournamentId?: string) {
  return timingPatternsFrom(getDb(), teamId, tournamentId)
}
export async function queryUltimateEconomy(teamId: string, tournamentId?: string) {
  return ultimateEconomyFrom(getDb(), teamId, tournamentId)
}
export async function queryRoundBreakdown(teamId: string, gameId?: string, tournamentId?: string) {
  return roundBreakdownFrom(getDb(), teamId, gameId, tournamentId)
}
export async function queryRoundsForCriticalMoments(teamId: string, gameId?: string, tournamentId?: string) {
  return roundsForCriticalMomentsFrom(getDb(), teamId, gameId, tournamentId)
}
