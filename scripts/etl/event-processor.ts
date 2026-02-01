/**
 * JSONL Event Processor for VALORANT ETL
 * Parses GRID.gg event timeline files and extracts detailed match data
 */

import { createReadStream } from 'fs'
import { createInterface } from 'readline'

// Constants
const TRADE_WINDOW_MS = 5000  // 5 seconds for trade detection

// ==========================================
// TYPES
// ==========================================

export interface ProcessedSeries {
  seriesId: string
  tournamentId: string
  games: ProcessedGame[]
  players: Map<string, PlayerInfo>
  teams: Map<string, TeamInfo>
}

export interface PlayerInfo {
  id: string
  name: string
  teamId?: string
}

export interface TeamInfo {
  id: string
  name: string
}

export interface ProcessedGame {
  id: string
  seriesId: string
  sequenceNumber: number
  mapName: string
  teamAId?: string
  teamBId?: string
  teamAScore: number
  teamBScore: number
  winnerId?: string
  durationMs?: number
  rounds: ProcessedRound[]
}

export interface ProcessedRound {
  id: string  // gameId_roundNumber
  gameId: string
  roundNumber: number
  phase: 'pistol' | 'eco' | 'force' | 'full'
  winningTeamId?: string
  winningCondition?: 'elimination' | 'spike_defuse' | 'spike_explode' | 'time'
  spikePlanted: boolean
  spikeDefused: boolean
  teamAAlive: number
  teamBAlive: number
  teamALoadoutValue: number
  teamBLoadoutValue: number
  durationMs?: number
  playerStats: PlayerRoundStats[]
  killEvents: KillEvent[]
  spikeEvents: SpikeEvent[]
  abilityEvents: AbilityEvent[]
  orbEvents: OrbEvent[]
  killAssists: KillAssist[]
}

export interface PlayerRoundStats {
  roundId: string
  playerId: string
  teamId: string
  agent: string
  kills: number
  deaths: number
  assists: number
  damageDealt: number
  damageTaken: number
  firstKill: boolean
  firstDeath: boolean
  traded: boolean
  gotTrade: boolean
  clutchSituation: boolean
  clutchWon: boolean
  loadoutValue: number
  armor: number
  ultimatePoints: number
  ultimateUsed: boolean
  abilityCasts: number
}

export interface KillEvent {
  roundId: string
  gameTimeMs: number
  killerId?: string
  victimId: string
  weapon: string
  headshot: boolean
  wallbang: boolean
  isFirstKill: boolean
  isTrade: boolean
  isSelfKill: boolean
  killerPosX?: number
  killerPosY?: number
  victimPosX?: number
  victimPosY?: number
  killDistance?: number
  assistCount: number
  assisters: string[]
}

export interface SpikeEvent {
  roundId: string
  gameTimeMs: number
  eventType: 'plant_start' | 'plant_complete' | 'defuse_start' | 'defuse_complete' | 'explode'
  playerId?: string
  site?: string
  posX?: number
  posY?: number
}

export interface AbilityEvent {
  roundId: string
  playerId: string
  abilityName: string
  count: number
}

export interface OrbEvent {
  roundId: string
  gameTimeMs: number
  playerId: string
  orbType: string
  posX?: number
  posY?: number
}

export interface KillAssist {
  roundId: string
  killIndex: number
  killerId?: string
  assisterId: string
}

export interface ScenarioIndex {
  roundId: string
  gameId: string
  roundNumber: number
  attackerAlive: number
  defenderAlive: number
  spikePlanted: boolean
  timeRemainingMs?: number
  attackerEconomy: number
  defenderEconomy: number
  attackerWon: boolean
  mapName: string
  tournamentId: string
}

// ==========================================
// EVENT PROCESSOR CLASS
// ==========================================

export class EventProcessor {
  // State tracking during processing
  private currentSeriesId: string = ''
  private currentGameId: string = ''
  private currentRoundNumber: number = 0
  private currentMapName: string = ''
  private tournamentId: string = ''

  // Team/player state
  private teamSides: Map<string, 'attack' | 'defense'> = new Map()
  private playerTeams: Map<string, string> = new Map()
  private playerAgents: Map<string, string> = new Map()
  private playerLoadouts: Map<string, { value: number; armor: number }> = new Map()
  private playerUltPoints: Map<string, number> = new Map()

