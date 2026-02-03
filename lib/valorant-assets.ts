/**
 * VALORANT Asset Management Utilities
 *
 * Provides functions for accessing local VALORANT assets including:
 * - Agent icons
 * - Map images
 * - Team logos
 *
 * Assets are stored in public/valorant/{agents,maps,teams}/
 */

// All VALORANT agents with normalized names
export const ALL_AGENTS = [
  'jett', 'reyna', 'raze', 'phoenix', 'yoru', 'neon', 'iso',
  'sova', 'breach', 'skye', 'fade', 'gekko', 'kayo', 'tejo',
  'omen', 'brimstone', 'viper', 'astra', 'harbor', 'clove',
  'sage', 'cypher', 'killjoy', 'chamber', 'deadlock', 'vyse'
] as const

// All competitive VALORANT maps
export const ALL_MAPS = [
  'ascent', 'bind', 'haven', 'split', 'icebox', 'breeze',
  'fracture', 'pearl', 'lotus', 'sunset', 'abyss'
] as const

// Agent roles for display
export const AGENT_ROLES: Record<string, string> = {
  jett: 'duelist',
  reyna: 'duelist',
  raze: 'duelist',
  phoenix: 'duelist',
  yoru: 'duelist',
  neon: 'duelist',
  iso: 'duelist',
  sova: 'initiator',
  breach: 'initiator',
  skye: 'initiator',
  fade: 'initiator',
  gekko: 'initiator',
  kayo: 'initiator',
  tejo: 'initiator',
  omen: 'controller',
  brimstone: 'controller',
  viper: 'controller',
  astra: 'controller',
  harbor: 'controller',
  clove: 'controller',
  sage: 'sentinel',
  cypher: 'sentinel',
  killjoy: 'sentinel',
  chamber: 'sentinel',
  deadlock: 'sentinel',
  vyse: 'sentinel',
}

// Role colors for badges
export const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  duelist: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  initiator: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  controller: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  sentinel: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
}

// Map gradient fallbacks when images not available
export const MAP_GRADIENTS: Record<string, string> = {
  ascent: 'from-green-900/40 to-green-700/40',
  bind: 'from-orange-900/40 to-orange-700/40',
  haven: 'from-blue-900/40 to-blue-700/40',
  split: 'from-red-900/40 to-red-700/40',
  icebox: 'from-cyan-900/40 to-cyan-700/40',
  breeze: 'from-teal-900/40 to-teal-700/40',
  fracture: 'from-amber-900/40 to-amber-700/40',
  pearl: 'from-indigo-900/40 to-indigo-700/40',
  lotus: 'from-pink-900/40 to-pink-700/40',
  sunset: 'from-yellow-900/40 to-yellow-700/40',
  abyss: 'from-slate-900/40 to-slate-700/40',
}

