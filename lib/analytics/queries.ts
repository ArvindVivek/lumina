import { getDb } from '@/lib/data'
import { playerRounds, type Db } from '@/lib/data/db'
import {
  FirstDeathRow,
  TradingRow,
  OpeningDuelsRow,
  ClutchRow,
  AgentRow,
  MultiKillRow,
  EcoRoundRow,
} from './types'

/*
 * Player insight queries (PLAY-01 to PLAY-07), computed from the bundled fixture. They return the
 * same string-valued rows the old Postgres functions did, so the routes that format them are
 * unchanged. The `*From` versions take the db so tests can pass synthetic data.
 */

const count = <T>(rows: T[], pred: (r: T) => boolean) => rows.filter(pred).length
const sum = <T>(rows: T[], val: (r: T) => number) => rows.reduce((n, r) => n + val(r), 0)

/** PLAY-01: rounds lost after dying first with no kill or assist. */
export function firstDeathImpactFrom(db: Db, playerId: string, tournamentId?: string): FirstDeathRow {
  const rows = playerRounds(db, playerId, { tournamentId }).filter(
    ({ stats }) => stats.first_death && stats.kills === 0 && stats.assists === 0,
  )
  return {
    losses: String(count(rows, ({ stats, round }) => round.winning_team_id !== stats.team_id)),
    total: String(rows.length),
  }
}

/** PLAY-02: how often the player's deaths were traded. */
export function tradingEfficiencyFrom(db: Db, playerId: string, tournamentId?: string): TradingRow {
  const rows = playerRounds(db, playerId, { tournamentId })
  return {
    traded: String(count(rows, ({ stats }) => stats.traded)),
    total_deaths: String(count(rows, ({ stats }) => stats.deaths > 0)),
  }
}

/** PLAY-03: first kills and first deaths. */
export function openingDuelsFrom(db: Db, playerId: string, tournamentId?: string): OpeningDuelsRow {
  const rows = playerRounds(db, playerId, { tournamentId })
  return {
    first_kills: String(count(rows, ({ stats }) => stats.first_kill)),
    first_deaths: String(count(rows, ({ stats }) => stats.first_death)),
    total_rounds: String(rows.length),
  }
}

/** PLAY-04: clutches (last one alive with enemies left) and how many were won. */
export function clutchPerformanceFrom(db: Db, playerId: string, tournamentId?: string): ClutchRow {
  const rows = playerRounds(db, playerId, { tournamentId }).filter(({ stats }) => stats.clutch_situation)
  return {
    clutches_won: String(count(rows, ({ stats }) => stats.clutch_won)),
    clutch_situations: String(rows.length),
  }
}

/** PLAY-05: per-agent results, most-played first. */
export function agentPerformanceFrom(db: Db, playerId: string, tournamentId?: string): AgentRow[] {
  const byAgent = new Map<string, ReturnType<typeof playerRounds>>()
  for (const row of playerRounds(db, playerId, { tournamentId })) {
    const list = byAgent.get(row.stats.agent) ?? []
    list.push(row)
    byAgent.set(row.stats.agent, list)
  }
  return [...byAgent.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([agent, rows]) => ({
      agent,
      rounds_played: String(rows.length),
      total_kills: String(sum(rows, ({ stats }) => stats.kills)),
      total_deaths: String(sum(rows, ({ stats }) => stats.deaths)),
      first_kills: String(count(rows, ({ stats }) => stats.first_kill)),
      first_deaths: String(count(rows, ({ stats }) => stats.first_death)),
      rounds_won: String(count(rows, ({ stats, round }) => round.winning_team_id === stats.team_id)),
    }))
}

/** PLAY-06: 2K, 3K, 4K and ace rounds. */
export function multiKillRoundsFrom(db: Db, playerId: string, tournamentId?: string): MultiKillRow {
  const rows = playerRounds(db, playerId, { tournamentId })
  return {
    two_plus_kills: String(count(rows, ({ stats }) => stats.kills >= 2)),
    three_plus_kills: String(count(rows, ({ stats }) => stats.kills >= 3)),
    four_plus_kills: String(count(rows, ({ stats }) => stats.kills >= 4)),
    aces: String(count(rows, ({ stats }) => stats.kills >= 5)),
    total_rounds: String(rows.length),
    total_kills: String(sum(rows, ({ stats }) => stats.kills)),
  }
}

/** PLAY-07: results by round type (pistol, eco, force, full buy), alphabetical like the SQL. */
export function ecoRoundPerformanceFrom(db: Db, playerId: string, tournamentId?: string): EcoRoundRow[] {
  const byPhase = new Map<string, ReturnType<typeof playerRounds>>()
  for (const row of playerRounds(db, playerId, { tournamentId })) {
    const list = byPhase.get(row.round.phase) ?? []
    list.push(row)
    byPhase.set(row.round.phase, list)
  }
  return [...byPhase.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([phase, rows]) => ({
      phase,
      rounds: String(rows.length),
      total_kills: String(sum(rows, ({ stats }) => stats.kills)),
      total_deaths: String(sum(rows, ({ stats }) => stats.deaths)),
      rounds_won: String(count(rows, ({ stats, round }) => round.winning_team_id === stats.team_id)),
    }))
}

export async function queryFirstDeathImpact(playerId: string, tournamentId?: string) {
  return firstDeathImpactFrom(getDb(), playerId, tournamentId)
}
export async function queryTradingEfficiency(playerId: string, tournamentId?: string) {
  return tradingEfficiencyFrom(getDb(), playerId, tournamentId)
}
export async function queryOpeningDuels(playerId: string, tournamentId?: string) {
  return openingDuelsFrom(getDb(), playerId, tournamentId)
}
export async function queryClutchPerformance(playerId: string, tournamentId?: string) {
  return clutchPerformanceFrom(getDb(), playerId, tournamentId)
}
export async function queryAgentPerformance(playerId: string, tournamentId?: string) {
  return agentPerformanceFrom(getDb(), playerId, tournamentId)
}
export async function queryMultiKillRounds(playerId: string, tournamentId?: string) {
  return multiKillRoundsFrom(getDb(), playerId, tournamentId)
}
export async function queryEcoRoundPerformance(playerId: string, tournamentId?: string) {
  return ecoRoundPerformanceFrom(getDb(), playerId, tournamentId)
}
