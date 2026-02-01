import type { Sql } from 'postgres'

export interface ResolvedEntities {
  players: { id: string; name: string; team_id: string | null }[]
  teams: { id: string; name: string }[]
  series: { id: string; team_a_name: string; team_b_name: string; tournament_name: string }[]
  queryType: 'player' | 'team' | 'match' | 'general'
  confidence: number
}

/**
 * Resolve entities from natural language query
 * Identifies players, teams, and series mentioned in the query
 */
export async function resolveEntities(
  sql: Sql,
  query: string
): Promise<ResolvedEntities> {
  const lowerQuery = query.toLowerCase()
  const result: ResolvedEntities = {
    players: [],
    teams: [],
    series: [],
    queryType: 'general',
    confidence: 0.5,
  }

  // Extract potential entity names (words that might be names)
  // Look for patterns like "player X", "team Y", "X vs Y", etc.

  // Check for "vs" pattern indicating a match query
  const vsMatch = lowerQuery.match(/(\w+)\s+vs\.?\s+(\w+)/i)
  if (vsMatch) {
    result.queryType = 'match'

    // Try to find both teams
    const [, team1Pattern, team2Pattern] = vsMatch
    const teams = await findTeams(sql, [team1Pattern, team2Pattern])
    result.teams = teams

    // Find series between these teams
    if (teams.length >= 2) {
      const series = await findSeriesBetweenTeams(sql, teams[0].id, teams[1].id)
      result.series = series
      result.confidence = series.length > 0 ? 0.9 : 0.6
    }
    return result
  }

  // Check for "analyze/review/stats for [name]" pattern
  const analyzeMatch = lowerQuery.match(/(?:analyze|review|stats|performance|insights)\s+(?:for\s+)?(\w+)/i)
  if (analyzeMatch) {
    const [, name] = analyzeMatch

    // Try to find as player first
    const players = await findPlayers(sql, [name])
    if (players.length > 0) {
      result.players = players
      result.queryType = 'player'
      result.confidence = 0.8
      return result
    }

    // Try as team
    const teams = await findTeams(sql, [name])
    if (teams.length > 0) {
      result.teams = teams
      result.queryType = 'team'
      result.confidence = 0.8
      return result
    }
  }

  // Extract all potential entity names from query
  const words = query.match(/\b[A-Z][a-z]+\b|\b[A-Z]+\b/g) || []
  const potentialNames = [...new Set(words.filter(w => w.length > 2))]

  if (potentialNames.length > 0) {
    // Try to find players
    const players = await findPlayers(sql, potentialNames)
    result.players = players

    // Try to find teams
    const teams = await findTeams(sql, potentialNames)
    result.teams = teams

    // Determine query type
    if (players.length > 0 && teams.length === 0) {
      result.queryType = 'player'
      result.confidence = 0.7
    } else if (teams.length > 0 && players.length === 0) {
      result.queryType = 'team'
      result.confidence = 0.7
    } else if (players.length > 0 && teams.length > 0) {
      // Both found - prefer teams if query mentions team-related words
      if (lowerQuery.includes('team') || lowerQuery.includes('macro') || lowerQuery.includes('strategy')) {
        result.queryType = 'team'
      } else {
        result.queryType = 'player'
      }
      result.confidence = 0.6
    }
  }

  return result
}

/**
 * Find players matching patterns
 */
async function findPlayers(
  sql: Sql,
  patterns: string[]
): Promise<{ id: string; name: string; team_id: string | null }[]> {
  if (patterns.length === 0) return []

  // Build OR conditions for name matching
  const result = await sql`
    SELECT id, name, team_id
    FROM public.players
    WHERE ${sql.unsafe(patterns.map(p => `LOWER(name) LIKE LOWER('%${p}%')`).join(' OR '))}
    LIMIT 5
  `

  return result.map(row => ({
    id: row.id,
    name: row.name,
    team_id: row.team_id,
  }))
}

/**
 * Find teams matching patterns
 */
async function findTeams(
  sql: Sql,
  patterns: string[]
): Promise<{ id: string; name: string }[]> {
  if (patterns.length === 0) return []

  // Build OR conditions for name matching
  const result = await sql`
    SELECT id, name
    FROM public.teams
    WHERE ${sql.unsafe(patterns.map(p => `LOWER(name) LIKE LOWER('%${p}%')`).join(' OR '))}
    LIMIT 5
  `

  return result.map(row => ({
    id: row.id,
    name: row.name,
  }))
}

/**
 * Find series between two teams
 */
async function findSeriesBetweenTeams(
  sql: Sql,
  teamAId: string,
  teamBId: string
): Promise<{ id: string; team_a_name: string; team_b_name: string; tournament_name: string }[]> {
  const result = await sql`
    SELECT
      s.id,
      ta.name as team_a_name,
      tb.name as team_b_name,
      t.name as tournament_name
    FROM public.series s
    JOIN public.teams ta ON s.team_a_id = ta.id
    JOIN public.teams tb ON s.team_b_id = tb.id
    JOIN public.tournaments t ON s.tournament_id = t.id
    WHERE (s.team_a_id = ${teamAId} AND s.team_b_id = ${teamBId})
       OR (s.team_a_id = ${teamBId} AND s.team_b_id = ${teamAId})
    ORDER BY s.start_time DESC
    LIMIT 5
  `

  return result.map(row => ({
    id: row.id,
    team_a_name: row.team_a_name,
    team_b_name: row.team_b_name,
    tournament_name: row.tournament_name,
  }))
}

/**
 * Get recent series for a team
 */
export async function getRecentSeriesForTeam(
  sql: Sql,
  teamId: string,
  limit: number = 5
): Promise<{ id: string; opponent_name: string; result: string; tournament_name: string }[]> {
  const result = await sql`
    SELECT
      s.id,
      s.winner_id,
      CASE
        WHEN s.team_a_id = ${teamId} THEN tb.name
        ELSE ta.name
      END as opponent_name,
      t.name as tournament_name
    FROM public.series s
    JOIN public.teams ta ON s.team_a_id = ta.id
    JOIN public.teams tb ON s.team_b_id = tb.id
    JOIN public.tournaments t ON s.tournament_id = t.id
    WHERE s.team_a_id = ${teamId} OR s.team_b_id = ${teamId}
    ORDER BY s.start_time DESC
    LIMIT ${limit}
  `

  return result.map(row => ({
    id: row.id,
    opponent_name: row.opponent_name,
    result: row.winner_id === teamId ? 'win' : 'loss',
    tournament_name: row.tournament_name,
  }))
}

/**
 * Get player's recent series
 */
export async function getRecentSeriesForPlayer(
  sql: Sql,
  playerId: string,
  limit: number = 5
): Promise<{ series_id: string; team_name: string; opponent_name: string }[]> {
  const result = await sql`
    SELECT DISTINCT
      s.id as series_id,
      CASE
        WHEN prs.team_id = s.team_a_id THEN ta.name
        ELSE tb.name
      END as team_name,
      CASE
        WHEN prs.team_id = s.team_a_id THEN tb.name
        ELSE ta.name
      END as opponent_name
    FROM public.player_round_stats prs
    JOIN public.rounds r ON prs.round_id = r.id
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    JOIN public.teams ta ON s.team_a_id = ta.id
    JOIN public.teams tb ON s.team_b_id = tb.id
    WHERE prs.player_id = ${playerId}
    ORDER BY s.id DESC
    LIMIT ${limit}
  `

  return result.map(row => ({
    series_id: row.series_id,
    team_name: row.team_name,
    opponent_name: row.opponent_name,
  }))
}