// VCT team mappings (team name -> logo file)
export const VCT_TEAMS: Record<string, { shortName: string; logo?: string; colors: { primary: string; secondary: string } }> = {
  // VCT Americas
  'Sentinels': { shortName: 'SEN', logo: 'sen.svg', colors: { primary: '#FF4655', secondary: '#1A1A2E' } },
  '100 Thieves': { shortName: '100T', logo: '100t.png', colors: { primary: '#FF0000', secondary: '#000000' } },
  'Cloud9': { shortName: 'C9', logo: 'c9.png', colors: { primary: '#00AEEF', secondary: '#FFFFFF' } },
  'NRG Esports': { shortName: 'NRG', logo: 'nrg.png', colors: { primary: '#E31837', secondary: '#000000' } },
  'Evil Geniuses': { shortName: 'EG', logo: 'eg.svg', colors: { primary: '#0082C8', secondary: '#1A1A1A' } },
  'FURIA': { shortName: 'FUR', logo: 'furia.png', colors: { primary: '#000000', secondary: '#FF6600' } },
  'LOUD': { shortName: 'LOUD', logo: 'loud.png', colors: { primary: '#00FF00', secondary: '#000000' } },
  'MIBR': { shortName: 'MIBR', logo: 'mibr.svg', colors: { primary: '#F7C600', secondary: '#000000' } },
  'KRÜ Esports': { shortName: 'KRÜ', logo: 'kru.svg', colors: { primary: '#6B2C91', secondary: '#FFFFFF' } },
  'Leviatán': { shortName: 'LEV', logo: 'lev.png', colors: { primary: '#00A3E0', secondary: '#FFFFFF' } },
  'G2 Esports': { shortName: 'G2', logo: 'g2.png', colors: { primary: '#FF0000', secondary: '#000000' } },
  '2Game Esports': { shortName: '2G', logo: '2g.svg', colors: { primary: '#FF4655', secondary: '#1A1A2E' } },

  // VCT EMEA
  'Fnatic': { shortName: 'FNC', logo: 'fnc.svg', colors: { primary: '#FF5900', secondary: '#1A1A1A' } },
  'Team Liquid': { shortName: 'TL', logo: 'tl.svg', colors: { primary: '#0E2C4D', secondary: '#1A1A1A' } },
  'Natus Vincere': { shortName: 'NAVI', logo: 'navi.svg', colors: { primary: '#F1C40F', secondary: '#000000' } },
  'FUT Esports': { shortName: 'FUT', logo: 'fut.svg', colors: { primary: '#FFD700', secondary: '#000000' } },
  'Team Heretics': { shortName: 'TH', logo: 'th.svg', colors: { primary: '#E2012D', secondary: '#FFCC00' } },
  'Team Vitality': { shortName: 'VIT', logo: 'vit.svg', colors: { primary: '#FFB900', secondary: '#000000' } },
  'Karmine Corp': { shortName: 'KC', logo: 'kc.svg', colors: { primary: '#0055A0', secondary: '#FFFFFF' } },
  'KOI': { shortName: 'KOI', logo: 'koi.svg', colors: { primary: '#9B59B6', secondary: '#FFFFFF' } },
  'BBL Esports': { shortName: 'BBL', logo: 'bbl.svg', colors: { primary: '#FFD700', secondary: '#000000' } },
  'Team BDS': { shortName: 'BDS', logo: 'bds.svg', colors: { primary: '#0A1628', secondary: '#7C3AED' } },
  'Giants Gaming': { shortName: 'GIA', logo: 'giants.svg', colors: { primary: '#FF6B35', secondary: '#1A1A1A' } },
  'GIANTX': { shortName: 'GX', logo: 'gx.svg', colors: { primary: '#FF6B35', secondary: '#1A1A1A' } },

  // VCT Pacific
  'Paper Rex': { shortName: 'PRX', logo: 'prx.svg', colors: { primary: '#00CED1', secondary: '#FF6347' } },
  'DRX': { shortName: 'DRX', logo: 'drx.svg', colors: { primary: '#0050A0', secondary: '#00A0DC' } },
  'T1': { shortName: 'T1', logo: 't1.svg', colors: { primary: '#E2012D', secondary: '#FFFFFF' } },
  'Gen.G Esports': { shortName: 'GEN', logo: 'geng.svg', colors: { primary: '#AA8A34', secondary: '#1A1A1A' } },
  'Rex Regum Qeon': { shortName: 'RRQ', logo: 'rrq.svg', colors: { primary: '#FF4655', secondary: '#000000' } },
  'Team Secret': { shortName: 'TS', logo: 'ts.svg', colors: { primary: '#00A3E0', secondary: '#FFFFFF' } },
  'TALON Esports': { shortName: 'TLN', logo: 'talon.svg', colors: { primary: '#E31837', secondary: '#000000' } },
  'ZETA DIVISION': { shortName: 'ZETA', logo: 'zeta.svg', colors: { primary: '#00AEEF', secondary: '#000000' } },
  'DetonatioN FocusMe': { shortName: 'DFM', logo: 'dfm.svg', colors: { primary: '#E31837', secondary: '#000000' } },
  'Bleed Esports': { shortName: 'BLD', logo: 'bleed.svg', colors: { primary: '#FF0000', secondary: '#000000' } },
  'Global Esports': { shortName: 'GE', logo: 'ge.svg', colors: { primary: '#FF6600', secondary: '#000000' } },

  // VCT China
  'EDward Gaming': { shortName: 'EDG', logo: 'edg.svg', colors: { primary: '#1A1A1A', secondary: '#E2012D' } },
  'FunPlus Phoenix': { shortName: 'FPX', logo: 'fpx.svg', colors: { primary: '#E2012D', secondary: '#C8A500' } },
  'Bilibili Gaming': { shortName: 'BLG', logo: 'blg.svg', colors: { primary: '#00A0E9', secondary: '#FF6699' } },
  'All Gamers': { shortName: 'AG', logo: 'ag.svg', colors: { primary: '#00CED1', secondary: '#000000' } },
  'JD Gaming': { shortName: 'JDG', logo: 'jdg.svg', colors: { primary: '#E2012D', secondary: '#1A1A1A' } },
  'Trace Esports': { shortName: 'TE', logo: 'te.svg', colors: { primary: '#FF4655', secondary: '#1A1A2E' } },
  'Wolves Esports': { shortName: 'WOL', logo: 'wolves.svg', colors: { primary: '#FFD700', secondary: '#000000' } },
  'Nova Esports': { shortName: 'NOVA', logo: 'nova.svg', colors: { primary: '#00A3E0', secondary: '#FFFFFF' } },
  'Titan Esports Club': { shortName: 'TEC', logo: 'titan.svg', colors: { primary: '#E31837', secondary: '#000000' } },
  'Dragon Ranger Gaming': { shortName: 'DRG', logo: 'drgx.svg', colors: { primary: '#FF0000', secondary: '#000000' } },
}

