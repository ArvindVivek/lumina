import { createServerClient } from '@/lib/supabase/server'
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
  const supabase = createServerClient()

  // Get series summary
  const { data: summaryData, error: summaryError } = await supabase.rpc('query_series_summary', {
    p_series_id: seriesId,
    p_team_id: teamId,
  })

  if (summaryError || !summaryData || summaryData.length === 0) {
    console.error('Error querying series summary:', summaryError)
    return null
  }

  const row = summaryData[0]
  const isTeamA = row.team_a_id === teamId
  const teamScore = isTeamA ? Number(row.team_a_wins) : Number(row.team_b_wins)
  const opponentScore = isTeamA ? Number(row.team_b_wins) : Number(row.team_a_wins)
  const won = row.winner_id === teamId

  // Get map details
  const { data: mapsData, error: mapsError } = await supabase.rpc('query_series_maps', {
    p_series_id: seriesId,
  })

  if (mapsError) {
    console.error('Error querying series maps:', mapsError)
    return null
  }

  return {
    series_id: seriesId,
    team_id: teamId,
    team_name: isTeamA ? row.team_a_name : row.team_b_name,
    opponent_id: isTeamA ? row.team_b_id : row.team_a_id,
    opponent_name: isTeamA ? row.team_b_name : row.team_a_name,
    result: won ? 'win' : 'loss',
    score: `${teamScore}-${opponentScore}`,
    total_rounds: Number(row.total_rounds) || 0,
    total_maps: Number(row.total_maps),
    maps: (mapsData || []).map((m: any) => ({
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
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_map_metrics', {
    p_series_id: seriesId,
    p_team_id: teamId,
  })

  if (error) {
    console.error('Error querying map metrics:', error)
    return []
  }

  return (data || []).map((row: any) => {
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
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_player_opening_duels', {
    p_series_id: seriesId,
    p_team_id: teamId,
  })

  if (error) {
    console.error('Error querying player opening duels:', error)
    return []
  }

  return (data || []).map((row: any) => ({
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
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('query_rounds_for_review', {
    p_series_id: seriesId,
    p_team_id: teamId,
  })

  if (error) {
    console.error('Error querying rounds for review:', error)
    return []
  }

  return (data || []).map((row: any) => {
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
  const supabase = createServerClient()

  // Get round basic info
  const { data: roundData, error: roundError } = await supabase
    .from('rounds')
    .select(`
      id,
      game_id,
      round_number,
      winning_team_id,
      winning_condition,
      spike_planted,
      spike_defused,
      duration_ms,
      phase,
      games (
        map_name,
        team_a_score,
        team_b_score,
        series (
          team_a_id,
          team_b_id
        )
      )
    `)
    .eq('id', roundId)
    .single()

  if (roundError || !roundData) {
    console.error('Error querying round context:', roundError)
    return null
  }

  // Get kill timeline
  const { data: killsData, error: killsError } = await supabase
    .from('kill_events')
    .select(`
      game_time_ms,
      killer_id,
      victim_id,
      weapon,
      headshot,
      is_trade,
      is_first_kill,
      killer:players!kill_events_killer_id_fkey (
        name
      ),
      victim:players!kill_events_victim_id_fkey (
        name
      )
    `)
    .eq('round_id', roundId)
    .order('game_time_ms')

  if (killsError) {
    console.error('Error querying kill events:', killsError)
  }

  // Get player states
  const { data: playerStatesData, error: playerStatesError } = await supabase
    .from('player_round_stats')
    .select(`
      player_id,
      team_id,
      agent,
      kills,
      deaths,
      assists,
      first_kill,
      first_death,
      traded,
      clutch_situation,
      clutch_won,
      loadout_value,
      players (
        name
      )
    `)
    .eq('round_id', roundId)

  if (playerStatesError) {
    console.error('Error querying player states:', playerStatesError)
  }

  // Get spike events
  const { data: spikeEventsData, error: spikeEventsError } = await supabase
    .from('spike_events')
    .select(`
      game_time_ms,
      event_type,
      player_id,
      site,
      players (
        name
      )
    `)
    .eq('round_id', roundId)
    .order('game_time_ms')

  if (spikeEventsError) {
    console.error('Error querying spike events:', spikeEventsError)
  }

  // Process kill events to get agent info
  const killsWithAgents = await Promise.all(
    (killsData || []).map(async (kill) => {
      const { data: killerStats } = await supabase
        .from('player_round_stats')
        .select('agent')
        .eq('round_id', roundId)
        .eq('player_id', kill.killer_id)
        .single()

      const { data: victimStats } = await supabase
        .from('player_round_stats')
        .select('agent')
        .eq('round_id', roundId)
        .eq('player_id', kill.victim_id)
        .single()

      return {
        ...kill,
        killer_agent: killerStats?.agent || 'Unknown',
        victim_agent: victimStats?.agent || 'Unknown',
      }
    })
  )

  const firstBloodKill = killsWithAgents.find(k => k.is_first_kill)
  const firstBlood: FirstBlood | null = firstBloodKill ? {
    player_id: firstBloodKill.killer_id,
    player_name: (firstBloodKill.killer as any)?.name || '',
    team_id: playerStatesData?.find(p => p.player_id === firstBloodKill.killer_id)?.team_id || '',
    time_ms: Number(firstBloodKill.game_time_ms),
    weapon: firstBloodKill.weapon,
  } : null

  const game = roundData.games as any
  const series = game?.series as any

  return {
    round_id: roundData.id,
    game_id: roundData.game_id,
    map_name: game?.map_name || '',
    round_number: Number(roundData.round_number),
    team_a_id: series?.team_a_id || '',
    team_b_id: series?.team_b_id || '',
    team_a_score: Number(game?.team_a_score) || 0,
    team_b_score: Number(game?.team_b_score) || 0,
    winning_team_id: roundData.winning_team_id,
    winning_condition: roundData.winning_condition,
    spike_planted: roundData.spike_planted,
    spike_defused: roundData.spike_defused,
    duration_ms: Number(roundData.duration_ms),
    phase: roundData.phase,
    kill_timeline: killsWithAgents.map(k => ({
      game_time_ms: Number(k.game_time_ms),
      killer_id: k.killer_id,
      killer_name: (k.killer as any)?.name || '',
      killer_agent: k.killer_agent || 'Unknown',
      victim_id: k.victim_id,
      victim_name: (k.victim as any)?.name || '',
      victim_agent: k.victim_agent || 'Unknown',
      weapon: k.weapon,
      headshot: k.headshot,
      is_trade: k.is_trade,
      is_first_kill: k.is_first_kill,
    })),
    player_states: (playerStatesData || []).map(p => ({
      player_id: p.player_id,
      player_name: (p.players as any)?.name || '',
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
    spike_events: (spikeEventsData || []).map(s => ({
      game_time_ms: Number(s.game_time_ms),
      event_type: s.event_type as 'plant' | 'defuse_start' | 'defuse' | 'explode',
      player_id: s.player_id,
      player_name: (s.players as any)?.name || '',
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
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('find_similar_scenarios', {
    p_attacker_alive: attackerAlive,
    p_defender_alive: defenderAlive,
    p_spike_planted: spikePlanted,
    p_map_name: mapName || null,
    p_limit: limit,
  })

  if (error) {
    console.error('Error finding similar scenarios:', error)
    return []
  }

  return (data || []).map((row: any) => ({
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
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('detect_anti_strat_signals', {
    p_series_id: seriesId,
    p_team_id: teamId,
  })

  if (error) {
    console.error('Error detecting anti-strat signals:', error)
    return []
  }

  const signals: { signal: string; severity: 'critical' | 'moderate' | 'minor'; detail: string; implication: string; occurrences: number }[] = []

  for (const row of (data || [])) {
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
  const supabase = createServerClient()

  const { data, error } = await supabase.rpc('detect_forced_mistakes', {
    p_series_id: seriesId,
    p_team_id: teamId,
  })

  if (error) {
    console.error('Error detecting forced mistakes:', error)
    return []
  }

  const mistakes: { mistake: string; severity: 'critical' | 'high' | 'medium' | 'low'; detail: string; fix: string; rounds_impacted: number }[] = []

  for (const row of (data || [])) {
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