  // Round state
  private roundKills: KillEvent[] = []
  private roundSpikeEvents: SpikeEvent[] = []
  private roundOrbEvents: OrbEvent[] = []
  private roundAbilities: Map<string, Map<string, number>> = new Map()  // playerId -> ability -> count
  private roundPlayerDamage: Map<string, { dealt: number; taken: number }> = new Map()
  private roundUltUsed: Set<string> = new Set()
  private spikePlanted: boolean = false
  private spikeSite: string = ''

  // Accumulated data
  private games: ProcessedGame[] = []
  private currentGame: ProcessedGame | null = null
  private players: Map<string, PlayerInfo> = new Map()
  private teams: Map<string, TeamInfo> = new Map()

  async processFile(filePath: string, seriesId: string, tournamentId: string): Promise<ProcessedSeries> {
    this.currentSeriesId = seriesId
    this.tournamentId = tournamentId
    this.reset()

    const fileStream = createReadStream(filePath)
    const rl = createInterface({ input: fileStream, crlfDelay: Infinity })

    for await (const line of rl) {
      if (!line.trim()) continue
      try {
        const message = JSON.parse(line)
        this.processMessage(message)
      } catch (e) {
        // Skip malformed lines
      }
    }

    // Finalize last game if needed
    if (this.currentGame) {
      this.games.push(this.currentGame)
    }

    return {
      seriesId,
      tournamentId,
      games: this.games,
      players: this.players,
      teams: this.teams,
    }
  }

  private reset() {
    this.games = []
    this.currentGame = null
    this.players.clear()
    this.teams.clear()
    this.resetRoundState()
  }

  private resetRoundState() {
    this.roundKills = []
    this.roundSpikeEvents = []
    this.roundOrbEvents = []
    this.roundAbilities.clear()
    this.roundPlayerDamage.clear()
    this.roundUltUsed.clear()
    this.spikePlanted = false
    this.spikeSite = ''
  }

  private processMessage(message: any) {
    const events = message.events || []
    for (const event of events) {
      this.processEvent(event, message.occurredAt)
    }
  }

  private processEvent(event: any, timestamp: string) {
    const type = event.type
    const actor = event.actor
    const target = event.target
    const seriesState = event.seriesState

    switch (type) {
      case 'tournament-started-series':
        this.handleSeriesStart(seriesState)
        break
      case 'series-started-game':
        this.handleGameStart(event, seriesState)
        break
      case 'game-started-round':
        this.handleRoundStart(event, seriesState)
        break
      case 'player-killed-player':
        this.handleKill(event, actor, target)
        break
      case 'player-selfkilled-player':
        this.handleSelfKill(event, actor)
        break
      case 'player-completed-plantBomb':
        this.handleSpikePlant(event, actor)
        break
      case 'player-completed-defuseBomb':
        this.handleSpikeDefuse(event, actor)
        break
      case 'player-completed-explodeBomb':
        this.handleSpikeExplode(event)
        break
      case 'player-used-ability':
        this.handleAbilityUse(event, actor)
        break
      case 'player-used-ultimate':
        this.handleUltimateUse(event, actor)
        break
      case 'player-pickedUp-item':
        this.handleOrbPickup(event, actor)
        break
      case 'team-won-round':
        this.handleRoundEnd(event, actor, seriesState)
        break
      case 'team-won-game':
        this.handleGameEnd(event, actor, seriesState)
        break
      case 'series-ended-game':
        this.handleSeriesGameEnd(event, seriesState)
        break
    }
  }

  private handleSeriesStart(seriesState: any) {
    if (!seriesState?.teams) return

    for (const team of seriesState.teams) {
      if (team.id && team.name) {
        this.teams.set(team.id, { id: team.id, name: team.name })
      }
      for (const player of team.players || []) {
        if (player.id) {
          this.players.set(player.id, {
            id: player.id,
            name: player.name || player.id,
            teamId: team.id,
          })
          this.playerTeams.set(player.id, team.id)
        }
      }
    }
  }

