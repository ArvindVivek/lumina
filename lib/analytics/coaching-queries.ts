import type { Sql } from 'postgres'
import { getPostgresPool } from '@/lib/supabase/server'
import type {
  SeriesSummary,
  MapMetrics,
  PlayerOpeningDuels,
  RoundForReview,
  RoundContext,
  KillEvent,
  PlayerState,
  SpikeEvent,
  FirstBlood,
  ScenarioMatch,
  VODPriority,
  NotableEvent,
} from './coaching-types'

/**
 * Query series summary for coaching report
 */
export async function querySeriesSummary(
  seriesId: string,
  teamId: string
): Promise<SeriesSummary | null> {
  const sql = getPostgresPool()
  const result = await sql`
    WITH series_data AS (
      SELECT
        s.id,
        s.team_a_id,
        s.team_b_id,
        s.winner_id,
        ta.name as team_a_name,
        tb.name as team_b_name,
        (SELECT COUNT(*) FROM public.games WHERE series_id = s.id AND winner_id = s.team_a_id) as team_a_wins,
        (SELECT COUNT(*) FROM public.games WHERE series_id = s.id AND winner_id = s.team_b_id) as team_b_wins,
        (SELECT COUNT(*) FROM public.games WHERE series_id = s.id) as total_maps
      FROM public.series s
      JOIN public.teams ta ON s.team_a_id = ta.id
      JOIN public.teams tb ON s.team_b_id = tb.id
      WHERE s.id = ${seriesId}
    )
    SELECT * FROM series_data
  `

  if (result.length === 0) return null

  const row = result[0]
  const isTeamA = row.team_a_id === teamId
  const teamScore = isTeamA ? row.team_a_wins : row.team_b_wins
  const opponentScore = isTeamA ? row.team_b_wins : row.team_a_wins
  const won = row.winner_id === teamId

  // Get map details
  const maps = await sql`
    SELECT
      g.id as game_id,
      g.map_name,
      g.team_a_score,
      g.team_b_score,
      g.winner_id,
      g.sequence_number
    FROM public.games g
    WHERE g.series_id = ${seriesId}
    ORDER BY g.sequence_number
  `

  // Get total rounds
  const roundCount = await sql`
    SELECT COUNT(*)::int as count
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    WHERE g.series_id = ${seriesId}
  `

  return {
    series_id: seriesId,
    team_id: teamId,
    team_name: isTeamA ? row.team_a_name : row.team_b_name,
    opponent_id: isTeamA ? row.team_b_id : row.team_a_id,
    opponent_name: isTeamA ? row.team_b_name : row.team_a_name,
    result: won ? 'win' : 'loss',
    score: `${teamScore}-${opponentScore}`,
    total_rounds: roundCount[0]?.count || 0,
    total_maps: Number(row.total_maps),
    maps: maps.map(m => ({
      game_id: m.game_id,
      map_name: m.map_name,
      team_score: isTeamA ? Number(m.team_a_score) : Number(m.team_b_score),
      opponent_score: isTeamA ? Number(m.team_b_score) : Number(m.team_a_score),
      result: m.winner_id === teamId ? 'win' as const : 'loss' as const,
    })),
    key_strength: '', // Will be filled by analysis
    key_weakness: '', // Will be filled by analysis
  }
}

/**
 * Query map metrics for each game in series
 */
