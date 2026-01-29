// Champion name normalization and alias handling
// File: supabase/functions/_shared/champion-aliases.ts

/**
 * Champion name aliases for handling variations from different APIs.
 * Maps canonical name → array of known aliases.
 *
 * Common patterns:
 * - GRID API: "Twisted Fate", "Miss Fortune", "Rek'Sai"
 * - Riot API: "TwistedFate", "MissFortune", "RekSai"
 * - Common abbreviations: "TF", "MF", "J4"
 */
export const CHAMPION_ALIASES: Record<string, string[]> = {
  // Multi-word names (with spaces or combined)
  'TwistedFate': ['Twisted Fate', 'TF'],
  'MissFortune': ['Miss Fortune', 'MF'],
  'DrMundo': ['Dr Mundo', 'Dr. Mundo', 'Mundo'],
  'LeeSin': ['Lee Sin'],
  'MasterYi': ['Master Yi'],
  'XinZhao': ['Xin Zhao'],
  'AurelionSol': ['Aurelion Sol', 'Asol', 'ASol'],
  'TahmKench': ['Tahm Kench'],

  // Apostrophe variations
  'Wukong': ['MonkeyKing', 'Kong'],  // Riot ID vs display name
  'RekSai': ["Rek'Sai", 'Reksai'],
  'KhaZix': ["Kha'Zix", 'Khazix'],
  'VelKoz': ["Vel'Koz", 'Velkoz'],
  'ChoGath': ["Cho'Gath", 'Chogath'],
  'KogMaw': ["Kog'Maw", 'Kogmaw'],
  'KaiSa': ["Kai'Sa", 'Kaisa'],
  'BelVeth': ["Bel'Veth", 'Belveth'],
  'KSante': ["K'Sante", 'Ksante'],

  // Roman numerals
  'JarvanIV': ['Jarvan IV', 'Jarvan 4', 'J4', 'Jarvan'],

  // Common abbreviations and alternate spellings
  'Renata': ['Renata Glasc', 'RenataGlasc'],
  'Nunu': ['Nunu & Willump', 'Nunu and Willump'],

  // Champions with "&" or "the"
  'Rengar': ['Rengar'],
  'Sejuani': ['Sejuani'],

  // Edge cases from professional play
  'Fiddlesticks': ['Fiddle'],
  'MonkeyKing': ['Wukong', 'Kong'],  // Reverse alias for GRID API
};

/**
 * Normalize a champion name to its canonical form.
 * Handles:
 * - Case-insensitive matching
 * - Space/apostrophe removal
 * - Alias lookup
 *
 * @param name - Raw champion name from any source
 * @returns Canonical champion name (matches CHAMPION_ROLE_PRIORS keys)
 *
 * @example
 * normalizeChampionName("Twisted Fate") → "TwistedFate"
 * normalizeChampionName("rek'sai") → "RekSai"
 * normalizeChampionName("J4") → "JarvanIV"
 */
export function normalizeChampionName(name: string): string {
  const normalized = name.replace(/['\s]/g, '').toLowerCase();

  // Check canonical names first
  for (const [canonical, aliases] of Object.entries(CHAMPION_ALIASES)) {
    if (canonical.toLowerCase() === normalized) {
      return canonical;
    }

    // Check aliases
    if (aliases.some(alias => alias.replace(/['\s]/g, '').toLowerCase() === normalized)) {
      return canonical;
    }
  }

  // Return as PascalCase if not found (best guess)
  // Remove apostrophes and spaces, capitalize first letter of each word
  return name
    .replace(/['\s]/g, '')
    .split(/(?=[A-Z])/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

/**
 * Get all known aliases for a champion.
 *
 * @param canonical - Canonical champion name
 * @returns Array of aliases (empty if champion not found)
 */
export function getChampionAliases(canonical: string): string[] {
  return CHAMPION_ALIASES[canonical] || [];
}

/**
 * Check if a champion name is valid (exists in our alias table).
 *
 * @param name - Champion name to validate
 * @returns True if champion exists in alias table
 */
export function isValidChampion(name: string): boolean {
  const normalized = normalizeChampionName(name);

  // Check if normalized name exists in our alias map
  return Object.keys(CHAMPION_ALIASES).includes(normalized) ||
    Object.values(CHAMPION_ALIASES).flat().some(alias =>
      alias.replace(/['\s]/g, '').toLowerCase() === normalized.toLowerCase()
    );
}

/**
 * Get champion count.
 *
 * @returns Total number of champions with aliases defined
 */
export function getAliasedChampionCount(): number {
  return Object.keys(CHAMPION_ALIASES).length;
}