/**
 * Normalize an agent name for file lookup
 */
function normalizeAgentName(agentName: string): string {
  if (!agentName) return ''
  return agentName
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/\//g, '') // KAY/O -> kayo
}

/**
 * Normalize a map name for file lookup
 */
function normalizeMapName(mapName: string): string {
  if (!mapName) return ''
  return mapName.toLowerCase().trim()
}

/**
 * Get the path to an agent's icon
 */
export function getAgentIcon(agentName: string): string {
  const normalized = normalizeAgentName(agentName)
  if (!ALL_AGENTS.includes(normalized as typeof ALL_AGENTS[number])) {
    return ''
  }
  return `/valorant/agents/${normalized}.png`
}

/**
 * Check if an agent icon exists
 */
export function hasAgentIcon(agentName: string): boolean {
  const normalized = normalizeAgentName(agentName)
  return ALL_AGENTS.includes(normalized as typeof ALL_AGENTS[number])
}

/**
 * Get the path to a map's image
 */
export function getMapImage(mapName: string): string {
  const normalized = normalizeMapName(mapName)
  if (!ALL_MAPS.includes(normalized as typeof ALL_MAPS[number])) {
    return ''
  }
  return `/valorant/maps/${normalized}.png`
}

/**
 * Check if a map image exists
 */
export function hasMapImage(mapName: string): boolean {
  const normalized = normalizeMapName(mapName)
  return ALL_MAPS.includes(normalized as typeof ALL_MAPS[number])
}

/**
 * Get the gradient fallback for a map
 */
export function getMapGradient(mapName: string): string {
  const normalized = normalizeMapName(mapName)
  return MAP_GRADIENTS[normalized] || 'from-slate-900/40 to-slate-700/40'
}

/**
 * Get an agent's role
 */
export function getAgentRole(agentName: string): string {
  const normalized = normalizeAgentName(agentName)
  return AGENT_ROLES[normalized] || 'unknown'
}

/**
 * Get role colors for styling
 */
export function getRoleColors(role: string): { bg: string; text: string; border: string } {
  return ROLE_COLORS[role.toLowerCase()] || { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' }
}

/**
 * Get a placeholder letter for an agent without an icon
 */
export function getAgentPlaceholder(agentName: string): string {
  return agentName ? agentName.charAt(0).toUpperCase() : '?'
}

/**
 * Get the path to a team's logo
 */
export function getTeamLogo(teamName: string): string {
  const teamInfo = VCT_TEAMS[teamName]
  if (!teamInfo?.logo) {
    return ''
  }
  return `/valorant/teams/${teamInfo.logo}`
}

/**
 * Get team info by name
 */
export function getTeamInfo(teamName: string) {
  return VCT_TEAMS[teamName] || null
}

/**
 * Get a short name for a team
 */
export function getTeamShortName(teamName: string): string {
  const teamInfo = VCT_TEAMS[teamName]
  return teamInfo?.shortName || teamName.substring(0, 3).toUpperCase()
}

/**
 * Get team colors
 */
export function getTeamColors(teamName: string): { primary: string; secondary: string } {
  const teamInfo = VCT_TEAMS[teamName]
  return teamInfo?.colors || { primary: '#FF4655', secondary: '#1A1A2E' }
}

/**
 * Format an agent name for display
 */
export function formatAgentName(agentName: string): string {
  if (!agentName) return ''

  // Special case for KAY/O
  const normalized = normalizeAgentName(agentName)
  if (normalized === 'kayo') return 'KAY/O'

  // Title case
  return agentName.charAt(0).toUpperCase() + agentName.slice(1).toLowerCase()
}

/**
 * Format a map name for display
 */
export function formatMapName(mapName: string): string {
  if (!mapName) return ''
  return mapName.charAt(0).toUpperCase() + mapName.slice(1).toLowerCase()
}