export async function queryMapMetrics(
  seriesId: string,
  teamId: string
): Promise<MapMetrics[]> {
  const sql = getPostgresPool()
  const result = await sql`
    WITH game_rounds AS (
      SELECT
        g.id as game_id,
        g.map_name,
        g.team_a_score,
        g.team_b_score,
        r.id as round_id,
        r.winning_team_id,
        r.spike_planted,
        s.team_a_id,
        s.team_b_id
      FROM public.games g
      JOIN public.series s ON g.series_id = s.id
      JOIN public.rounds r ON r.game_id = g.id
      WHERE g.series_id = ${seriesId}
    ),
    first_bloods AS (
      SELECT
        gr.game_id,
        gr.round_id,
        prs.team_id as fb_team_id,
        gr.winning_team_id
      FROM game_rounds gr
      JOIN public.player_round_stats prs ON prs.round_id = gr.round_id AND prs.first_kill = TRUE
    ),
    trades AS (
      SELECT
        gr.game_id,
        prs.player_id,
        prs.traded,
        prs.deaths
      FROM game_rounds gr
      JOIN public.player_round_stats prs ON prs.round_id = gr.round_id
      WHERE prs.team_id = ${teamId} AND prs.deaths > 0
    ),
    post_plants AS (
      SELECT
        gr.game_id,
        gr.round_id,
        gr.winning_team_id,
        gr.spike_planted
      FROM game_rounds gr
      WHERE gr.spike_planted = TRUE
    )
    SELECT
      g.id as game_id,
      g.map_name,
      g.team_a_score,
      g.team_b_score,
      s.team_a_id,
      s.team_b_id,
      COALESCE((
        SELECT COUNT(*) FILTER (WHERE fb.fb_team_id = ${teamId})::float /
               NULLIF(COUNT(*)::float, 0)
        FROM first_bloods fb WHERE fb.game_id = g.id
      ), 0) as fb_win_rate,
      COALESCE((
        SELECT COUNT(*) FILTER (WHERE fb.fb_team_id = ${teamId} AND fb.winning_team_id = ${teamId})::float /
               NULLIF(COUNT(*) FILTER (WHERE fb.fb_team_id = ${teamId})::float, 0)
        FROM first_bloods fb WHERE fb.game_id = g.id
      ), 0) as fb_conversion_rate,
      COALESCE((
        SELECT COUNT(*) FILTER (WHERE t.traded = TRUE)::float /
               NULLIF(COUNT(*)::float, 0)
        FROM trades t WHERE t.game_id = g.id
      ), 0) as trade_rate,
      COALESCE((
        SELECT COUNT(*) FILTER (WHERE t.traded = FALSE)
        FROM trades t WHERE t.game_id = g.id
      ), 0) as untraded_deaths,
      COALESCE((
        SELECT COUNT(*) FILTER (WHERE pp.winning_team_id = ${teamId})::float /
               NULLIF(COUNT(*)::float, 0)
        FROM post_plants pp WHERE pp.game_id = g.id
      ), 0) as post_plant_win_rate
    FROM public.games g
    JOIN public.series s ON g.series_id = s.id
    WHERE g.series_id = ${seriesId}
    ORDER BY g.sequence_number
  `

  return result.map(row => {
    const isTeamA = row.team_a_id === teamId
    const teamScore = isTeamA ? Number(row.team_a_score) : Number(row.team_b_score)
    const opponentScore = isTeamA ? Number(row.team_b_score) : Number(row.team_a_score)

    return {
      game_id: row.game_id,
      map_name: row.map_name,
      score: `${teamScore}-${opponentScore}`,
      fb_win_rate: Number(row.fb_win_rate),
      fb_conversion_rate: Number(row.fb_conversion_rate),
      trade_rate: Number(row.trade_rate),
      untraded_deaths: Number(row.untraded_deaths),
      post_plant_win_rate: Number(row.post_plant_win_rate),
    }
  })
}

/**
 * Query opening duels by player
 */
export async function queryPlayerOpeningDuels(
  seriesId: string,
  teamId: string
): Promise<PlayerOpeningDuels[]> {
  const sql = getPostgresPool()
  const result = await sql`
    WITH player_duels AS (
      SELECT
        prs.player_id,
        p.name as player_name,
        SUM(CASE WHEN prs.first_kill = TRUE THEN 1 ELSE 0 END) as first_kills,
        SUM(CASE WHEN prs.first_death = TRUE THEN 1 ELSE 0 END) as first_deaths,
        COUNT(*) as total_rounds,
        -- FK conversion: rounds won when got FK
        SUM(CASE WHEN prs.first_kill = TRUE AND r.winning_team_id = ${teamId} THEN 1 ELSE 0 END) as fk_wins,
        -- FD loss: rounds lost when got FD
        SUM(CASE WHEN prs.first_death = TRUE AND r.winning_team_id != ${teamId} THEN 1 ELSE 0 END) as fd_losses
      FROM public.player_round_stats prs
      JOIN public.players p ON prs.player_id = p.id
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      WHERE g.series_id = ${seriesId}
        AND prs.team_id = ${teamId}
      GROUP BY prs.player_id, p.name
    )
    SELECT
      player_id,
      player_name,
      first_kills,
      first_deaths,
      (first_kills - first_deaths) as net,
      total_rounds,
      CASE WHEN first_kills > 0 THEN fk_wins::float / first_kills ELSE 0 END as fk_conversion_rate,
      CASE WHEN first_deaths > 0 THEN fd_losses::float / first_deaths ELSE 0 END as fd_loss_rate
    FROM player_duels
    ORDER BY net DESC, first_kills DESC
  `

  return result.map(row => ({
    player_id: row.player_id,
    player_name: row.player_name,
    first_kills: Number(row.first_kills),
    first_deaths: Number(row.first_deaths),
    net: Number(row.net),
    fk_conversion_rate: Number(row.fk_conversion_rate),
    fd_loss_rate: Number(row.fd_loss_rate),
    total_rounds: Number(row.total_rounds),
  }))
}