  private handleGameStart(event: any, seriesState: any) {
    // Save previous game
    if (this.currentGame) {
      this.games.push(this.currentGame)
    }

    const gameState = seriesState?.games?.slice(-1)[0]
    const gameId = gameState?.id || event.target?.id || `game_${this.games.length + 1}`
    const mapName = gameState?.map?.name || event.target?.state?.map?.name || 'unknown'

    this.currentGameId = gameId
    this.currentMapName = mapName
    this.currentRoundNumber = 0

    // Get team IDs
    const teamIds = Array.from(this.teams.keys())

    this.currentGame = {
      id: gameId,
      seriesId: this.currentSeriesId,
      sequenceNumber: this.games.length + 1,
      mapName,
      teamAId: teamIds[0],
      teamBId: teamIds[1],
      teamAScore: 0,
      teamBScore: 0,
      winnerId: undefined,
      rounds: [],
    }
  }

  private handleRoundStart(event: any, seriesState: any) {
    this.currentRoundNumber++
    this.resetRoundState()

    // Extract player loadouts and agents from round start state
    const gameState = seriesState?.games?.slice(-1)[0]
    if (gameState?.teams) {
      for (const team of gameState.teams) {
        // Track team sides
        const side = team.side?.toLowerCase() as 'attack' | 'defense'
        if (side) {
          this.teamSides.set(team.id, side)
        }

        for (const player of team.players || []) {
          if (player.id) {
            // Agent
            if (player.character?.name || player.characterName) {
              this.playerAgents.set(player.id, player.character?.name || player.characterName)
            }
            // Loadout
            const loadoutValue = player.loadoutValue || player.economy?.loadoutValue || 0
            const armor = player.armor?.type === 'heavy' ? 50 : player.armor?.type === 'light' ? 25 : 0
            this.playerLoadouts.set(player.id, { value: loadoutValue, armor })
            // Ultimate points
            if (player.ultimatePoints !== undefined) {
              this.playerUltPoints.set(player.id, player.ultimatePoints)
            }
          }
        }
      }
    }
  }

  private handleKill(event: any, actor: any, target: any) {
    const gameTimeMs = event.gameTime?.milliseconds || 0
    const killerId = actor?.id
    const victimId = target?.id

    if (!victimId) return

    // Extract positions
    const killerPos = actor?.stateDelta?.position || actor?.state?.position
    const victimPos = target?.stateDelta?.position || target?.state?.position

    // Extract weapon
    const weaponDelta = actor?.stateDelta?.weaponKills || {}
    const weaponState = actor?.state?.weaponKills || {}
    const weapon = Object.keys(weaponDelta)[0] || Object.keys(weaponState).slice(-1)[0] || 'unknown'

    // Extract kill details
    const headshot = actor?.stateDelta?.headshots > 0 || event.headshot === true
    const wallbang = event.wallbang === true

    // Calculate distance
    let killDistance: number | undefined
    if (killerPos && victimPos) {
      const dx = (killerPos.x || 0) - (victimPos.x || 0)
      const dy = (killerPos.y || 0) - (victimPos.y || 0)
      killDistance = Math.sqrt(dx * dx + dy * dy)
    }

    // Track damage
    const damage = this.roundPlayerDamage.get(victimId) || { dealt: 0, taken: 0 }
    damage.taken += 150  // Death = max HP
    this.roundPlayerDamage.set(victimId, damage)

    if (killerId) {
      const killerDamage = this.roundPlayerDamage.get(killerId) || { dealt: 0, taken: 0 }
      killerDamage.dealt += 150
      this.roundPlayerDamage.set(killerId, killerDamage)
    }

    // Extract assisters from killAssistsReceivedFromPlayer
    const assisters: string[] = []
    const gameStateDelta = actor?.stateDelta?.game || {}
    const gameState = actor?.state?.game || {}
    const assistsData = gameStateDelta.killAssistsReceivedFromPlayer || gameState.killAssistsReceivedFromPlayer || []
    for (const assist of assistsData) {
      if (assist.playerId) assisters.push(assist.playerId)
    }

    const killEvent: KillEvent = {
      roundId: `${this.currentGameId}_${this.currentRoundNumber}`,
      gameTimeMs,
      killerId,
      victimId,
      weapon,
      headshot,
      wallbang,
      isFirstKill: this.roundKills.length === 0,
      isTrade: false,  // Computed later
      isSelfKill: false,
      killerPosX: killerPos?.x,
      killerPosY: killerPos?.y,
      victimPosX: victimPos?.x,
      victimPosY: victimPos?.y,
      killDistance,
      assistCount: assisters.length,
      assisters,
    }

    // Trade detection
    if (killerId && this.roundKills.length > 0) {
      for (const prevKill of this.roundKills.slice().reverse()) {
        if (gameTimeMs - prevKill.gameTimeMs > TRADE_WINDOW_MS) break
        // Check if killer was killed previously
        if (prevKill.victimId === killerId) {
          killEvent.isTrade = true
          break
        }
      }
    }

    this.roundKills.push(killEvent)
  }

