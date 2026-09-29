import type {
  AntiStratSignal,
  ForcedMistake,
  MapMetrics,
  PlayerOpeningDuels,
  RoundContext,
  ScenarioStats,
  SeriesSummary,
} from "@/lib/analytics/coaching-types"
import type { SaveRetakeEV } from "@/lib/analytics/scenario-types"
import { mapLabel, winConditionLabel } from "@/lib/data/names"
import type { CoachNote, CoachPoint } from "./coach-types"

/*
 * What the AI coach is told, and what readers get when the AI can't answer. Both come from the
 * same computed numbers: the facts are compact lines (a few hundred tokens), and each fallback is a
 * short note written by rules, so the page is useful with or without the model.
 */

const pct = (x: number) => `${Math.round(x * 100)}%`
const secs = (ms: number) => `${(ms / 1000).toFixed(0)}s`

export function mapMetricLines(metrics: MapMetrics[]): string[] {
  return metrics.map(
    (m) =>
      `${mapLabel(m.map_name)} ${m.score}: first blood ${pct(m.fb_win_rate)} of rounds, won ${pct(m.fb_conversion_rate)} after it, ` +
      `${pct(m.trade_rate)} of deaths traded (${m.untraded_deaths} untraded), won ${pct(m.post_plant_win_rate)} of planted rounds`,
  )
}

export function openingDuelLines(duels: PlayerOpeningDuels[]): string[] {
  return duels.map(
    (d) => `${d.player_name}: ${d.first_kills} first kills, ${d.first_deaths} first deaths (net ${d.net >= 0 ? "+" : ""}${d.net})`,
  )
}

export function matchReviewFacts(
  s: SeriesSummary,
  metrics: MapMetrics[],
  duels: PlayerOpeningDuels[],
  anti: AntiStratSignal[],
  mistakes: ForcedMistake[],
): string {
  return [
    `${s.team_name} vs ${s.opponent_name}: ${s.result === "win" ? "won" : "lost"} ${s.score} in maps, ${s.total_rounds} rounds.`,
    ...mapMetricLines(metrics),
    "Opening duels:",
    ...openingDuelLines(duels),
    ...anti.map((a) => `Signal: ${a.detail}`),
    ...mistakes.map((m) => `Mistake: ${m.detail}`),
  ].join("\n")
}

function byNet(duels: PlayerOpeningDuels[]) {
  return [...duels].sort((a, b) => b.net - a.net)
}

export function matchReviewFallback(
  s: SeriesSummary,
  metrics: MapMetrics[],
  duels: PlayerOpeningDuels[],
  anti: AntiStratSignal[],
  mistakes: ForcedMistake[],
): CoachNote {
  const points: CoachPoint[] = []
  const best = byNet(duels)[0]
  const worst = byNet(duels).at(-1)
  if (best && best.net > 0) {
    points.push({ kind: "strength", title: `${best.player_name} opened rounds`, detail: `${best.player_name} won ${best.first_kills} opening duels and lost ${best.first_deaths}.` })
  }
  const bestTrade = [...metrics].sort((a, b) => b.trade_rate - a.trade_rate)[0]
  if (bestTrade) {
    points.push({ kind: bestTrade.trade_rate >= 0.3 ? "strength" : "weakness", title: `Trading on ${mapLabel(bestTrade.map_name)}`, detail: `${pct(bestTrade.trade_rate)} of deaths on ${mapLabel(bestTrade.map_name)} were traded by a teammate.` })
  }
  if (worst && worst.net < 0) {
    points.push({ kind: "weakness", title: `${worst.player_name} died first often`, detail: `${worst.player_name} lost ${worst.first_deaths} opening duels and won ${worst.first_kills}.` })
  }
  if (anti[0]) points.push({ kind: "pattern", title: "Predictable first deaths", detail: anti[0].detail + "." })
  else if (mistakes[0]) points.push({ kind: "pattern", title: "Isolated deaths", detail: mistakes[0].detail + "." })
  return {
    headline: `${s.team_name} ${s.result === "win" ? "beat" : "lost to"} ${s.opponent_name} ${s.score} over ${s.total_rounds} rounds.`,
    points: points.slice(0, 4),
    next_step: worst && worst.net < 0
      ? `Give ${worst.player_name} a safer opening role and practise trading their first contact.`
      : "Keep the opening duels that worked and drill trades so no one dies alone.",
  }
}

export function playerFacts(
  name: string,
  agents: string[],
  d: PlayerOpeningDuels,
  clutch: { situations: number; wins: number },
  tradeRate: number,
): string {
  return [
    `${name}, agents: ${agents.join(", ") || "unknown"}, ${d.total_rounds} rounds.`,
    `Opening duels: ${d.first_kills} won, ${d.first_deaths} lost; round won after their first kill ${pct(d.fk_conversion_rate)}, lost after their first death ${pct(d.fd_loss_rate)}.`,
    `Clutches: ${clutch.wins} won of ${clutch.situations}. Deaths traded by teammates: ${pct(tradeRate)}.`,
  ].join("\n")
}