/**
 * Query rounds for VOD review with priority scoring
 */
export async function queryRoundsForReview(
  seriesId: string,
  teamId: string
): Promise<RoundForReview[]> {
  const sql = getPostgresPool()
  // Get all rounds with context
  const rounds = await sql`
    WITH round_data AS (
      SELECT
        r.id as round_id,
        r.game_id,
        g.map_name,
        g.sequence_number,
        r.round_number,
        r.winning_team_id,
        r.winning_condition,
        r.spike_planted,
        r.team_a_alive,
        r.team_b_alive,
        r.duration_ms,
        s.team_a_id,
        s.team_b_id,
        -- Running scores
        SUM(CASE WHEN r2.winning_team_id = s.team_a_id AND r2.round_number < r.round_number AND r2.game_id = r.game_id THEN 1 ELSE 0 END) as team_a_score_before,
        SUM(CASE WHEN r2.winning_team_id = s.team_b_id AND r2.round_number < r.round_number AND r2.game_id = r.game_id THEN 1 ELSE 0 END) as team_b_score_before
      FROM public.rounds r
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      LEFT JOIN public.rounds r2 ON r2.game_id = r.game_id
      WHERE g.series_id = ${seriesId}
      GROUP BY r.id, r.game_id, g.map_name, g.sequence_number, r.round_number, r.winning_team_id, r.winning_condition, r.spike_planted, r.team_a_alive, r.team_b_alive, r.duration_ms, s.team_a_id, s.team_b_id
    ),
    first_bloods AS (
      SELECT
        prs.round_id,
        prs.player_id,
        p.name as player_name,
        prs.team_id,
        ke.game_time_ms
      FROM public.player_round_stats prs
      JOIN public.players p ON prs.player_id = p.id
      LEFT JOIN public.kill_events ke ON ke.round_id = prs.round_id AND ke.is_first_kill = TRUE AND ke.killer_id = prs.player_id
      WHERE prs.first_kill = TRUE
    ),
    untraded AS (
      SELECT
        prs.round_id,
        COUNT(*) as untraded_count
      FROM public.player_round_stats prs
      WHERE prs.team_id = ${teamId}
        AND prs.deaths > 0
        AND prs.traded = FALSE
      GROUP BY prs.round_id
    ),
    multi_kills AS (
      SELECT
        prs.round_id,
        prs.player_id,
        p.name as player_name,
        prs.kills
      FROM public.player_round_stats prs
      JOIN public.players p ON prs.player_id = p.id
      WHERE prs.team_id = ${teamId}
        AND prs.kills >= 3
    ),
    clutches AS (
      SELECT
        prs.round_id,
        prs.player_id,
        p.name as player_name,
        prs.clutch_won
      FROM public.player_round_stats prs
      JOIN public.players p ON prs.player_id = p.id
      WHERE prs.team_id = ${teamId}
        AND prs.clutch_situation = TRUE
    )
    SELECT
      rd.*,
      fb.player_id as fb_player_id,
      fb.player_name as fb_player_name,
      fb.team_id as fb_team_id,
      fb.game_time_ms as fb_time_ms,
      COALESCE(ut.untraded_count, 0) as untraded_deaths,
      (SELECT json_agg(json_build_object('player_id', mk.player_id, 'player_name', mk.player_name, 'kills', mk.kills))
       FROM multi_kills mk WHERE mk.round_id = rd.round_id) as multi_kills,
      (SELECT json_agg(json_build_object('player_id', c.player_id, 'player_name', c.player_name, 'won', c.clutch_won))
       FROM clutches c WHERE c.round_id = rd.round_id) as clutches
    FROM round_data rd
    LEFT JOIN first_bloods fb ON fb.round_id = rd.round_id
    LEFT JOIN untraded ut ON ut.round_id = rd.round_id
    ORDER BY rd.sequence_number, rd.round_number
  `

  return rounds.map(row => {
    const isTeamA = row.team_a_id === teamId
    const won = row.winning_team_id === teamId
    const teamScoreBefore = isTeamA ? Number(row.team_a_score_before) : Number(row.team_b_score_before)
    const opponentScoreBefore = isTeamA ? Number(row.team_b_score_before) : Number(row.team_a_score_before)
    const teamScoreAfter = won ? teamScoreBefore + 1 : teamScoreBefore
    const opponentScoreAfter = won ? opponentScoreBefore : opponentScoreBefore + 1

    // Determine side (attack/defense) based on round number
    // Rounds 1-12: team_a attacks, team_b defends
    // Rounds 13-24: team_b attacks, team_a defends
    const isFirstHalf = row.round_number <= 12
    const side = isTeamA
      ? (isFirstHalf ? 'attack' : 'defense')
      : (isFirstHalf ? 'defense' : 'attack')

    // Build notable events
    const notableEvents: NotableEvent[] = []

    if (row.multi_kills) {
      for (const mk of row.multi_kills) {
        if (mk.kills >= 5) {
          notableEvents.push({
            type: 'ace',
            player_id: mk.player_id,
            player_name: mk.player_name,
            detail: `${mk.player_name} got an ACE`,
          })
        } else if (mk.kills >= 3) {
          notableEvents.push({
            type: 'multi_kill',
            player_id: mk.player_id,
            player_name: mk.player_name,
            detail: `${mk.player_name} got ${mk.kills}K`,
          })
        }
      }
    }

    if (row.clutches) {
      for (const c of row.clutches) {
        notableEvents.push({
          type: c.won ? 'clutch_won' : 'clutch_lost',
          player_id: c.player_id,
          player_name: c.player_name,
          detail: c.won ? `${c.player_name} won clutch` : `${c.player_name} lost clutch`,
        })
      }
    }

    // Calculate VOD priority
    const { priority, reason } = calculateVODPriority(
      won,
      Number(row.untraded_deaths),
      row.fb_team_id === teamId,
      row.fb_team_id !== null,
      notableEvents,
      row.spike_planted,
      row.winning_condition
    )

    return {
      round_id: row.round_id,
      game_id: row.game_id,
      map_name: row.map_name,
      round_number: Number(row.round_number),
      side: side as 'attack' | 'defense',
      result: won ? 'win' as const : 'loss' as const,
      score_before: `${teamScoreBefore}-${opponentScoreBefore}`,
      score_after: `${teamScoreAfter}-${opponentScoreAfter}`,
      first_blood: row.fb_player_id ? {
        player_id: row.fb_player_id,
        player_name: row.fb_player_name,
        team_id: row.fb_team_id,
        time_ms: Number(row.fb_time_ms) || 0,
      } : null,
      untraded_deaths: Number(row.untraded_deaths),
      spike_planted: row.spike_planted,
      winning_condition: row.winning_condition,
      notable_events: notableEvents,
      review_priority: priority,
      priority_reason: reason,
    }
  })
}