  private handleSelfKill(event: any, actor: any) {
    const gameTimeMs = event.gameTime?.milliseconds || 0
    const victimId = actor?.id

    if (!victimId) return

    const pos = actor?.stateDelta?.position || actor?.state?.position

    const killEvent: KillEvent = {
      roundId: `${this.currentGameId}_${this.currentRoundNumber}`,
      gameTimeMs,
      killerId: undefined,
      victimId,
      weapon: 'self',
      headshot: false,
      wallbang: false,
      isFirstKill: this.roundKills.length === 0,
      isTrade: false,
      isSelfKill: true,
      victimPosX: pos?.x,
      victimPosY: pos?.y,
      assistCount: 0,
      assisters: [],
    }

    this.roundKills.push(killEvent)
  }

  private handleSpikePlant(event: any, actor: any) {
    const gameTimeMs = event.gameTime?.milliseconds || 0
    const playerId = actor?.id
    const pos = actor?.stateDelta?.position || actor?.state?.position
    const site = event.site || event.target?.state?.site || 'unknown'

    this.spikePlanted = true
    this.spikeSite = site

    this.roundSpikeEvents.push({
      roundId: `${this.currentGameId}_${this.currentRoundNumber}`,
      gameTimeMs,
      eventType: 'plant_complete',
      playerId,
      site,
      posX: pos?.x,
      posY: pos?.y,
    })
  }

  private handleSpikeDefuse(event: any, actor: any) {
    const gameTimeMs = event.gameTime?.milliseconds || 0
    const playerId = actor?.id

    this.roundSpikeEvents.push({
      roundId: `${this.currentGameId}_${this.currentRoundNumber}`,
      gameTimeMs,
      eventType: 'defuse_complete',
      playerId,
    })
  }

  private handleSpikeExplode(event: any) {
    const gameTimeMs = event.gameTime?.milliseconds || 0

    this.roundSpikeEvents.push({
      roundId: `${this.currentGameId}_${this.currentRoundNumber}`,
      gameTimeMs,
      eventType: 'explode',
    })
  }

  private handleAbilityUse(event: any, actor: any) {
    const playerId = actor?.id
    if (!playerId) return

    const abilityName = event.ability?.name || event.target?.state?.ability?.name || 'unknown'

    if (!this.roundAbilities.has(playerId)) {
      this.roundAbilities.set(playerId, new Map())
    }
    const playerAbilities = this.roundAbilities.get(playerId)!
    playerAbilities.set(abilityName, (playerAbilities.get(abilityName) || 0) + 1)
  }

  private handleUltimateUse(event: any, actor: any) {
    const playerId = actor?.id
    if (playerId) {
      this.roundUltUsed.add(playerId)
    }
  }

  private handleOrbPickup(event: any, actor: any) {
    const playerId = actor?.id
    if (!playerId) return

    const gameTimeMs = event.gameTime?.milliseconds || 0
    const pos = actor?.stateDelta?.position || actor?.state?.position

    // Extract orb type from event
    const item = event.target?.state?.item || event.target?.stateDelta?.item || {}
    const orbType = item.name || item.type || 'unknown'

    // Only track orb pickups (ult orbs, etc.)
    if (orbType.toLowerCase().includes('orb') || orbType.toLowerCase().includes('ultimate')) {
      this.roundOrbEvents.push({
        roundId: `${this.currentGameId}_${this.currentRoundNumber}`,
        gameTimeMs,
        playerId,
        orbType,
        posX: pos?.x,
        posY: pos?.y,
      })
    }
  }

