/**
 * VCT Team Logo Downloader
 *
 * Attempts to download team logos from VLR.gg CDN and creates SVG fallbacks.
 * Run with: npx tsx scripts/download-team-logos.ts
 */

import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'
import * as http from 'http'

const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const TEAMS_DIR = path.join(PUBLIC_DIR, 'valorant', 'teams')

// VCT Americas Teams with logo URLs from VLR.gg/owcdn
const VCT_TEAMS: Record<string, { name: string; abbr: string; color: string; gridIds: string[]; logoUrl?: string }> = {
  'c9': {
    name: 'Cloud9',
    abbr: 'C9',
    color: '#00AEEF',
    gridIds: ['97'],
    logoUrl: 'https://owcdn.net/img/5f1beed0e4676.png',
  },
  'sen': {
    name: 'Sentinels',
    abbr: 'SEN',
    color: '#F4002C',
    gridIds: ['98'],
    logoUrl: 'https://owcdn.net/img/63997830a633e.png',
  },
  'loud': {
    name: 'LOUD',
    abbr: 'LOUD',
    color: '#00FF5A',
    gridIds: ['96'],
    logoUrl: 'https://owcdn.net/img/61b495ca90a0c.png',
  },
  'furia': {
    name: 'FURIA',
    abbr: 'FUR',
    color: '#000000',
    gridIds: ['105'],
    logoUrl: 'https://owcdn.net/img/5f1bef3da2670.png',
  },
  'lev': {
    name: 'Leviatán',
    abbr: 'LEV',
    color: '#663399',
    gridIds: ['99'],
    logoUrl: 'https://owcdn.net/img/62a85d2d9e48f.png',
  },
  'kru': {
    name: 'KRÜ Esports',
    abbr: 'KRÜ',
    color: '#7B68EE',
    gridIds: ['102'],
    logoUrl: 'https://owcdn.net/img/5f1bf16f6864e.png',
  },
  'mibr': {
    name: 'MIBR',
    abbr: 'MIBR',
    color: '#1E90FF',
    gridIds: ['104'],
    logoUrl: 'https://owcdn.net/img/606e33b77c06d.png',
  },
  'g2': {
    name: 'G2 Esports',
    abbr: 'G2',
    color: '#FF0000',
    gridIds: ['103'],
    logoUrl: 'https://owcdn.net/img/5f1beae6b7a6f.png',
  },
  'nrg': {
    name: 'NRG Esports',
    abbr: 'NRG',
    color: '#FFC107',
    gridIds: ['100'],
    logoUrl: 'https://owcdn.net/img/5f1bef07063b4.png',
  },
  '100t': {
    name: '100 Thieves',
    abbr: '100T',
    color: '#FF0000',
    gridIds: ['101'],
    logoUrl: 'https://owcdn.net/img/5f1be0d6d7177.png',
  },
  'eg': {
    name: '2Game Esports',
    abbr: '2G',
    color: '#3B82F6',
    gridIds: ['106'],
    logoUrl: 'https://owcdn.net/img/633b01376ae45.png',
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

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)

    const makeRequest = (reqUrl: string) => {
      const urlObj = new URL(reqUrl)
      const reqOptions = {
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      }

      const proto = reqUrl.startsWith('https') ? https : http
      const request = proto.get(reqOptions, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            file.close()
            if (fs.existsSync(dest)) fs.unlinkSync(dest)
            const fullRedirect = redirectUrl.startsWith('http')
              ? redirectUrl
              : `https://${urlObj.hostname}${redirectUrl}`
            return downloadFile(fullRedirect, dest).then(resolve).catch(reject)
          }
        }

        if (response.statusCode !== 200) {
          file.close()
          if (fs.existsSync(dest)) fs.unlinkSync(dest)
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }

        response.pipe(file)

        file.on('finish', () => {
          file.close()
          resolve()
        })
      })

      request.on('error', (err) => {
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        reject(err)
      })

      file.on('error', (err) => {
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        reject(err)
      })
    }

    makeRequest(url)
  })
}

async function setupTeamLogos() {
  console.log('=== VCT Team Logo Downloader ===\n')

  // Ensure directory exists
  if (!fs.existsSync(TEAMS_DIR)) {
    fs.mkdirSync(TEAMS_DIR, { recursive: true })
  }

  let downloaded = 0
  let created = 0
  let skipped = 0
  const failures: string[] = []

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

    // Try to download PNG logo
    if (info.logoUrl) {
      try {
        await downloadFile(info.logoUrl, pngPath)
        const stats = fs.statSync(pngPath)
        if (stats.size > 500) {
          downloaded++
          console.log(`  ✓ ${teamCode} (${info.name}): Downloaded PNG`)
          continue
        } else {
          fs.unlinkSync(pngPath)
          throw new Error('File too small')
        }
      } catch (err) {
        failures.push(teamCode)
        console.log(`  ✗ ${teamCode}: Download failed, creating SVG fallback`)
      }
    }

    // Create SVG placeholder if download failed or no URL
    const svg = generatePlaceholderSVG(info.abbr, info.color)
    fs.writeFileSync(svgPath, svg)
    created++
    console.log(`  ○ ${teamCode} (${info.name}): Created SVG fallback`)
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
  console.log(`PNG logos downloaded: ${downloaded}`)
  console.log(`SVG fallbacks created: ${created}`)
  console.log(`Already existed:       ${skipped}`)
  console.log(`Team mapping saved to: ${mappingPath}`)

  if (failures.length > 0) {
    console.log(`\nFailed downloads: ${failures.join(', ')}`)
    console.log('These teams are using SVG fallbacks')
  }

  console.log('========================================\n')
}

setupTeamLogos().catch(console.error)