/**
 * Calculate VOD review priority for a round
 */
function calculateVODPriority(
  won: boolean,
  untradedDeaths: number,
  gotFirstBlood: boolean,
  hadFirstBlood: boolean,
  notableEvents: NotableEvent[],
  spikePlanted: boolean,
  winningCondition: string
): { priority: VODPriority; reason: string } {
  const hasClutchLost = notableEvents.some(e => e.type === 'clutch_lost')
  const hasClutchWon = notableEvents.some(e => e.type === 'clutch_won')
  const hasAce = notableEvents.some(e => e.type === 'ace')
  const hasMultiKill = notableEvents.some(e => e.type === 'multi_kill')

  // CRITICAL: Lost rounds with major issues
  if (!won) {
    if (gotFirstBlood) {
      return { priority: 'critical', reason: 'Won FB but lost round - critical conversion failure' }
    }
    if (untradedDeaths >= 4) {
      return { priority: 'critical', reason: `${untradedDeaths} untraded deaths - severe positioning issues` }
    }
    if (hasClutchLost) {
      return { priority: 'critical', reason: 'Lost clutch situation - review decision making' }
    }
    if (spikePlanted && winningCondition === 'defuse') {
      return { priority: 'critical', reason: 'Lost post-plant situation - review retake defense' }
    }
  }

  // HIGH: Rounds with significant learning opportunities
  if (!won && untradedDeaths >= 3) {
    return { priority: 'high', reason: `${untradedDeaths} untraded deaths - review positioning` }
  }
  if (!won && hadFirstBlood && !gotFirstBlood) {
    return { priority: 'high', reason: 'Lost first blood - review opening approach' }
  }

  // MEDIUM: Won rounds with teaching moments
  if (won && hasClutchWon) {
    return { priority: 'medium', reason: 'Clutch win - study successful decision making' }
  }
  if (won && gotFirstBlood) {
    return { priority: 'medium', reason: 'Won with FB - review successful conversion' }
  }
  if (!won && untradedDeaths >= 2) {
    return { priority: 'medium', reason: `${untradedDeaths} untraded deaths` }
  }

  // LOW: Notable but not critical
  if (hasAce || hasMultiKill) {
    return { priority: 'low', reason: 'Multi-kill or ace - highlight reel' }
  }
  if (won && untradedDeaths === 0) {
    return { priority: 'low', reason: 'Clean win - good execution' }
  }

  // SKIP: Nothing notable
  return { priority: 'skip', reason: 'Standard round - skip unless time permits' }
}

