import { playerRounds, teamName, type Db } from "@/lib/data/db"
import { listPlayers, listTeams, seriesRow } from "@/lib/data/queries"
import { mapLabel, tournamentLabel } from "@/lib/data/names"
import { mapMetricsFrom, playerOpeningDuelsFrom } from "@/lib/analytics/coaching-queries"
import { firstBloodConversionFrom, pistolAnalysisFrom, tradeDisciplineFrom } from "@/lib/analytics/macro-queries"
import { findPlayers, findTeams } from "./entity-resolver"

/*
 * What the chat assistant is told. Instead of the old tool loop (a 15-tool schema and a database
 * dump in every prompt), the server computes a few compact lines about the page being viewed and
 * anything the question names. The same numbers become the stat chips and the no-AI answer.
 */

export interface ChatPage {
  page?: string
  seriesId?: string
  teamId?: string
  playerId?: string
  tournamentId?: string
  gameId?: string
}

export interface ChatStat {
  label: string
  value: string
}

export interface ChatFacts {
  subject: string
  lines: string[]
  stats: ChatStat[]
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0)

function playerFacts(db: Db, playerId: string): ChatFacts | null {
  const p = db.player.get(playerId)
  if (!p) return null
  const rows = playerRounds(db, playerId)
  const kills = rows.reduce((n, r) => n + r.stats.kills, 0)
  const deaths = rows.reduce((n, r) => n + r.stats.deaths, 0)
  const fk = rows.filter((r) => r.stats.first_kill).length
  const fd = rows.filter((r) => r.stats.first_death).length
  const clutches = rows.filter((r) => r.stats.clutch_situation)
  const agents = new Map<string, number>()
  for (const r of rows) agents.set(r.stats.agent, (agents.get(r.stats.agent) ?? 0) + 1)
  const top = [...agents.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a, n]) => `${a} ${n}`)
  const team = p.team_id ? teamName(db, p.team_id) : "no team"
  return {
    subject: p.name,
    lines: [
      `${p.name} (${team}): ${rows.length} rounds, ${kills} kills, ${deaths} deaths (K/D ${(deaths ? kills / deaths : kills).toFixed(2)}), ` +
        `${fk} first kills vs ${fd} first deaths, clutches won ${clutches.filter((r) => r.stats.clutch_won).length} of ${clutches.length}. Agents (rounds): ${top.join(", ")}.`,
    ],
    stats: [
      { label: "K/D", value: (deaths ? kills / deaths : kills).toFixed(2) },
      { label: "Kills per round", value: ratio(kills, rows.length).toFixed(2) },
      { label: "Opening duels", value: `${fk}-${fd}` },
      { label: "Clutches won", value: `${clutches.filter((r) => r.stats.clutch_won).length}/${clutches.length}` },
    ],
  }
}

function teamFacts(db: Db, teamId: string): ChatFacts | null {
  const t = db.team.get(teamId)
  const row = listTeams(db).find((x) => x.id === teamId)
  if (!t || !row) return null
  const pistol = pistolAnalysisFrom(db, teamId)
  const fb = firstBloodConversionFrom(db, teamId)
  const trade = tradeDisciplineFrom(db, teamId)
  return {
    subject: t.name,
    lines: [
      `${t.name}: series ${row.series_won}-${row.series_played - row.series_won}, maps ${row.maps_won}-${row.maps_lost}, rounds won ${pct(row.round_win_rate)}. ` +
        `Pistols won ${pistol.pistol_wins} of ${pistol.pistol_rounds}. Won ${fb.first_blood_conversion_rate}% of rounds after the first kill. ` +
        `${trade.overall_trade_rate}% of deaths traded. Roster: ${row.roster.join(", ")}.`,
    ],
    stats: [
      { label: "Series", value: `${row.series_won}-${row.series_played - row.series_won}` },
      { label: "Maps", value: `${row.maps_won}-${row.maps_lost}` },
      { label: "Pistols won", value: `${pistol.pistol_wins}/${pistol.pistol_rounds}` },
      { label: "Deaths traded", value: `${Math.round(Number(trade.overall_trade_rate))}%` },
    ],
  }
}