  private handleRoundEnd(event: any, actor: any, seriesState: any) {
    if (!this.currentGame) return

    const roundId = `${this.currentGameId}_${this.currentRoundNumber}`
    const winningTeamId = actor?.id
    const winCondition = this.determineWinCondition()

    // Get team alive counts and loadout values
    const gameState = seriesState?.games?.slice(-1)[0]
    let teamAAlive = 0, teamBAlive = 0
    let teamALoadout = 0, teamBLoadout = 0

    const teamIds = Array.from(this.teams.keys())
    const teamAId = teamIds[0]
    const teamBId = teamIds[1]

    if (gameState?.teams) {
      for (const team of gameState.teams) {
        let aliveCount = 0
        let loadoutTotal = 0
        for (const player of team.players || []) {
          if (player.alive !== false) aliveCount++
          loadoutTotal += player.loadoutValue || 0
        }
        if (team.id === teamAId) {
          teamAAlive = aliveCount
          teamALoadout = loadoutTotal
        } else if (team.id === teamBId) {
          teamBAlive = aliveCount
          teamBLoadout = loadoutTotal
        }
      }
    }

    // Determine round phase based on loadouts
    const avgLoadout = (teamALoadout + teamBLoadout) / 10  // 5 players per team
    const phase = this.classifyRoundPhase(this.currentRoundNumber, avgLoadout)

    // Build player round stats
    const playerStats: PlayerRoundStats[] = []
    for (const [playerId, player] of this.players) {
      const teamId = this.playerTeams.get(playerId) || ''
      const agent = this.playerAgents.get(playerId) || 'unknown'
      const loadout = this.playerLoadouts.get(playerId) || { value: 0, armor: 0 }
      const damage = this.roundPlayerDamage.get(playerId) || { dealt: 0, taken: 0 }

      // Calculate kills/deaths/assists for this round
      let kills = 0, deaths = 0, assists = 0
      let firstKill = false, firstDeath = false
      let traded = false, gotTrade = false

      for (let i = 0; i < this.roundKills.length; i++) {
        const kill = this.roundKills[i]
        if (kill.killerId === playerId) {
          kills++
          if (i === 0) firstKill = true
          if (kill.isTrade) gotTrade = true
        }
        if (kill.victimId === playerId) {
          deaths++
          if (i === 0) firstDeath = true
          // Check if death was traded
          for (let j = i + 1; j < this.roundKills.length; j++) {
            const nextKill = this.roundKills[j]
            if (nextKill.gameTimeMs - kill.gameTimeMs > TRADE_WINDOW_MS) break
            if (nextKill.victimId === kill.killerId) {
              traded = true
              break
            }
          }
        }
        if (kill.assisters.includes(playerId)) {
          assists++
        }
      }

      // Clutch detection
      const { clutchSituation, clutchWon } = this.detectClutch(playerId, teamId, winningTeamId)

      // Ability casts
      const playerAbilities = this.roundAbilities.get(playerId)
      let abilityCasts = 0
      if (playerAbilities) {
        for (const count of playerAbilities.values()) {
          abilityCasts += count
        }
      }

      playerStats.push({
        roundId,
        playerId,
        teamId,
        agent,
        kills,
        deaths,
        assists,
        damageDealt: damage.dealt,
        damageTaken: damage.taken,
        firstKill,
        firstDeath,
        traded,
        gotTrade,
        clutchSituation,
        clutchWon,
        loadoutValue: loadout.value,
        armor: loadout.armor,
        ultimatePoints: this.playerUltPoints.get(playerId) || 0,
        ultimateUsed: this.roundUltUsed.has(playerId),
        abilityCasts,
      })
    }

    // Build ability events for DB
    const abilityEvents: AbilityEvent[] = []
    for (const [playerId, abilities] of this.roundAbilities) {
      for (const [abilityName, count] of abilities) {
        abilityEvents.push({
          roundId,
          playerId,
          abilityName,
          count,
        })
      }
    }

    // Build kill assists from kill events
    const killAssists: KillAssist[] = []
    for (let killIndex = 0; killIndex < this.roundKills.length; killIndex++) {
      const kill = this.roundKills[killIndex]
      for (const assisterId of kill.assisters) {
        killAssists.push({
          roundId,
          killIndex,
          killerId: kill.killerId,
          assisterId,
        })
      }
    }

    // Update game scores
    if (winningTeamId === teamAId) {
      this.currentGame.teamAScore++
    } else if (winningTeamId === teamBId) {
      this.currentGame.teamBScore++
    }

    // Create processed round
    const round: ProcessedRound = {
      id: roundId,
      gameId: this.currentGameId,
      roundNumber: this.currentRoundNumber,
      phase,
      winningTeamId,
      winningCondition: winCondition,
      spikePlanted: this.spikePlanted,
      spikeDefused: this.roundSpikeEvents.some(e => e.eventType === 'defuse_complete'),
      teamAAlive,
      teamBAlive,
      teamALoadoutValue: teamALoadout,
      teamBLoadoutValue: teamBLoadout,
      playerStats,
      killEvents: this.roundKills,
      spikeEvents: this.roundSpikeEvents,
      abilityEvents,
      orbEvents: this.roundOrbEvents,
      killAssists,
    }

    this.currentGame.rounds.push(round)
  }