/**
 * Query round context for hypothetical analysis
 */
export async function queryRoundContext(
  roundId: string
): Promise<RoundContext | null> {
  const sql = getPostgresPool()
  // Get round basic info
  const roundResult = await sql`
    SELECT
      r.id as round_id,
      r.game_id,
      g.map_name,
      r.round_number,
      s.team_a_id,
      s.team_b_id,
      g.team_a_score,
      g.team_b_score,
      r.winning_team_id,
      r.winning_condition,
      r.spike_planted,
      r.spike_defused,
      r.duration_ms,
      r.phase
    FROM public.rounds r
    JOIN public.games g ON r.game_id = g.id
    JOIN public.series s ON g.series_id = s.id
    WHERE r.id = ${roundId}
  `

  if (roundResult.length === 0) return null
  const round = roundResult[0]

  // Get kill timeline
  const kills = await sql`
    SELECT
      ke.game_time_ms,
      ke.killer_id,
      pk.name as killer_name,
      prsk.agent as killer_agent,
      ke.victim_id,
      pv.name as victim_name,
      prsv.agent as victim_agent,
      ke.weapon,
      ke.headshot,
      ke.is_trade,
      ke.is_first_kill
    FROM public.kill_events ke
    JOIN public.players pk ON ke.killer_id = pk.id
    JOIN public.players pv ON ke.victim_id = pv.id
    LEFT JOIN public.player_round_stats prsk ON prsk.round_id = ke.round_id AND prsk.player_id = ke.killer_id
    LEFT JOIN public.player_round_stats prsv ON prsv.round_id = ke.round_id AND prsv.player_id = ke.victim_id
    WHERE ke.round_id = ${roundId}
    ORDER BY ke.game_time_ms
  `

  // Get player states
  const playerStates = await sql`
    SELECT
      prs.player_id,
      p.name as player_name,
      prs.team_id,
      prs.agent,
      prs.kills,
      prs.deaths,
      prs.assists,
      prs.first_kill,
      prs.first_death,
      prs.traded,
      prs.clutch_situation,
      prs.clutch_won,
      prs.loadout_value
    FROM public.player_round_stats prs
    JOIN public.players p ON prs.player_id = p.id
    WHERE prs.round_id = ${roundId}
  `

  // Get spike events
  const spikeEvents = await sql`
    SELECT
      se.game_time_ms,
      se.event_type,
      se.player_id,
      p.name as player_name,
      se.site
    FROM public.spike_events se
    JOIN public.players p ON se.player_id = p.id
    WHERE se.round_id = ${roundId}
    ORDER BY se.game_time_ms
  `

  // Get first blood
  const killsData = kills as unknown as Array<{
    game_time_ms: number
    killer_id: string
    killer_name: string
    killer_agent: string
    victim_id: string
    victim_name: string
    victim_agent: string
    weapon: string
    headshot: boolean
    is_trade: boolean
    is_first_kill: boolean
  }>
  const playerStatesData = playerStates as unknown as Array<{
    player_id: string
    player_name: string
    team_id: string
    agent: string
    kills: number
    deaths: number
    assists: number
    first_kill: boolean
    first_death: boolean
    traded: boolean
    clutch_situation: boolean
    clutch_won: boolean
    loadout_value: number
  }>
  const firstBloodKill = killsData.find(k => k.is_first_kill)
  const firstBlood: FirstBlood | null = firstBloodKill ? {
    player_id: firstBloodKill.killer_id,
    player_name: firstBloodKill.killer_name,
    team_id: playerStatesData.find(p => p.player_id === firstBloodKill.killer_id)?.team_id || '',
    time_ms: Number(firstBloodKill.game_time_ms),
    weapon: firstBloodKill.weapon,
  } : null

  return {
    round_id: round.round_id,
    game_id: round.game_id,
    map_name: round.map_name,
    round_number: Number(round.round_number),
    team_a_id: round.team_a_id,
    team_b_id: round.team_b_id,
    team_a_score: Number(round.team_a_score),
    team_b_score: Number(round.team_b_score),
    winning_team_id: round.winning_team_id,
    winning_condition: round.winning_condition,
    spike_planted: round.spike_planted,
    spike_defused: round.spike_defused,
    duration_ms: Number(round.duration_ms),
    phase: round.phase,
    kill_timeline: killsData.map(k => ({
      game_time_ms: Number(k.game_time_ms),
      killer_id: k.killer_id,
      killer_name: k.killer_name,
      killer_agent: k.killer_agent || 'Unknown',
      victim_id: k.victim_id,
      victim_name: k.victim_name,
      victim_agent: k.victim_agent || 'Unknown',
      weapon: k.weapon,
      headshot: k.headshot,
      is_trade: k.is_trade,
      is_first_kill: k.is_first_kill,
    })),
    player_states: playerStatesData.map(p => ({
      player_id: p.player_id,
      player_name: p.player_name,
      team_id: p.team_id,
      agent: p.agent || 'Unknown',
      kills: Number(p.kills),
      deaths: Number(p.deaths),
      assists: Number(p.assists),
      first_kill: p.first_kill,
      first_death: p.first_death,
      traded: p.traded,
      clutch_situation: p.clutch_situation,
      clutch_won: p.clutch_won,
      loadout_value: Number(p.loadout_value),
    })),
    spike_events: (spikeEvents as unknown as Array<{
      game_time_ms: string | number
      event_type: string
      player_id: string
      player_name: string
      site: string
    }>).map(s => ({
      game_time_ms: Number(s.game_time_ms),
      event_type: s.event_type as 'plant' | 'defuse_start' | 'defuse' | 'explode',
      player_id: s.player_id,
      player_name: s.player_name,
      site: s.site,
    })),
    first_blood: firstBlood,
  }
}

