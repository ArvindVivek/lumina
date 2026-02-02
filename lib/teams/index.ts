/**
 * VCT Team Utilities
 *
 * Provides team info lookup from GRID IDs and logo paths
 */

import teamMapping from '@/public/valorant/teams/team-mapping.json'

export interface TeamInfo {
  code: string
  name: string
  abbr: string
  gridIds: string[]
}

type TeamMappingType = typeof teamMapping

// Type-safe team data
const teams = teamMapping.teams as Record<string, Omit<TeamInfo, 'code'>>
const gridIdToTeam = teamMapping.gridIdToTeam as Record<string, string>

/**
 * Get team info by team code (e.g., 'c9', 'sen')
 */
export function getTeamByCode(code: string): TeamInfo | null {
  const team = teams[code]
  if (!team) return null
  return { code, ...team }
}

/**
 * Get team info by GRID API ID (e.g., '97' for Cloud9)
 */
export function getTeamByGridId(gridId: string): TeamInfo | null {
  const code = gridIdToTeam[gridId]
  if (!code) return null
  return getTeamByCode(code)
}

// Teams with real PNG logos (from LoL Esports API - same orgs)
const TEAMS_WITH_PNG = new Set(['c9', 'loud', 'furia', 'lev', 'g2', 'nrg', '100t'])

/**
 * Get the logo path for a team
 * Returns PNG if available, otherwise SVG placeholder
 */
export function getTeamLogoPath(codeOrGridId: string): string {
  // Check if it's a GRID ID
  const code = gridIdToTeam[codeOrGridId] || codeOrGridId

  // Check if the team exists
  if (!teams[code]) {
    return '/valorant/teams/unknown.svg'
  }

  // Prefer PNG for teams that have real logos
  if (TEAMS_WITH_PNG.has(code)) {
    return `/valorant/teams/${code}.png`
  }

  return `/valorant/teams/${code}.svg`
}

/**
 * Get all teams
 */
export function getAllTeams(): TeamInfo[] {
  return Object.entries(teams).map(([code, team]) => ({
    code,
    ...team,
  }))
}

/**
 * Get team name from GRID ID
 */
export function getTeamNameByGridId(gridId: string): string {
  const team = getTeamByGridId(gridId)
  return team?.name || `Team ${gridId}`
}

/**
 * Get team abbreviation from GRID ID
 */
export function getTeamAbbrByGridId(gridId: string): string {
  const team = getTeamByGridId(gridId)
  return team?.abbr || gridId
}

export { teamMapping }