function seriesFacts(db: Db, seriesId: string): ChatFacts | null {
  const s = db.seriesById.get(seriesId)
  if (!s) return null
  const row = seriesRow(db, s)
  const lines = [
    `${row.team_a_name} ${row.team_a_score}-${row.team_b_score} ${row.team_b_name} (${tournamentLabel(row.tournament_name)}, ${s.format ?? "series"}).`,
  ]
  for (const team of [s.team_a_id, s.team_b_id]) {
    const name = teamName(db, team)
    for (const m of mapMetricsFrom(db, seriesId, team)) {
      lines.push(`${name} on ${mapLabel(m.map_name)} ${m.score}: first kill in ${pct(m.fb_win_rate)} of rounds, ${pct(m.trade_rate)} of deaths traded, won ${pct(m.post_plant_win_rate)} of planted rounds.`)
    }
    const duels = playerOpeningDuelsFrom(db, seriesId, team)
    lines.push(`${name} opening duels: ${duels.map((d) => `${d.player_name} ${d.first_kills}-${d.first_deaths}`).join(", ")}.`)
  }
  return {
    subject: `${row.team_a_name} vs ${row.team_b_name}`,
    lines,
    stats: [
      { label: "Series", value: `${row.team_a_score}-${row.team_b_score}` },
      ...(db.gamesBySeries.get(seriesId) ?? []).slice(0, 3).map((g) => ({ label: mapLabel(g.map_name), value: `${g.team_a_score}-${g.team_b_score}` })),
    ],
  }
}

function gameFacts(db: Db, gameId: string): ChatFacts | null {
  const g = db.game.get(gameId)
  if (!g) return null
  const facts = seriesFacts(db, g.series_id)
  if (!facts) return null
  const s = db.seriesById.get(g.series_id)!
  const rounds = db.roundsByGame.get(gameId) ?? []
  const half = (from: number, to: number) => rounds.filter((r) => r.round_number >= from && r.round_number <= to && r.winning_team_id === s.team_a_id).length
  return {
    subject: `${mapLabel(g.map_name)}: ${facts.subject}`,
    lines: [
      `${mapLabel(g.map_name)} ${g.team_a_score}-${g.team_b_score} for ${teamName(db, s.team_a_id)}; they won ${half(1, 12)} of the first 12 rounds and ${half(13, 99)} after.`,
      ...facts.lines.filter((l) => l.includes(mapLabel(g.map_name)) || l.includes("opening duels")),
    ],
    stats: [{ label: mapLabel(g.map_name), value: `${g.team_a_score}-${g.team_b_score}` }, ...facts.stats.slice(0, 1)],
  }
}

function overviewFacts(db: Db): ChatFacts {
  const teams = listTeams(db).slice(0, 4)
  const players = listPlayers(db)
    .filter((p) => p.rounds >= 100)
    .sort((a, b) => b.kd - a.kd)
    .slice(0, 5)
  return {
    subject: "the sample data",
    lines: [
      `Sample: ${db.series.length} VCT Americas playoff series, ${db.games.length} maps, ${db.rounds.length} rounds across ${db.tournaments.map((t) => tournamentLabel(t.name)).join("; ")}.`,
      `Most series wins: ${teams.map((t) => `${t.name} ${t.series_won}-${t.series_played - t.series_won}`).join(", ")}.`,
      `Best K/D (100+ rounds): ${players.map((p) => `${p.name} ${p.kd.toFixed(2)}`).join(", ")}.`,
    ],
    stats: [
      { label: "Series", value: String(db.series.length) },
      { label: "Maps", value: String(db.games.length) },
      { label: "Rounds", value: String(db.rounds.length) },
    ],
  }
}

/** Compact facts for the page on screen plus up to two players or teams the question names. */
export function buildChatFacts(db: Db, page: ChatPage, question: string): ChatFacts {
  const primary =
    (page.gameId && gameFacts(db, page.gameId)) ||
    (page.seriesId && seriesFacts(db, page.seriesId)) ||
    (page.playerId && playerFacts(db, page.playerId)) ||
    (page.teamId && teamFacts(db, page.teamId)) ||
    overviewFacts(db)
  const extra: ChatFacts[] = []
  for (const p of findPlayers(db, question).slice(0, 2)) {
    if (p.id !== page.playerId) {
      const f = playerFacts(db, p.id)
      if (f) extra.push(f)
    }
  }
  for (const t of findTeams(db, question).slice(0, 2)) {
    if (t.id !== page.teamId) {
      const f = teamFacts(db, t.id)
      if (f) extra.push(f)
    }
  }
  const named = extra.slice(0, 2)
  return {
    subject: named[0]?.subject ?? primary.subject,
    lines: [...primary.lines, ...named.flatMap((f) => f.lines)].slice(0, 12),
    stats: (named[0] ?? primary).stats.slice(0, 4),
  }
}

/** The answer when the AI can't give one: the numbers, said plainly. */
export function chatFallbackAnswer(facts: ChatFacts): string {
  return `The AI coach can't answer right now, so here are the numbers for ${facts.subject}. ${facts.lines[0]}`
}

/** Strict schema: a short answer plus an optional follow-up question to offer as a button. */
export const CHAT_SCHEMA = {
  name: "chat_answer",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["answer", "follow_up"],
    properties: {
      answer: { type: "string", description: "At most 90 words. Cite the numbers you use." },
      follow_up: { type: ["string", "null"], description: "A short next question the user might ask, or null." },
    },
  },
}