/**
 * Find similar historical scenarios
 * First tries scenario_index table, then falls back to computing from rounds table
 */
export async function findSimilarScenarios(
  attackerAlive: number,
  defenderAlive: number,
  spikePlanted: boolean,
  mapName?: string,
  limit: number = 50
): Promise<ScenarioMatch[]> {
  const sql = getPostgresPool()
  const mapFilter = mapName || ''
  const hasMapFilter = !!mapName

  // First try scenario_index table
  const indexResult = await sql`
    SELECT
      si.round_id,
      si.game_id,
      si.map_name,
      si.round_number,
      si.attacker_alive,
      si.defender_alive,
      si.spike_planted,
      si.attacker_won,
      1.0 -
        (ABS(si.attacker_alive - ${attackerAlive}) * 0.15) -
        (ABS(si.defender_alive - ${defenderAlive}) * 0.15) -
        (CASE WHEN si.spike_planted != ${spikePlanted} THEN 0.3 ELSE 0 END) -
        (CASE WHEN ${hasMapFilter} AND si.map_name != ${mapFilter} THEN 0.1 ELSE 0 END)
      as similarity_score
    FROM public.scenario_index si
    WHERE si.attacker_alive BETWEEN ${attackerAlive - 1} AND ${attackerAlive + 1}
      AND si.defender_alive BETWEEN ${defenderAlive - 1} AND ${defenderAlive + 1}
      AND (NOT ${hasMapFilter} OR si.map_name = ${mapFilter})
    ORDER BY similarity_score DESC
    LIMIT ${limit}
  `

  if (indexResult.length > 0) {
    return indexResult.map(row => ({
      round_id: row.round_id,
      game_id: row.game_id,
      map_name: row.map_name,
      round_number: Number(row.round_number),
      attacker_alive: Number(row.attacker_alive),
      defender_alive: Number(row.defender_alive),
      spike_planted: row.spike_planted,
      attacker_won: row.attacker_won,
      similarity_score: Number(row.similarity_score),
    }))
  }

  // Fallback: Query rounds table directly
  // In VALORANT: rounds 1-12 team_a attacks, rounds 13-24 team_b attacks
  // team_a_alive/team_b_alive are end-of-round survivors (we need to invert for scenario matching)
  const roundsResult = await sql`
    WITH round_scenarios AS (
      SELECT
        r.id as round_id,
        r.game_id,
        g.map_name,
        r.round_number,
        s.team_a_id,
        s.team_b_id,
        r.winning_team_id,
        r.spike_planted,
        -- For end-of-round analysis, we look at final state
        -- Attackers: team_a for rounds 1-12, team_b for rounds 13-24
        CASE
          WHEN r.round_number <= 12 THEN COALESCE(r.team_a_alive, 0)
          ELSE COALESCE(r.team_b_alive, 0)
        END as attacker_alive,
        CASE
          WHEN r.round_number <= 12 THEN COALESCE(r.team_b_alive, 0)
          ELSE COALESCE(r.team_a_alive, 0)
        END as defender_alive,
        -- Determine if attackers won
        CASE
          WHEN r.round_number <= 12 THEN r.winning_team_id = s.team_a_id
          ELSE r.winning_team_id = s.team_b_id
        END as attacker_won
      FROM public.rounds r
      JOIN public.games g ON r.game_id = g.id
      JOIN public.series s ON g.series_id = s.id
      WHERE r.team_a_alive IS NOT NULL
        AND r.team_b_alive IS NOT NULL
    )
    SELECT
      rs.round_id,
      rs.game_id,
      rs.map_name,
      rs.round_number,
      rs.attacker_alive,
      rs.defender_alive,
      rs.spike_planted,
      rs.attacker_won,
      1.0 -
        (ABS(rs.attacker_alive - ${attackerAlive}) * 0.15) -
        (ABS(rs.defender_alive - ${defenderAlive}) * 0.15) -
        (CASE WHEN rs.spike_planted != ${spikePlanted} THEN 0.3 ELSE 0 END) -
        (CASE WHEN ${hasMapFilter} AND rs.map_name != ${mapFilter} THEN 0.1 ELSE 0 END)
      as similarity_score
    FROM round_scenarios rs
    WHERE rs.attacker_alive BETWEEN ${attackerAlive - 1} AND ${attackerAlive + 1}
      AND rs.defender_alive BETWEEN ${defenderAlive - 1} AND ${defenderAlive + 1}
      AND (NOT ${hasMapFilter} OR rs.map_name = ${mapFilter})
    ORDER BY similarity_score DESC
    LIMIT ${limit}
  `

  return roundsResult.map(row => ({
    round_id: row.round_id,
    game_id: row.game_id,
    map_name: row.map_name,
    round_number: Number(row.round_number),
    attacker_alive: Number(row.attacker_alive),
    defender_alive: Number(row.defender_alive),
    spike_planted: row.spike_planted,
    attacker_won: row.attacker_won,
    similarity_score: Number(row.similarity_score),
  }))
}