export function playerFallback(
  name: string,
  d: PlayerOpeningDuels,
  clutch: { situations: number; wins: number },
  tradeRate: number,
): CoachNote {
  const points: CoachPoint[] = [
    {
      kind: d.net >= 0 ? "strength" : "weakness",
      title: "Opening duels",
      detail: `${name} won ${d.first_kills} and lost ${d.first_deaths} opening duels (net ${d.net >= 0 ? "+" : ""}${d.net}).`,
    },
    {
      kind: tradeRate >= 0.3 ? "strength" : "weakness",
      title: "Deaths traded",
      detail: `Teammates traded ${pct(tradeRate)} of ${name}'s deaths.`,
    },
  ]
  if (clutch.situations > 0) {
    points.push({ kind: "pattern", title: "Clutches", detail: `${name} won ${clutch.wins} of ${clutch.situations} rounds as the last player alive.` })
  }
  return {
    headline: `${name} played ${d.total_rounds} rounds in this series.`,
    points,
    next_step: d.net < 0 ? "Take first contact with a teammate ready to trade." : "Keep taking the opening duels; they're paying off.",
  }
}

export function roundFacts(r: RoundContext): string {
  const kills = r.kill_timeline.map(
    (k) => `${secs(k.game_time_ms)} ${k.killer_name} (${k.killer_agent}) killed ${k.victim_name} (${k.victim_agent})${k.is_trade ? ", a trade" : ""}`,
  )
  return [
    `${mapLabel(r.map_name)} round ${r.round_number}, score before ${r.team_a_score}-${r.team_b_score}, ${r.phase} round.`,
    `Ended: ${winConditionLabel(r.winning_condition)}. Spike ${r.spike_planted ? (r.spike_defused ? "planted then defused" : "planted") : "not planted"}.`,
    ...kills,
  ].join("\n")
}

export function roundFallback(r: RoundContext): CoachNote {
  const first = r.kill_timeline[0]
  const trades = r.kill_timeline.filter((k) => k.is_trade).length
  const points: CoachPoint[] = []
  if (first) points.push({ kind: "pattern", title: "Opening kill", detail: `${first.killer_name} opened the round on ${first.victim_name} at ${secs(first.game_time_ms)}.` })
  points.push({ kind: trades > 0 ? "strength" : "weakness", title: "Trades", detail: `${trades} of ${r.kill_timeline.length} kills were trades.` })
  return {
    headline: `Round ${r.round_number} on ${mapLabel(r.map_name)} ended: ${winConditionLabel(r.winning_condition).toLowerCase()}.`,
    points,
    next_step: trades === 0 ? "Review spacing: nobody was close enough to trade." : "Review the first contact and how the trade was set up.",
  }
}

export function hypotheticalFacts(atk: number, def: number, planted: boolean, map: string, stats: ScenarioStats): string {
  return `${atk} attackers vs ${def} defenders on ${mapLabel(map)}, spike ${planted ? "planted" : "not planted"}. ` +
    `Attackers won ${stats.attacker_wins} of ${stats.total_matches} similar rounds (${pct(stats.attacker_win_rate)}).`
}

export function hypotheticalFallback(atk: number, def: number, planted: boolean, map: string, stats: ScenarioStats): CoachNote {
  const favoured = stats.attacker_win_rate >= 0.5 ? "attackers" : "defenders"
  return {
    headline: `${atk}v${def}${planted ? " after the plant" : ""} on ${mapLabel(map)} usually goes to the ${favoured}.`,
    points: [
      { kind: "pattern", title: "History", detail: `Attackers won ${stats.attacker_wins} of ${stats.total_matches} similar rounds (${pct(stats.attacker_win_rate)}).` },
    ],
    next_step: favoured === "attackers" ? "Defenders: play for picks together, not one at a time." : "Attackers: hold crossfires and make the defenders come to you.",
  }
}

export function roundDecisionFacts(r: RoundContext, ev: SaveRetakeEV, matches: number, def: number, atk: number, defenderWon: boolean): string {
  return `${mapLabel(r.map_name)} round ${r.round_number}: ${def} defenders retook against ${atk} attackers after the plant and ${defenderWon ? "won" : "lost"}. ` +
    `In ${matches} similar rounds, retakes won ${pct(ev.retake.win_probability)}. Model says ${ev.recommended_decision} (by ${ev.ev_difference} credits of value).`
}

export function roundDecisionFallback(r: RoundContext, ev: SaveRetakeEV, matches: number, def: number, atk: number, defenderWon: boolean): CoachNote {
  return {
    headline: `${def}v${atk} retake on ${mapLabel(r.map_name)}, round ${r.round_number}: ${defenderWon ? "it worked" : "it failed"}.`,
    points: [
      { kind: "pattern", title: "History", detail: `Retakes like this won ${pct(ev.retake.win_probability)} of ${matches} similar rounds.` },
      { kind: ev.recommended_decision === "retake" ? "strength" : "weakness", title: "Expected value", detail: `The numbers favour ${ev.recommended_decision === "retake" ? "retaking" : "saving guns"} by ${ev.ev_difference} credits of value.` },
    ],
    next_step: ev.recommended_decision === "save" ? "Agree a save call for this numbers disadvantage before the round." : "Retake together: trade into site rather than one at a time.",
  }
}