  private handleGameEnd(event: any, actor: any, seriesState: any) {
    if (this.currentGame) {
      this.currentGame.winnerId = actor?.id
    }
  }

  private handleSeriesGameEnd(event: any, seriesState: any) {
    // Game already added in handleRoundEnd or will be added when next game starts
  }

  private determineWinCondition(): 'elimination' | 'spike_defuse' | 'spike_explode' | 'time' {
    const defused = this.roundSpikeEvents.some(e => e.eventType === 'defuse_complete')
    const exploded = this.roundSpikeEvents.some(e => e.eventType === 'explode')

    if (exploded) return 'spike_explode'
    if (defused) return 'spike_defuse'

    // Check if all players on one team died
    const teamDeaths = new Map<string, number>()
    for (const kill of this.roundKills) {
      const teamId = this.playerTeams.get(kill.victimId)
      if (teamId) {
        teamDeaths.set(teamId, (teamDeaths.get(teamId) || 0) + 1)
      }
    }

    for (const [teamId, deaths] of teamDeaths) {
      if (deaths >= 5) return 'elimination'
    }

    return 'time'
  }

  private classifyRoundPhase(roundNumber: number, avgLoadout: number): 'pistol' | 'eco' | 'force' | 'full' {
    if (roundNumber === 1 || roundNumber === 13) return 'pistol'
    if (avgLoadout < 5000) return 'eco'      // ~1000 per player
    if (avgLoadout < 15000) return 'force'   // ~3000 per player
    return 'full'
  }

  private detectClutch(playerId: string, playerTeamId: string, winningTeamId?: string): { clutchSituation: boolean; clutchWon: boolean } {
    // Simplified clutch detection - check if player was last alive on team
    let teammatesAlive = 0
    let enemiesAlive = 0

    const deadPlayers = new Set(this.roundKills.map(k => k.victimId))

    for (const [pid, info] of this.players) {
      if (pid === playerId) continue
      if (deadPlayers.has(pid)) continue

      if (info.teamId === playerTeamId) {
        teammatesAlive++
      } else {
        enemiesAlive++
      }
    }

    // Clutch = player is last alive on team with enemies still alive
    const clutchSituation = teammatesAlive === 0 && enemiesAlive > 0 && !deadPlayers.has(playerId)
    const clutchWon = clutchSituation && winningTeamId === playerTeamId

    return { clutchSituation, clutchWon }
  }
}

export function buildScenarioIndices(games: ProcessedGame[], tournamentId: string): ScenarioIndex[] {
  const scenarios: ScenarioIndex[] = []

  for (const game of games) {
    for (const round of game.rounds) {
      // Determine attacker/defender based on team sides (simplified - use first team as attacker pre-switch)
      const attackerIsTeamA = round.roundNumber <= 12
      const attackerAlive = attackerIsTeamA ? round.teamAAlive : round.teamBAlive
      const defenderAlive = attackerIsTeamA ? round.teamBAlive : round.teamAAlive
      const attackerEconomy = attackerIsTeamA ? round.teamALoadoutValue : round.teamBLoadoutValue
      const defenderEconomy = attackerIsTeamA ? round.teamBLoadoutValue : round.teamALoadoutValue
      const attackerTeamId = attackerIsTeamA ? game.teamAId : game.teamBId
      const attackerWon = round.winningTeamId === attackerTeamId

      scenarios.push({
        roundId: round.id,
        gameId: game.id,
        roundNumber: round.roundNumber,
        attackerAlive,
        defenderAlive,
        spikePlanted: round.spikePlanted,
        attackerEconomy,
        defenderEconomy,
        attackerWon,
        mapName: game.mapName,
        tournamentId,
      })
    }
  }

  return scenarios
}