/**
 * Detect anti-strat signals (patterns opponent may have prepared for)
 */
export async function detectAntiStratSignals(
  seriesId: string,
  teamId: string
): Promise<{ signal: string; severity: 'critical' | 'moderate' | 'minor'; detail: string; implication: string; occurrences: number }[]> {
  const sql = getPostgresPool()
  // Find repeated first deaths by same player at similar times
  const repeatedDeaths = await sql`
    WITH first_death_rounds AS (
      SELECT
        prs.player_id,
        p.name as player_name,
        prs.round_id,
        g.map_name,
        ke.game_time_ms,
        r.winning_team_id,
        prs.team_id
      FROM public.player_round_stats prs
      JOIN public.players p ON prs.player_id = p.id
      JOIN public.rounds r ON prs.round_id = r.id
      JOIN public.games g ON r.game_id = g.id
      LEFT JOIN public.kill_events ke ON ke.round_id = r.id AND ke.victim_id = prs.player_id AND ke.is_first_kill = TRUE
      WHERE g.series_id = ${seriesId}
        AND prs.team_id = ${teamId}
        AND prs.first_death = TRUE
    )
    SELECT
      player_id,
      player_name,
      map_name,
      COUNT(*) as death_count,
      AVG(game_time_ms) as avg_death_time,
      COUNT(*) FILTER (WHERE winning_team_id != team_id)::float / COUNT(*) as loss_rate
    FROM first_death_rounds
    GROUP BY player_id, player_name, map_name
    HAVING COUNT(*) >= 3
    ORDER BY death_count DESC, loss_rate DESC
  `

  const signals: { signal: string; severity: 'critical' | 'moderate' | 'minor'; detail: string; implication: string; occurrences: number }[] = []

  for (const row of repeatedDeaths) {
    const lossRate = Number(row.loss_rate)
    const deathCount = Number(row.death_count)
    const avgTime = Number(row.avg_death_time)

    let severity: 'critical' | 'moderate' | 'minor' = 'minor'
    if (lossRate > 0.7 && deathCount >= 4) {
      severity = 'critical'
    } else if (lossRate > 0.6 && deathCount >= 3) {
      severity = 'moderate'
    }

    signals.push({
      signal: `Predictable ${row.player_name} first deaths on ${row.map_name}`,
      severity,
      detail: `${row.player_name} died first ${deathCount} times on ${row.map_name}, avg at ${(avgTime / 1000).toFixed(1)}s`,
      implication: `Opponent likely timing ${row.player_name}'s positioning - vary approach or fake elsewhere`,
      occurrences: deathCount,
    })
  }

  return signals.slice(0, 3) // Top 3
}

