/**
 * VCT Team Logo Setup Script
 *
 * Creates team mapping and placeholder logos for VCT Americas teams.
 * Since esports logo CDNs typically block direct downloads, this script
 * creates SVG placeholders and provides instructions for manual download.
 *
 * Run with: npx tsx scripts/download-team-logos.ts
 */

import * as fs from 'fs'
import * as path from 'path'

const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const TEAMS_DIR = path.join(PUBLIC_DIR, 'valorant', 'teams')

// VCT Americas Teams with GRID IDs
// Note: GRID IDs from GRID.gg API match VCT Americas team data
const VCT_TEAMS: Record<string, { name: string; abbr: string; color: string; gridIds: string[] }> = {
  'c9': {
    name: 'Cloud9',
    abbr: 'C9',
    color: '#00AEEF',
    gridIds: ['97'],
  },
  'sen': {
    name: 'Sentinels',
    abbr: 'SEN',
    color: '#F4002C',
    gridIds: ['98'],
  },
  'loud': {
    name: 'LOUD',
    abbr: 'LOUD',
    color: '#00FF5A',
    gridIds: ['96'],
  },
  'furia': {
    name: 'FURIA',
    abbr: 'FUR',
    color: '#000000',
    gridIds: ['105'],
  },
  'lev': {
    name: 'Leviatán',
    abbr: 'LEV',
    color: '#663399',
    gridIds: ['99'],
  },
  'kru': {
    name: 'KRÜ Esports',
    abbr: 'KRÜ',
    color: '#7B68EE',
    gridIds: ['102'],
  },
  'mibr': {
    name: 'MIBR',
    abbr: 'MIBR',
    color: '#1E90FF',
    gridIds: ['104'],
  },
  'g2': {
    name: 'G2 Esports',
    abbr: 'G2',
    color: '#FF0000',
    gridIds: ['103'],
  },
  'nrg': {
    name: 'NRG Esports',
    abbr: 'NRG',
    color: '#FFC107',
    gridIds: ['100'],
  },
  '100t': {
    name: '100 Thieves',
    abbr: '100T',
    color: '#FF0000',
    gridIds: ['101'],
  },
  'eg': {
    name: '2Game Esports',
    abbr: '2G',
    color: '#3B82F6',
    gridIds: ['106'],
  },
}

// Map GRID IDs to team codes for runtime lookup
export const GRID_ID_TO_TEAM: Record<string, string> = {}
for (const [code, info] of Object.entries(VCT_TEAMS)) {
  for (const gridId of info.gridIds) {
    GRID_ID_TO_TEAM[gridId] = code
  }
}

/**
 * Generate a simple SVG placeholder logo for a team
 */
function generatePlaceholderSVG(abbr: string, color: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <rect width="100" height="100" fill="${color}" rx="12"/>
  <text x="50" y="58" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-weight="bold" font-size="24">${abbr}</text>
</svg>`
}

async function setupTeamLogos() {
  console.log('=== VCT Team Logo Setup ===\n')

  // Ensure directory exists
  if (!fs.existsSync(TEAMS_DIR)) {
    fs.mkdirSync(TEAMS_DIR, { recursive: true })
  }

  let created = 0
  let skipped = 0

  for (const [teamCode, info] of Object.entries(VCT_TEAMS)) {
    const pngPath = path.join(TEAMS_DIR, `${teamCode}.png`)
    const svgPath = path.join(TEAMS_DIR, `${teamCode}.svg`)

    // Check if PNG already exists (real logo)
    if (fs.existsSync(pngPath)) {
      const stats = fs.statSync(pngPath)
      if (stats.size > 1000) {
        skipped++
        console.log(`  ⊘ ${teamCode} (${info.name}): PNG exists, skipping`)
        continue
      }
    }

    // Create SVG placeholder if no PNG exists
    const svg = generatePlaceholderSVG(info.abbr, info.color)
    fs.writeFileSync(svgPath, svg)
    created++
    console.log(`  ✓ ${teamCode} (${info.name}): Created SVG placeholder`)
  }

  // Create team mapping JSON
  const mappingPath = path.join(TEAMS_DIR, 'team-mapping.json')
  const mapping = {
    teams: Object.fromEntries(
      Object.entries(VCT_TEAMS).map(([code, info]) => [
        code,
        { name: info.name, abbr: info.abbr, gridIds: info.gridIds }
      ])
    ),
    gridIdToTeam: GRID_ID_TO_TEAM,
  }
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2))

  console.log('\n========================================')
  console.log('SETUP COMPLETE')
  console.log('========================================')
  console.log(`SVG placeholders created: ${created}`)
  console.log(`Teams with PNG logos:     ${skipped}`)
  console.log(`Team mapping saved to:    ${mappingPath}`)
  console.log('')
  console.log('To download real team logos:')
  console.log('1. Visit https://vlr.gg/teams')
  console.log('2. Right-click on team logo and "Save image as..."')
  console.log(`3. Save to: ${TEAMS_DIR}/<team-code>.png`)
  console.log('')
  console.log('Team codes: c9, sen, loud, furia, lev, kru, mibr, g2, nrg, 100t, eg')
  console.log('========================================\n')
}

setupTeamLogos().catch(console.error)
