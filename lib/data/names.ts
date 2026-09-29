/**
 * Display names for teams, maps and agents. Client-safe (no fixture import): badges and tables
 * use these in the browser too. Team logos aren't shown (they belong to the teams, not Riot's
 * fan-content policy), so every team gets a short text badge instead.
 */

/** GRID suffixes duplicate org entries with " (1)"; people know them without it. */
export function cleanTeamName(name: string): string {
  return name.replace(/\s*\(\d+\)\s*$/, "").trim()
}

const TEAM_CODES: Record<string, string> = {
  "Cloud9": "C9",
  "G2 Esports": "G2",
  "100 Thieves": "100T",
  "LOUD": "LOUD",
  "KRÜ Esports": "KRÜ",
  "Leviatán Esports": "LEV",
  "MIBR": "MIBR",
  "Sentinels": "SEN",
  "NRG": "NRG",
  "Evil Geniuses": "EG",
}

/** Short code for a team badge: the scene's usual tag, else the initials. */
export function teamCode(name: string): string {
  const clean = cleanTeamName(name)
  if (TEAM_CODES[clean]) return TEAM_CODES[clean]
  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase()
  return words.map((w) => w[0]).join("").slice(0, 4).toUpperCase()
}

/** "lotus" → "Lotus", "kay/o" → "KAY/O". */
export function mapLabel(map: string): string {
  return map.charAt(0).toUpperCase() + map.slice(1)
}

const AGENT_LABELS: Record<string, string> = { "kay/o": "KAY/O" }

export function agentLabel(agent: string): string {
  if (AGENT_LABELS[agent]) return AGENT_LABELS[agent]
  return agent.charAt(0).toUpperCase() + agent.slice(1)
}

export const WIN_CONDITION_LABELS: Record<string, string> = {
  elimination: "Team wiped",
  spike_defuse: "Spike defused",
  spike_explode: "Spike detonated",
  time: "Time ran out",
}

/** "Spike defused" etc.; unknown values fall back to a readable form. */
export function winConditionLabel(condition: string | null | undefined): string {
  if (!condition) return "Unknown"
  return WIN_CONDITION_LABELS[condition] ?? condition.replace(/_/g, " ")
}

export const PHASE_LABELS: Record<string, string> = {
  pistol: "Pistol",
  eco: "Eco",
  force: "Force buy",
  full: "Full buy",
  force_buy: "Force buy",
  full_buy: "Full buy",
}

/** Tournament names from GRID read "VCT Americas - Stage 2 2025 (Playoffs: Playoffs)". */
export function tournamentLabel(name: string): string {
  return name.replace(/\s*\(([^:)]+):\s*\1\)\s*$/, " $1").replace(/\s+-\s+/, " · ").trim()
}