/**
 * Detect forced mistakes (errors caused by opponent pressure)
 */
export async function detectForcedMistakes(
  seriesId: string,
  teamId: string
): Promise<{ mistake: string; severity: 'critical' | 'high' | 'medium' | 'low'; detail: string; fix: string; rounds_impacted: number }[]> {
  const sql = getPostgresPool()
  // Find rounds with multiple untraded deaths
  const untradedPatterns = await sql`
    WITH round_trades AS (
      SELECT
        r.id as round_id,
        g.map_name,
        r.round_number,
        r.winning_team_id,
        COUNT(*) FILTER (WHERE prs.deaths > 0 AND prs.traded = FALSE AND prs.team_id = ${teamId}) as untraded_deaths
      FROM public.rounds r
      JOIN public.games g ON r.game_id = g.id
      JOIN public.player_round_stats prs ON prs.round_id = r.id
      WHERE g.series_id = ${seriesId}
      GROUP BY r.id, g.map_name, r.round_number, r.winning_team_id
    )
    SELECT
      map_name,
      SUM(CASE WHEN untraded_deaths >= 3 THEN 1 ELSE 0 END) as high_untraded_rounds,
      SUM(CASE WHEN untraded_deaths >= 3 AND winning_team_id != ${teamId} THEN 1 ELSE 0 END) as high_untraded_losses,
      AVG(untraded_deaths) as avg_untraded
    FROM round_trades
    GROUP BY map_name
    HAVING SUM(CASE WHEN untraded_deaths >= 3 THEN 1 ELSE 0 END) > 0
    ORDER BY high_untraded_losses DESC
  `

  const mistakes: { mistake: string; severity: 'critical' | 'high' | 'medium' | 'low'; detail: string; fix: string; rounds_impacted: number }[] = []

  for (const row of untradedPatterns) {
    const highUntradedRounds = Number(row.high_untraded_rounds)
    const highUntradedLosses = Number(row.high_untraded_losses)

    let severity: 'critical' | 'high' | 'medium' | 'low' = 'low'
    if (highUntradedLosses >= 4) {
      severity = 'critical'
    } else if (highUntradedLosses >= 3) {
      severity = 'high'
    } else if (highUntradedLosses >= 2) {
      severity = 'medium'
    }

    mistakes.push({
      mistake: `Isolated deaths on ${row.map_name}`,
      severity,
      detail: `Lost ${highUntradedLosses} rounds with 3+ untraded deaths on ${row.map_name}`,
      fix: 'Review positioning to ensure teammates can trade. Never isolate on contact.',
      rounds_impacted: highUntradedRounds,
    })
  }

  return mistakes.slice(0, 3) // Top 3
}
