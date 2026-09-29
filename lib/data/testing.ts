import { buildDb, type Db } from "./db"
import type { KillEvent, PlayerRoundStats, Round, Tables } from "./fixture"

/*
 * A tiny, hand-checkable match for unit tests: Cloud9 (c1..c5) vs Sentinels (s1..s5), one series,
 * one map on Lotus, four rounds. Each round lists its kills; the per-player rows are derived the
 * same simple way the fixture builder does, so expected numbers can be worked out by hand.
 */

export const C9 = "t1"
export const SEN = "t2"
const c = (n: number) => `c${n}`
const s = (n: number) => `s${n}`

interface KillSpec {
  t: number
  killer: string | null
  victim: string
  trade?: boolean
}

interface RoundSpec {
  n: number
  winner: string
  cond: Round["winning_condition"]
  c9Side: "attack" | "defense"
  c9Loadout: number
  senLoadout: number
  kills: KillSpec[]
  plantAt?: number
  plantBy?: string
  defused?: boolean
  /** Players who traded someone (got_trade) or were traded (traded). */
  traded?: string[]
  clutch?: { player: string; won: boolean }
  ultReady?: string[]
  ultUsed?: string[]
}

const teamOf = (p: string) => (p.startsWith("c") ? C9 : SEN)

export const ROUNDS: RoundSpec[] = [
  {
    // Pistol. C9 attacks and wins 5v1 after trading the opener.
    n: 1, winner: C9, cond: "elimination", c9Side: "attack", c9Loadout: 3900, senLoadout: 3800,
    kills: [
      { t: 10000, killer: s(1), victim: c(1) },
      { t: 12000, killer: c(2), victim: s(1), trade: true },
      { t: 30000, killer: c(2), victim: s(2) },
      { t: 40000, killer: c(3), victim: s(3) },
      { t: 50000, killer: c(4), victim: s(4) },
      { t: 60000, killer: c(5), victim: s(5) },
    ],
    traded: [c(1)],
    clutch: { player: s(5), won: false },
    ultReady: [],
    ultUsed: [],
  },
  {
    // Bonus round. C9 plants 4v4, then loses every duel.
    n: 2, winner: SEN, cond: "elimination", c9Side: "attack", c9Loadout: 21000, senLoadout: 8000,
    kills: [
      { t: 5000, killer: c(1), victim: s(1) },
      { t: 8000, killer: s(2), victim: c(1), trade: true },
      { t: 25000, killer: s(2), victim: c(2) },
      { t: 30000, killer: s(3), victim: c(3) },
      { t: 35000, killer: s(4), victim: c(4) },
      { t: 40000, killer: s(5), victim: c(5) },
    ],
    plantAt: 20000, plantBy: c(3),
    traded: [s(1)],
    clutch: { player: c(5), won: false },
    ultReady: [c(1)],
    ultUsed: [c(1)],
  },
  {
    // Second pistol: sides swap. Sentinels plant, C9 defuses.
    n: 13, winner: C9, cond: "spike_defuse", c9Side: "defense", c9Loadout: 3900, senLoadout: 3900,
    kills: [
      { t: 15000, killer: s(1), victim: c(1) },
      { t: 45000, killer: c(2), victim: s(1) },
    ],
    plantAt: 30000, plantBy: s(2), defused: true,
    ultReady: [s(1)],
    ultUsed: [],
  },
  {
    // A full buy C9 wins without a plant.
    n: 14, winner: C9, cond: "elimination", c9Side: "defense", c9Loadout: 22000, senLoadout: 21000,
    kills: [
      { t: 20000, killer: c(3), victim: s(3) },
      { t: 22000, killer: c(4), victim: s(4) },
      { t: 24000, killer: c(4), victim: s(5) },
      { t: 26000, killer: c(4), victim: s(1) },
      { t: 28000, killer: c(3), victim: s(2) },
    ],
    clutch: { player: s(2), won: false },
    ultReady: [c(4)],
    ultUsed: [c(4)],
  },
]

