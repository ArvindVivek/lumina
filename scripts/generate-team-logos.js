const fs = require('fs');
const path = require('path');

const TEAMS_DIR = path.join(__dirname, '..', 'public', 'valorant', 'teams');

// VCT team data: abbreviation, primary color, secondary color
const TEAMS = {
  // VCT Americas
  'sen': { abbrev: 'SEN', primary: '#FF4655', secondary: '#1A1A2E' },
  '100t': { abbrev: '100T', primary: '#FF0000', secondary: '#000000' },
  'c9': { abbrev: 'C9', primary: '#00AEEF', secondary: '#FFFFFF' },
  'nrg': { abbrev: 'NRG', primary: '#E31837', secondary: '#000000' },
  'eg': { abbrev: 'EG', primary: '#0082C8', secondary: '#1A1A1A' },
  'fur': { abbrev: 'FUR', primary: '#000000', secondary: '#FF6600' },
  'loud': { abbrev: 'LOUD', primary: '#00FF00', secondary: '#000000' },
  'mibr': { abbrev: 'MIBR', primary: '#F7C600', secondary: '#000000' },
  'kru': { abbrev: 'KRÜ', primary: '#6B2C91', secondary: '#FFFFFF' },
  'lev': { abbrev: 'LEV', primary: '#00A3E0', secondary: '#FFFFFF' },
  'g2': { abbrev: 'G2', primary: '#FF0000', secondary: '#000000' },
  '2g': { abbrev: '2G', primary: '#FF4655', secondary: '#1A1A2E' },

  // VCT EMEA
  'fnc': { abbrev: 'FNC', primary: '#FF5900', secondary: '#1A1A1A' },
  'tl': { abbrev: 'TL', primary: '#0E2C4D', secondary: '#1A1A1A' },
  'navi': { abbrev: 'NAVI', primary: '#F1C40F', secondary: '#000000' },
  'fut': { abbrev: 'FUT', primary: '#FFD700', secondary: '#000000' },
  'th': { abbrev: 'TH', primary: '#E2012D', secondary: '#FFCC00' },
  'vit': { abbrev: 'VIT', primary: '#FFB900', secondary: '#000000' },
  'kc': { abbrev: 'KC', primary: '#0055A0', secondary: '#FFFFFF' },
  'koi': { abbrev: 'KOI', primary: '#9B59B6', secondary: '#FFFFFF' },
  'bbl': { abbrev: 'BBL', primary: '#FFD700', secondary: '#000000' },
  'bds': { abbrev: 'BDS', primary: '#0A1628', secondary: '#7C3AED' },
  'giants': { abbrev: 'GIA', primary: '#FF6B35', secondary: '#1A1A1A' },
  'gx': { abbrev: 'GX', primary: '#FF6B35', secondary: '#1A1A1A' },

  // VCT Pacific
  'prx': { abbrev: 'PRX', primary: '#00CED1', secondary: '#FF6347' },
  'drx': { abbrev: 'DRX', primary: '#0050A0', secondary: '#00A0DC' },
  't1': { abbrev: 'T1', primary: '#E2012D', secondary: '#FFFFFF' },
  'geng': { abbrev: 'GEN', primary: '#AA8A34', secondary: '#1A1A1A' },
  'rrq': { abbrev: 'RRQ', primary: '#FF4655', secondary: '#000000' },
  'ts': { abbrev: 'TS', primary: '#00A3E0', secondary: '#FFFFFF' },
  'talon': { abbrev: 'TLN', primary: '#E31837', secondary: '#000000' },
  'zeta': { abbrev: 'ZETA', primary: '#00AEEF', secondary: '#000000' },
  'dfm': { abbrev: 'DFM', primary: '#E31837', secondary: '#000000' },
  'bleed': { abbrev: 'BLD', primary: '#FF0000', secondary: '#000000' },
  'ge': { abbrev: 'GE', primary: '#FF6600', secondary: '#000000' },

  // VCT China
  'edg': { abbrev: 'EDG', primary: '#1A1A1A', secondary: '#E2012D' },
  'fpx': { abbrev: 'FPX', primary: '#E2012D', secondary: '#C8A500' },
  'blg': { abbrev: 'BLG', primary: '#00A0E9', secondary: '#FF6699' },
  'ag': { abbrev: 'AG', primary: '#00CED1', secondary: '#000000' },
  'jdg': { abbrev: 'JDG', primary: '#E2012D', secondary: '#1A1A1A' },
  'te': { abbrev: 'TE', primary: '#FF4655', secondary: '#1A1A2E' },
  'wolves': { abbrev: 'WOL', primary: '#FFD700', secondary: '#000000' },
  'nova': { abbrev: 'NOVA', primary: '#00A3E0', secondary: '#FFFFFF' },
  'titan': { abbrev: 'TEC', primary: '#E31837', secondary: '#000000' },
  'drgx': { abbrev: 'DRG', primary: '#FF0000', secondary: '#000000' },
};

function generateSVG(team) {
  const { abbrev, primary, secondary } = team;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="grad-${abbrev}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${primary};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${secondary};stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="120" height="120" rx="16" fill="url(#grad-${abbrev})"/>
  <text x="60" y="68" font-family="Arial, sans-serif" font-size="${abbrev.length > 3 ? '28' : abbrev.length > 2 ? '32' : '40'}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="middle">${abbrev}</text>
</svg>`;
}

function main() {
  if (!fs.existsSync(TEAMS_DIR)) {
    fs.mkdirSync(TEAMS_DIR, { recursive: true });
  }

  let generated = 0;

  for (const [teamId, teamData] of Object.entries(TEAMS)) {
    const svg = generateSVG(teamData);
    const filePath = path.join(TEAMS_DIR, teamId + '.svg');
    fs.writeFileSync(filePath, svg);
    generated++;
  }

  console.log('Generated ' + generated + ' team logo SVGs');
}

main();