export function makeTables(): Tables {
  const rounds: Round[] = []
  const stats: PlayerRoundStats[] = []
  const kills: KillEvent[] = []
  const spikes: Tables["spike_events"] = []
  for (const r of ROUNDS) {
    const id = `g1_${r.n}`
    const deadC9 = r.kills.filter((k) => teamOf(k.victim) === C9).length
    const deadSen = r.kills.filter((k) => teamOf(k.victim) === SEN).length
    rounds.push({
      id, game_id: "g1", round_number: r.n,
      phase: r.n === 1 || r.n === 13 ? "pistol" : (r.c9Loadout + r.senLoadout) / 2 < 10000 ? "eco" : (r.c9Loadout + r.senLoadout) / 2 < 20000 ? "force" : "full",
      winning_team_id: r.winner, winning_condition: r.cond,
      spike_planted: r.plantAt != null, spike_defused: !!r.defused,
      team_a_alive: 5 - deadC9, team_b_alive: 5 - deadSen,
      team_a_loadout_value: r.c9Loadout, team_b_loadout_value: r.senLoadout,
      duration_ms: (r.kills.at(-1)?.t ?? 60000) + 1000, team_a_side: r.c9Side,
    })
    r.kills.forEach((k, i) =>
      kills.push({
        round_id: id, game_time_ms: k.t, killer_id: k.killer, victim_id: k.victim, weapon: "vandal",
        is_first_kill: i === 0, is_trade: !!k.trade, is_self_kill: false,
        killer_pos_x: null, killer_pos_y: null, victim_pos_x: null, victim_pos_y: null, assist_count: 0,
      }),
    )
    if (r.plantAt != null) spikes.push({ round_id: id, game_time_ms: r.plantAt, event_type: "plant_complete", player_id: r.plantBy ?? null, pos_x: null, pos_y: null })
    if (r.defused) spikes.push({ round_id: id, game_time_ms: r.plantAt! + 20000, event_type: "defuse_complete", player_id: c(2), pos_x: null, pos_y: null })
    for (const p of [1, 2, 3, 4, 5].flatMap((n) => [c(n), s(n)])) {
      const loadout = teamOf(p) === C9 ? r.c9Loadout : r.senLoadout
      stats.push({
        round_id: id, player_id: p, team_id: teamOf(p), agent: p.endsWith("1") ? "jett" : "omen",
        kills: r.kills.filter((k) => k.killer === p).length,
        deaths: r.kills.filter((k) => k.victim === p).length,
        assists: 0,
        first_kill: r.kills[0]?.killer === p,
        first_death: r.kills[0]?.victim === p,
        traded: (r.traded ?? []).includes(p),
        got_trade: r.kills.some((k) => k.killer === p && k.trade),
        clutch_situation: r.clutch?.player === p,
        clutch_won: r.clutch?.player === p && r.clutch.won,
        loadout_value: loadout / 5, armor: 50,
        ult_ready: (r.ultReady ?? []).includes(p),
        ultimate_used: (r.ultUsed ?? []).includes(p),
      })
    }
  }
  return {
    tournaments: [{ id: "tour1", name: "VCT Americas - Stage 2 2025 (Playoffs: Playoffs)", start_date: "2025-08-21", end_date: "2025-08-21" }],
    teams: [{ id: C9, name: "Cloud9" }, { id: SEN, name: "Sentinels (1)" }],
    players: [1, 2, 3, 4, 5].flatMap((n) => [
      { id: c(n), name: `C9 Player ${n}`, team_id: C9 },
      { id: s(n), name: `SEN Player ${n}`, team_id: SEN },
    ]),
    series: [{ id: "series1", tournament_id: "tour1", start_time: "2025-08-21T18:00:00Z", format: "best-of-1", team_a_id: C9, team_b_id: SEN, winner_id: C9 }],
    games: [{ id: "g1", series_id: "series1", sequence_number: 1, map_name: "lotus", team_a_score: 3, team_b_score: 1, winner_id: C9, duration_ms: 400000 }],
    rounds,
    player_round_stats: stats,
    kill_events: kills,
    spike_events: spikes,
  }
}

export function makeDb(): Db {
  return buildDb(makeTables())
}
