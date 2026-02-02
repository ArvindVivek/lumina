import { NextRequest } from "next/server"
import OpenAI from "openai"
import { getPostgresPool } from "@/lib/supabase/server"

// Helper to format visible data for chat context
function formatVisibleData(data: unknown, depth = 0): string {
  if (depth > 3) return "[nested data]"

  if (data === null || data === undefined) {
    return "N/A"
  }

  if (typeof data === "string" || typeof data === "number" || typeof data === "boolean") {
    return String(data)
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return "[]"
    if (data.length > 10) {
      const sample = data.slice(0, 5)
      return sample.map(item => formatVisibleData(item, depth + 1)).join("\n") + `\n... and ${data.length - 5} more items`
    }
    return data.map(item => formatVisibleData(item, depth + 1)).join("\n")
  }

  if (typeof data === "object") {
    const obj = data as Record<string, unknown>
    const entries = Object.entries(obj)

    if (entries.length === 0) return "{}"

    return entries
      .map(([key, value]) => {
        const formattedKey = key.replace(/_/g, " ").replace(/([A-Z])/g, " $1").trim()
        if (typeof value === "object" && value !== null) {
          return `- ${formattedKey}:\n${formatVisibleData(value, depth + 1).split("\n").map(l => "  " + l).join("\n")}`
        }
        return `- ${formattedKey}: ${formatVisibleData(value, depth + 1)}`
      })
      .join("\n")
  }

  return String(data)
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
})

const MODEL = process.env.OPENAI_MODEL || "gpt-4o"

// Database schema for context
const DATABASE_SCHEMA = `
## Lumina VALORANT Analytics Database Schema

### Core Tables:

**tournaments** - Professional tournament information
- id (text, PK), name (text), start_date, end_date

**teams** - Esports team information
- id (text, PK), name (text), short_name (text)

**players** - Professional player information
- id (text, PK), name (text), team_id (FK to teams), handle (text)

**series** - Match series (Bo1, Bo3, Bo5)
- id (text, PK), tournament_id (FK), team_a_id (FK), team_b_id (FK), winner_id, format, start_time, processed (bool)

**games** - Individual maps within a series
- id (text, PK), series_id (FK), sequence_number (int), map_name (text), team_a_score (int), team_b_score (int), winner_id

**rounds** - Round-by-round data
- id (text, PK), game_id (FK), round_number (int), winning_team_id, winning_condition (text: elimination/spike_detonation/spike_defuse/time_expired), spike_planted (bool), spike_defused (bool), team_a_loadout_value (int), team_b_loadout_value (int)

**player_round_stats** - Per-player per-round statistics
- id (bigint, PK), round_id (FK), player_id (FK), team_id (FK), agent (text), kills (int), deaths (int), assists (int), first_kill (bool), first_death (bool), clutch_situation (bool), clutch_won (bool), loadout_value (int), armor (int), ability_casts (int), traded (bool), traded_by_teammate (bool)

**kill_events** - Individual kill events
- id (bigint, PK), round_id (FK), killer_id (FK), victim_id (FK), weapon (text), is_headshot (bool), is_wallbang (bool), is_first_kill (bool), game_time_ms (int), killer_team_id, victim_team_id

**spike_events** - Spike plant/defuse events
- id (bigint, PK), round_id (FK), event_type (plant/defuse_start/defuse_complete), player_id, game_time_ms (int), site (text: A/B/C)

### Key Metrics & Analysis Queries Available:
- Player performance: ACS, K/D ratio, headshot %, first blood rate
- Trading efficiency: How often deaths are traded within 5 seconds
- Clutch performance: Win rate in 1vX situations
- Economy management: Win rates on eco/force/full buy rounds
- Pistol round performance: Win rate on rounds 1 and 13
- Opening duels: First kill/first death statistics
- Agent performance: Stats by agent played
- Site preferences: Attack/defense tendencies by site
`

// System prompt for VALORANT analytics assistant
const systemPrompt = `You are an expert VALORANT esports analyst and coach for Lumina. You provide specific, data-driven insights based on actual match data.

${DATABASE_SCHEMA}

## CRITICAL: DATA-SPECIFIC RESPONSES ONLY

You MUST ONLY provide insights backed by SPECIFIC numbers from the data. NEVER give generic advice.

### MANDATORY: Include Numbers in EVERY Response
- ❌ BAD: "They struggle on this map"
- ✅ GOOD: "32% win rate on Lotus (2W-6L across 8 matches)"

- ❌ BAD: "Improve your trading"
- ✅ GOOD: "Only 28% trade rate (14/50 deaths traded) - below the 40% average"

- ❌ BAD: "Consider saving economy"
- ✅ GOOD: "Round 12: Lost with 2,400 eco vs 15,000. Saving would give 4,150 for Round 13 pistol"

### Always Include:
- Win/loss records (e.g., 3W-7L)
- Percentages with sample sizes (e.g., 45% across 20 rounds)
- Round counts and specific round numbers
- Player-specific statistics with context

## STRUCTURED RESPONSE FORMAT

Use these block formats for clear, scannable responses:

### Stats (key metrics):
:::stat{label="Win Rate" value="67%" trend="up" confidence="HIGH"}

### Insights (analysis findings):
:::insight{type="weakness" title="Poor First Blood Rate" priority="high"}
**FarBang** has -5 FK/FD differential (8 first kills, 13 first deaths) indicating predictable positioning.

### Counter-Strategies (specific recommendations):
:::counter{confidence="HIGH" title="Stack B Site Defense"}
Only 28% attack success rate on B (14/50 rounds). Position **2 players B** in first 30 seconds.

### Player Cards:
:::player{name="TenZ" role="Duelist" acs="267" kd="1.34" agents="Jett, Raze, Iso"}

### Recommendations:
:::recommendation{priority="high" category="Economy"}
Save on Round 11 (down 4-6, eco 1,900). Full buy Round 12 gives 78% expected win rate vs force.

### Round Analysis:
:::round{number="12" outcome="loss" economy="eco" spike="planted"}
Lost 2v4 retake. **Mada** died first (untraded) at 1:42 giving up site control.

### Map Analysis:
:::map{name="Bind" score="11-13" winRate="45%"}
Strong on defense (8-4) but only 3-9 on attack. Site A takes have 25% success rate.

## CONTEXT USAGE

You have access to:
- **Page IDs**: seriesId, teamId, playerId - use these for targeted queries
- **VISIBLE DATA**: Data currently shown on screen - reference this directly
- **Tools**: Database queries for additional data

When user asks about "this" or "the current" match/player/team, use the IDs from context.

## WHAT NOT TO DO

1. ❌ Don't give generic coaching advice without specific data
2. ❌ Don't make up statistics - only use data from tools or context
3. ❌ Don't say "Game ID: xxx" or include internal IDs in responses
4. ❌ Don't say "Map: Not specified" - check context/visible data for map name
5. ❌ Don't provide "general tips" - every recommendation must cite specific numbers
6. ❌ Don't ask rhetorical questions - give direct answers with data

## HYPOTHETICAL ANALYSIS

When user asks "what if" questions (e.g., "what if I saved economy"):
1. Query the specific round data
2. Calculate the alternative scenario with specific numbers
3. Show expected credits, buy options, and win probability
4. Compare to what actually happened with real numbers

Example:
"Round 12 economy save analysis: Current result was loss with 2,150 credits. Saving would give 4,050 credits for Round 13, enabling a full buy (Vandal + full armor + abilities) with 72% historical win rate on full buys vs the 31% on half-buys."

## TOOL USAGE

- Use tools to get SPECIFIC data before answering
- Reference visible data on screen when available
- Never fabricate statistics - if data isn't available, say so
`

// Tool definitions for function calling
const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_player_by_name",
      description: "Find a player by name and get their complete statistics including K/D, clutches, first bloods, agents played, and trading. USE THIS when the user asks about a player by name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Player name or handle to search for (e.g., 'bang', 'TenZ', 'aspas')" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_team_by_name",
      description: "Find a team by name and get their complete statistics including win rates, pistol rounds, trading, and player roster. USE THIS when the user asks about a team by name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Team name to search for (e.g., 'Sentinels', 'LOUD', 'Cloud9')" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_team_stats",
      description: "Get statistics for a team when you already have the team_id",
      parameters: {
        type: "object",
        properties: {
          team_id: { type: "string", description: "Team ID to query" },
          metric: {
            type: "string",
            enum: ["overview", "pistol_rounds", "economy", "trading", "first_blood"],
            description: "Type of statistics to retrieve"
          }
        },
        required: ["team_id", "metric"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_player_stats",
      description: "Get statistics for a player when you already have the player_id. For searching by name, use get_player_by_name instead.",
      parameters: {
        type: "object",
        properties: {
          player_id: { type: "string", description: "Player ID to query (use get_player_by_name if you only have a name)" },
          metric: {
            type: "string",
            enum: ["overview", "clutch", "opening_duels", "trading", "agents"],
            description: "Type of statistics to retrieve: overview (comprehensive), clutch (clutch situations), opening_duels (first kills/deaths), trading (trade efficiency), agents (per-agent stats)"
          }
        },
        required: ["player_id", "metric"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_series_stats",
      description: "Get detailed statistics for a specific match/series",
      parameters: {
        type: "object",
        properties: {
          series_id: { type: "string", description: "Series ID to query" },
          team_id: { type: "string", description: "Optional: focus on specific team" }
        },
        required: ["series_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_round_breakdown",
      description: "Get round-by-round analysis for a game or series",
      parameters: {
        type: "object",
        properties: {
          series_id: { type: "string", description: "Series ID to analyze" },
          round_type: {
            type: "string",
            enum: ["all", "pistol", "eco", "force", "full_buy", "clutch"],
            description: "Filter to specific round types"
          }
        },
        required: ["series_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "compare_players",
      description: "Compare two or more players' statistics",
      parameters: {
        type: "object",
        properties: {
          player_ids: {
            type: "array",
            items: { type: "string" },
            description: "List of player IDs to compare"
          },
          metrics: {
            type: "array",
            items: { type: "string" },
            description: "Metrics to compare (kills, deaths, first_kills, clutch_wins, etc.)"
          }
        },
        required: ["player_ids"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_data",
      description: "Search for teams, players, or tournaments by name. Returns IDs that can be used with other tools.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          type: {
            type: "string",
            enum: ["teams", "players", "tournaments", "all"],
            description: "Type of entity to search for"
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_team_roster_stats",
      description: "Get all players on a team with their individual statistics. Useful for comparing players within a team.",
      parameters: {
        type: "object",
        properties: {
          team_id: { type: "string", description: "Team ID to get roster for" }
        },
        required: ["team_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_match_summary",
      description: "Get a summary of a specific match/series including scores, key moments, and top performers",
      parameters: {
        type: "object",
        properties: {
          series_id: { type: "string", description: "Series ID to summarize" }
        },
        required: ["series_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_round_details",
      description: "Get detailed analysis of a specific round including player actions, economy, and outcome. Use this for hypothetical analysis.",
      parameters: {
        type: "object",
        properties: {
          series_id: { type: "string", description: "Series ID" },
          game_number: { type: "number", description: "Game number in series (1, 2, or 3)" },
          round_number: { type: "number", description: "Round number (1-24+)" }
        },
        required: ["series_id", "round_number"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_economy_analysis",
      description: "Get economy breakdown for a game or series - useful for analyzing buy decisions and save strategies",
      parameters: {
        type: "object",
        properties: {
          series_id: { type: "string", description: "Series ID" },
          team_id: { type: "string", description: "Team ID to analyze economy for" }
        },
        required: ["series_id", "team_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_counter_strategies",
      description: "Get exploitable patterns and counter-strategy recommendations for a team based on their tendencies",
      parameters: {
        type: "object",
        properties: {
          team_id: { type: "string", description: "Team ID to analyze for weaknesses" },
          focus: {
            type: "string",
            enum: ["all", "economy", "site_preference", "agent_picks", "first_blood", "trading"],
            description: "Specific area to focus counter-strategy analysis"
          }
        },
        required: ["team_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_untraded_deaths",
      description: "Get analysis of untraded deaths - deaths where teammate didn't get a trade kill within 5 seconds",
      parameters: {
        type: "object",
        properties: {
          series_id: { type: "string", description: "Series ID" },
          team_id: { type: "string", description: "Team ID to analyze" }
        },
        required: ["series_id", "team_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_site_analysis",
      description: "Get site-specific attack/defense success rates for a team",
      parameters: {
        type: "object",
        properties: {
          team_id: { type: "string", description: "Team ID" },
          map_name: { type: "string", description: "Optional: specific map to analyze" }
        },
        required: ["team_id"]
      }
    }
  }
]

// Execute tool calls - uses shared connection pool
async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  try {
    const sql = getPostgresPool()
    switch (name) {
      case "get_player_by_name": {
        const { name: playerName } = args as { name: string }
        const searchTerm = `%${playerName}%`

        // First find the player
        const players = await sql`
          SELECT p.id, p.name, t.name as team_name, t.id as team_id
          FROM public.players p
          LEFT JOIN public.teams t ON p.team_id = t.id
          WHERE p.name ILIKE ${searchTerm}
          LIMIT 1
        `

        if (players.length === 0) {
          return JSON.stringify({ error: `No player found matching "${playerName}"`, suggestion: "Try a different spelling or check the player name" })
        }

        const player = players[0]
        const playerId = player.id

        // Now get comprehensive stats
        const [overview, clutch, agents, trading, openingDuels] = await Promise.all([
          sql`
            SELECT
              COUNT(DISTINCT prs.round_id) as rounds_played,
              SUM(prs.kills) as total_kills,
              SUM(prs.deaths) as total_deaths,
              SUM(prs.assists) as total_assists,
              ROUND(SUM(prs.kills)::numeric / NULLIF(SUM(prs.deaths), 0), 2) as kd_ratio,
              SUM(CASE WHEN prs.first_kill THEN 1 ELSE 0 END) as first_kills,
              SUM(CASE WHEN prs.first_death THEN 1 ELSE 0 END) as first_deaths
            FROM public.player_round_stats prs
            WHERE prs.player_id = ${playerId}
          `,
          sql`
            SELECT
              SUM(CASE WHEN clutch_situation THEN 1 ELSE 0 END) as clutch_situations,
              SUM(CASE WHEN clutch_won THEN 1 ELSE 0 END) as clutch_wins,
              ROUND(SUM(CASE WHEN clutch_won THEN 1 ELSE 0 END)::numeric / NULLIF(SUM(CASE WHEN clutch_situation THEN 1 ELSE 0 END), 0) * 100, 1) as clutch_rate
            FROM public.player_round_stats
            WHERE player_id = ${playerId}
          `,
          sql`
            SELECT
              agent,
              COUNT(*) as rounds_played,
              SUM(kills) as kills,
              SUM(deaths) as deaths,
              ROUND(SUM(kills)::numeric / NULLIF(SUM(deaths), 0), 2) as kd_ratio
            FROM public.player_round_stats
            WHERE player_id = ${playerId}
            GROUP BY agent
            ORDER BY rounds_played DESC
            LIMIT 5
          `,
          sql`
            SELECT
              COUNT(*) as total_deaths,
              SUM(CASE WHEN traded THEN 1 ELSE 0 END) as traded_deaths,
              ROUND(SUM(CASE WHEN traded THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as trade_rate
            FROM public.player_round_stats
            WHERE player_id = ${playerId} AND deaths > 0
          `,
          sql`
            SELECT
              SUM(CASE WHEN first_kill THEN 1 ELSE 0 END) as first_kills,
              SUM(CASE WHEN first_death THEN 1 ELSE 0 END) as first_deaths,
              SUM(CASE WHEN first_kill THEN 1 ELSE 0 END) - SUM(CASE WHEN first_death THEN 1 ELSE 0 END) as opening_diff
            FROM public.player_round_stats
            WHERE player_id = ${playerId}
          `
        ])

        // Process overview stats with null handling
        const stats = overview[0] || {}
        const roundsPlayed = Number(stats.rounds_played) || 0
        const totalKills = Number(stats.total_kills) || 0
        const totalDeaths = Number(stats.total_deaths) || 0
        const kdRatio = stats.kd_ratio ? Number(stats.kd_ratio) : (totalDeaths > 0 ? totalKills / totalDeaths : totalKills)

        // Calculate ACS approximation (kills * 150 + assists * 50) / rounds
        const totalAssists = Number(stats.total_assists) || 0
        const acsApprox = roundsPlayed > 0 ? Math.round((totalKills * 150 + totalAssists * 50) / roundsPlayed) : 0

        // Process clutch stats with null handling
        const clutchStats = clutch[0] || {}
        const clutchSituations = Number(clutchStats.clutch_situations) || 0
        const clutchWins = Number(clutchStats.clutch_wins) || 0
        const clutchRate = clutchStats.clutch_rate ? Number(clutchStats.clutch_rate) : (clutchSituations > 0 ? (clutchWins / clutchSituations * 100) : 0)

        // Process trading stats
        const tradeStats = trading[0] || {}
        const tradeRate = Number(tradeStats.trade_rate) || 0

        // Process opening duels
        const openingStats = openingDuels[0] || {}
        const firstKills = Number(openingStats.first_kills) || 0
        const firstDeaths = Number(openingStats.first_deaths) || 0
        const openingDiff = firstKills - firstDeaths

        // Filter agents to only include valid ones
        const validAgents = agents.filter(a => a.agent && a.rounds_played)

        return JSON.stringify({
          player: {
            id: player.id,
            name: player.name,
            team: player.team_name || "Free Agent",
            team_id: player.team_id
          },
          stats: {
            rounds_played: roundsPlayed,
            total_kills: totalKills,
            total_deaths: totalDeaths,
            total_assists: totalAssists,
            kd_ratio: kdRatio.toFixed(2),
            acs_approx: acsApprox
          },
          clutch: clutchSituations > 0 ? {
            situations: clutchSituations,
            wins: clutchWins,
            rate: clutchRate.toFixed(1) + "%"
          } : null,
          trading: {
            rate: tradeRate.toFixed(1) + "%",
            total_deaths: Number(tradeStats.total_deaths) || 0
          },
          opening_duels: {
            first_kills: firstKills,
            first_deaths: firstDeaths,
            differential: openingDiff > 0 ? `+${openingDiff}` : openingDiff.toString()
          },
          agents: validAgents.map(a => ({
            name: a.agent,
            rounds: Number(a.rounds_played) || 0,
            kd: a.kd_ratio ? Number(a.kd_ratio).toFixed(2) : "N/A"
          }))
        })
      }

      case "get_team_by_name": {
        const { name: teamName } = args as { name: string }
        const searchTerm = `%${teamName}%`

        // First find the team
        const teams = await sql`
          SELECT id, name, short_name
          FROM public.teams
          WHERE name ILIKE ${searchTerm} OR short_name ILIKE ${searchTerm}
          LIMIT 1
        `

        if (teams.length === 0) {
          return JSON.stringify({ error: `No team found matching "${teamName}"`, suggestion: "Try a different spelling or check the team name" })
        }

        const team = teams[0]
        const teamId = team.id

        // Get comprehensive team stats
        const [overview, pistol, trading, players, recentMatches] = await Promise.all([
          sql`
            SELECT
              COUNT(DISTINCT s.id) as total_series,
              COUNT(DISTINCT CASE WHEN s.winner_id = ${teamId} THEN s.id END) as series_wins,
              COUNT(DISTINCT g.id) as total_games,
              COUNT(DISTINCT CASE WHEN g.winner_id = ${teamId} THEN g.id END) as game_wins,
              ROUND(COUNT(DISTINCT CASE WHEN g.winner_id = ${teamId} THEN g.id END)::numeric / NULLIF(COUNT(DISTINCT g.id), 0) * 100, 1) as map_win_rate
            FROM public.series s
            LEFT JOIN public.games g ON g.series_id = s.id
            WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId}) AND s.processed = true
          `,
          sql`
            SELECT
              COUNT(*) as total_pistol_rounds,
              SUM(CASE WHEN r.winning_team_id = ${teamId} THEN 1 ELSE 0 END) as wins,
              ROUND(SUM(CASE WHEN r.winning_team_id = ${teamId} THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as win_rate
            FROM public.rounds r
            JOIN public.games g ON r.game_id = g.id
            JOIN public.series s ON g.series_id = s.id
            WHERE r.round_number IN (1, 13)
              AND (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId})
          `,
          sql`
            SELECT
              COUNT(*) as total_deaths,
              SUM(CASE WHEN prs.traded THEN 1 ELSE 0 END) as traded_deaths,
              ROUND(SUM(CASE WHEN prs.traded THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as trade_rate
            FROM public.player_round_stats prs
            WHERE prs.team_id = ${teamId} AND prs.deaths > 0
          `,
          sql`
            SELECT p.id, p.name
            FROM public.players p
            WHERE p.team_id = ${teamId}
            ORDER BY p.name
            LIMIT 10
          `,
          sql`
            SELECT
              s.id as series_id,
              CASE WHEN s.team_a_id = ${teamId} THEN tb.name ELSE ta.name END as opponent,
              CASE WHEN s.winner_id = ${teamId} THEN true ELSE false END as won,
              s.start_time
            FROM public.series s
            JOIN public.teams ta ON s.team_a_id = ta.id
            JOIN public.teams tb ON s.team_b_id = tb.id
            WHERE (s.team_a_id = ${teamId} OR s.team_b_id = ${teamId}) AND s.processed = true
            ORDER BY s.start_time DESC
            LIMIT 5
          `
        ])

        return JSON.stringify({
          team: {
            id: team.id,
            name: team.name,
            short_name: team.short_name
          },
          overview: overview[0],
          pistol_rounds: pistol[0],
          trading: trading[0],
          players: players,
          recent_matches: recentMatches
        })
      }

      case "query_team_stats": {
        const { team_id, metric } = args as { team_id: string; metric: string }

        if (metric === "overview") {
          const stats = await sql`
            SELECT
              t.name as team_name,
              COUNT(DISTINCT s.id) as total_series,
              COUNT(DISTINCT CASE WHEN s.winner_id = ${team_id} THEN s.id END) as series_wins,
              COUNT(DISTINCT g.id) as total_games,
              COUNT(DISTINCT CASE WHEN g.winner_id = ${team_id} THEN g.id END) as game_wins
            FROM public.teams t
            LEFT JOIN public.series s ON (s.team_a_id = ${team_id} OR s.team_b_id = ${team_id}) AND s.processed = true
            LEFT JOIN public.games g ON g.series_id = s.id
            WHERE t.id = ${team_id}
            GROUP BY t.name
          `
          return JSON.stringify(stats[0] || { error: "Team not found" })
        }

        if (metric === "pistol_rounds") {
          const stats = await sql`
            SELECT
              COUNT(*) as total_pistol_rounds,
              SUM(CASE WHEN r.winning_team_id = ${team_id} THEN 1 ELSE 0 END) as wins,
              ROUND(SUM(CASE WHEN r.winning_team_id = ${team_id} THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as win_rate
            FROM public.rounds r
            JOIN public.games g ON r.game_id = g.id
            JOIN public.series s ON g.series_id = s.id
            WHERE r.round_number IN (1, 13)
              AND (s.team_a_id = ${team_id} OR s.team_b_id = ${team_id})
          `
          return JSON.stringify(stats[0])
        }

        if (metric === "trading") {
          const stats = await sql`
            SELECT
              COUNT(*) as total_deaths,
              SUM(CASE WHEN prs.traded THEN 1 ELSE 0 END) as traded_deaths,
              ROUND(SUM(CASE WHEN prs.traded THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as trade_rate
            FROM public.player_round_stats prs
            WHERE prs.team_id = ${team_id} AND prs.deaths > 0
          `
          return JSON.stringify(stats[0])
        }

        if (metric === "first_blood") {
          const stats = await sql`
            SELECT
              SUM(CASE WHEN prs.first_kill THEN 1 ELSE 0 END) as first_kills,
              SUM(CASE WHEN prs.first_death THEN 1 ELSE 0 END) as first_deaths,
              SUM(CASE WHEN prs.first_kill THEN 1 ELSE 0 END) - SUM(CASE WHEN prs.first_death THEN 1 ELSE 0 END) as first_blood_diff
            FROM public.player_round_stats prs
            WHERE prs.team_id = ${team_id}
          `
          return JSON.stringify(stats[0])
        }

        return JSON.stringify({ error: "Unknown metric" })
      }

      case "query_player_stats": {
        const { player_id, metric } = args as { player_id: string; metric: string }

        if (metric === "overview") {
          const stats = await sql`
            SELECT
              p.name as player_name,
              t.name as team_name,
              COUNT(DISTINCT prs.round_id) as rounds_played,
              SUM(prs.kills) as total_kills,
              SUM(prs.deaths) as total_deaths,
              SUM(prs.assists) as total_assists,
              ROUND(SUM(prs.kills)::numeric / NULLIF(SUM(prs.deaths), 0), 2) as kd_ratio,
              SUM(CASE WHEN prs.first_kill THEN 1 ELSE 0 END) as first_kills,
              SUM(CASE WHEN prs.first_death THEN 1 ELSE 0 END) as first_deaths,
              SUM(CASE WHEN prs.clutch_situation THEN 1 ELSE 0 END) as clutch_situations,
              SUM(CASE WHEN prs.clutch_won THEN 1 ELSE 0 END) as clutches_won,
              ROUND(SUM(CASE WHEN prs.clutch_won THEN 1 ELSE 0 END)::numeric / NULLIF(SUM(CASE WHEN prs.clutch_situation THEN 1 ELSE 0 END), 0) * 100, 1) as clutch_rate,
              SUM(CASE WHEN prs.traded THEN 1 ELSE 0 END) as times_traded,
              ROUND(SUM(CASE WHEN prs.traded THEN 1 ELSE 0 END)::numeric / NULLIF(SUM(prs.deaths), 0) * 100, 1) as trade_rate
            FROM public.players p
            LEFT JOIN public.teams t ON p.team_id = t.id
            LEFT JOIN public.player_round_stats prs ON prs.player_id = ${player_id}
            WHERE p.id = ${player_id}
            GROUP BY p.name, t.name
          `
          return JSON.stringify(stats[0] || { error: "Player not found" })
        }

        if (metric === "clutch") {
          const stats = await sql`
            SELECT
              SUM(CASE WHEN clutch_situation THEN 1 ELSE 0 END) as clutch_situations,
              SUM(CASE WHEN clutch_won THEN 1 ELSE 0 END) as clutch_wins,
              ROUND(SUM(CASE WHEN clutch_won THEN 1 ELSE 0 END)::numeric / NULLIF(SUM(CASE WHEN clutch_situation THEN 1 ELSE 0 END), 0) * 100, 1) as clutch_rate
            FROM public.player_round_stats
            WHERE player_id = ${player_id}
          `
          return JSON.stringify(stats[0])
        }

        if (metric === "opening_duels") {
          const stats = await sql`
            SELECT
              SUM(CASE WHEN first_kill THEN 1 ELSE 0 END) as first_kills,
              SUM(CASE WHEN first_death THEN 1 ELSE 0 END) as first_deaths,
              SUM(CASE WHEN first_kill THEN 1 ELSE 0 END) - SUM(CASE WHEN first_death THEN 1 ELSE 0 END) as opening_diff,
              ROUND(SUM(CASE WHEN first_kill THEN 1 ELSE 0 END)::numeric / NULLIF(SUM(CASE WHEN first_kill THEN 1 ELSE 0 END) + SUM(CASE WHEN first_death THEN 1 ELSE 0 END), 0) * 100, 1) as opening_success_rate
            FROM public.player_round_stats
            WHERE player_id = ${player_id}
          `
          return JSON.stringify(stats[0])
        }

        if (metric === "trading") {
          const stats = await sql`
            SELECT
              SUM(deaths) as total_deaths,
              SUM(CASE WHEN traded THEN 1 ELSE 0 END) as times_traded,
              ROUND(SUM(CASE WHEN traded THEN 1 ELSE 0 END)::numeric / NULLIF(SUM(deaths), 0) * 100, 1) as trade_rate,
              SUM(CASE WHEN traded_by_teammate THEN 1 ELSE 0 END) as got_trade_kills
            FROM public.player_round_stats
            WHERE player_id = ${player_id}
          `
          return JSON.stringify(stats[0])
        }

        if (metric === "agents") {
          const stats = await sql`
            SELECT
              agent,
              COUNT(*) as rounds_played,
              SUM(kills) as kills,
              SUM(deaths) as deaths,
              ROUND(SUM(kills)::numeric / NULLIF(SUM(deaths), 0), 2) as kd_ratio,
              SUM(CASE WHEN first_kill THEN 1 ELSE 0 END) as first_kills
            FROM public.player_round_stats
            WHERE player_id = ${player_id}
            GROUP BY agent
            ORDER BY rounds_played DESC
          `
          return JSON.stringify(stats)
        }

        return JSON.stringify({ error: "Unknown metric" })
      }

      case "query_series_stats": {
        const { series_id, team_id } = args as { series_id: string; team_id?: string }

        const stats = await sql`
          SELECT
            s.id,
            ta.name as team_a_name,
            tb.name as team_b_name,
            t.name as tournament_name,
            (SELECT COUNT(*) FROM public.games WHERE series_id = ${series_id}) as games_played,
            (SELECT COUNT(*) FROM public.games WHERE series_id = ${series_id} AND winner_id = s.team_a_id) as team_a_wins,
            (SELECT COUNT(*) FROM public.games WHERE series_id = ${series_id} AND winner_id = s.team_b_id) as team_b_wins,
            (SELECT SUM(team_a_score + team_b_score) FROM public.games WHERE series_id = ${series_id}) as total_rounds
          FROM public.series s
          JOIN public.teams ta ON s.team_a_id = ta.id
          JOIN public.teams tb ON s.team_b_id = tb.id
          LEFT JOIN public.tournaments t ON s.tournament_id = t.id
          WHERE s.id = ${series_id}
        `

        if (team_id) {
          const teamStats = await sql`
            SELECT
              SUM(prs.kills) as total_kills,
              SUM(prs.deaths) as total_deaths,
              SUM(CASE WHEN prs.first_kill THEN 1 ELSE 0 END) as first_kills,
              SUM(CASE WHEN prs.clutch_won THEN 1 ELSE 0 END) as clutches
            FROM public.player_round_stats prs
            JOIN public.rounds r ON prs.round_id = r.id
            JOIN public.games g ON r.game_id = g.id
            WHERE g.series_id = ${series_id} AND prs.team_id = ${team_id}
          `
          return JSON.stringify({ series: stats[0], team_stats: teamStats[0] })
        }

        return JSON.stringify(stats[0])
      }

      case "query_round_breakdown": {
        const { series_id, round_type } = args as { series_id: string; round_type?: string }

        let query = sql`
          SELECT
            g.map_name,
            r.round_number,
            r.winning_team_id,
            r.winning_condition,
            r.spike_planted,
            r.team_a_loadout_value,
            r.team_b_loadout_value,
            CASE
              WHEN r.round_number IN (1, 13) THEN 'pistol'
              WHEN r.team_a_loadout_value < 10000 OR r.team_b_loadout_value < 10000 THEN 'eco'
              ELSE 'buy'
            END as round_type
          FROM public.rounds r
          JOIN public.games g ON r.game_id = g.id
          WHERE g.series_id = ${series_id}
          ORDER BY g.sequence_number, r.round_number
          LIMIT 50
        `

        const rounds = await query
        return JSON.stringify(rounds)
      }

      case "compare_players": {
        const { player_ids } = args as { player_ids: string[] }

        const stats = await sql`
          SELECT
            p.name as player_name,
            t.name as team_name,
            COUNT(DISTINCT prs.round_id) as rounds,
            SUM(prs.kills) as kills,
            SUM(prs.deaths) as deaths,
            ROUND(SUM(prs.kills)::numeric / NULLIF(SUM(prs.deaths), 0), 2) as kd,
            SUM(CASE WHEN prs.first_kill THEN 1 ELSE 0 END) as first_kills,
            SUM(CASE WHEN prs.clutch_won THEN 1 ELSE 0 END) as clutches
          FROM public.players p
          LEFT JOIN public.teams t ON p.team_id = t.id
          LEFT JOIN public.player_round_stats prs ON prs.player_id = p.id
          WHERE p.id = ANY(${player_ids})
          GROUP BY p.id, p.name, t.name
          ORDER BY kd DESC NULLS LAST
        `
        return JSON.stringify(stats)
      }

      case "search_data": {
        const { query, type } = args as { query: string; type?: string }
        const searchTerm = `%${query}%`

        const results: Record<string, unknown[]> = {}

        if (!type || type === "all" || type === "teams") {
          const teams = await sql`
            SELECT id, name, short_name FROM public.teams
            WHERE name ILIKE ${searchTerm} OR short_name ILIKE ${searchTerm}
            LIMIT 5
          `
          results.teams = teams
        }

        if (!type || type === "all" || type === "players") {
          const players = await sql`
            SELECT p.id, p.name, t.name as team_name
            FROM public.players p
            LEFT JOIN public.teams t ON p.team_id = t.id
            WHERE p.name ILIKE ${searchTerm}
            LIMIT 5
          `
          results.players = players
        }

        if (!type || type === "all" || type === "tournaments") {
          const tournaments = await sql`
            SELECT id, name FROM public.tournaments
            WHERE name ILIKE ${searchTerm}
            LIMIT 5
          `
          results.tournaments = tournaments
        }

        return JSON.stringify(results)
      }

      case "get_team_roster_stats": {
        const { team_id } = args as { team_id: string }

        const roster = await sql`
          SELECT
            p.id,
            p.name,
            COUNT(DISTINCT prs.round_id) as rounds_played,
            SUM(prs.kills) as total_kills,
            SUM(prs.deaths) as total_deaths,
            ROUND(SUM(prs.kills)::numeric / NULLIF(SUM(prs.deaths), 0), 2) as kd_ratio,
            SUM(CASE WHEN prs.first_kill THEN 1 ELSE 0 END) as first_kills,
            SUM(CASE WHEN prs.first_death THEN 1 ELSE 0 END) as first_deaths,
            SUM(CASE WHEN prs.clutch_won THEN 1 ELSE 0 END) as clutches_won,
            ROUND(SUM(CASE WHEN prs.traded THEN 1 ELSE 0 END)::numeric / NULLIF(SUM(prs.deaths), 0) * 100, 1) as trade_rate
          FROM public.players p
          LEFT JOIN public.player_round_stats prs ON prs.player_id = p.id
          WHERE p.team_id = ${team_id}
          GROUP BY p.id, p.name
          ORDER BY kd_ratio DESC NULLS LAST
        `

        const teamInfo = await sql`
          SELECT name FROM public.teams WHERE id = ${team_id}
        `

        return JSON.stringify({
          team_name: teamInfo[0]?.name || "Unknown Team",
          players: roster
        })
      }

      case "get_match_summary": {
        const { series_id } = args as { series_id: string }

        // Get series info
        const seriesInfo = await sql`
          SELECT
            s.id,
            s.format,
            ta.name as team_a_name,
            ta.id as team_a_id,
            tb.name as team_b_name,
            tb.id as team_b_id,
            w.name as winner_name,
            t.name as tournament_name
          FROM public.series s
          JOIN public.teams ta ON s.team_a_id = ta.id
          JOIN public.teams tb ON s.team_b_id = tb.id
          LEFT JOIN public.teams w ON s.winner_id = w.id
          LEFT JOIN public.tournaments t ON s.tournament_id = t.id
          WHERE s.id = ${series_id}
        `

        if (seriesInfo.length === 0) {
          return JSON.stringify({ error: "Series not found" })
        }

        // Get games in series
        const games = await sql`
          SELECT
            g.map_name,
            g.team_a_score,
            g.team_b_score,
            w.name as winner_name
          FROM public.games g
          LEFT JOIN public.teams w ON g.winner_id = w.id
          WHERE g.series_id = ${series_id}
          ORDER BY g.sequence_number
        `

        // Get top performers
        const topPerformers = await sql`
          SELECT
            p.name as player_name,
            t.name as team_name,
            SUM(prs.kills) as kills,
            SUM(prs.deaths) as deaths,
            ROUND(SUM(prs.kills)::numeric / NULLIF(SUM(prs.deaths), 0), 2) as kd_ratio,
            SUM(CASE WHEN prs.first_kill THEN 1 ELSE 0 END) as first_kills
          FROM public.player_round_stats prs
          JOIN public.players p ON prs.player_id = p.id
          JOIN public.teams t ON prs.team_id = t.id
          JOIN public.rounds r ON prs.round_id = r.id
          JOIN public.games g ON r.game_id = g.id
          WHERE g.series_id = ${series_id}
          GROUP BY p.id, p.name, t.name
          ORDER BY kd_ratio DESC NULLS LAST
          LIMIT 5
        `

        // Get clutch moments
        const clutches = await sql`
          SELECT
            p.name as player_name,
            t.name as team_name,
            g.map_name,
            r.round_number
          FROM public.player_round_stats prs
          JOIN public.players p ON prs.player_id = p.id
          JOIN public.teams t ON prs.team_id = t.id
          JOIN public.rounds r ON prs.round_id = r.id
          JOIN public.games g ON r.game_id = g.id
          WHERE g.series_id = ${series_id} AND prs.clutch_won = true
          ORDER BY g.sequence_number, r.round_number
          LIMIT 5
        `

        return JSON.stringify({
          series: seriesInfo[0],
          games: games,
          top_performers: topPerformers,
          clutch_moments: clutches
        })
      }

      case "get_round_details": {
        const { series_id, game_number, round_number } = args as { series_id: string; game_number?: number; round_number: number }

        // Get the specific round
        const rounds = await sql`
          SELECT
            r.id,
            r.round_number,
            r.winning_team_id,
            r.winning_condition,
            r.spike_planted,
            r.spike_defused,
            r.team_a_loadout_value,
            r.team_b_loadout_value,
            g.map_name,
            g.sequence_number as game_number,
            tw.name as winning_team_name
          FROM public.rounds r
          JOIN public.games g ON r.game_id = g.id
          LEFT JOIN public.teams tw ON r.winning_team_id = tw.id
          WHERE g.series_id = ${series_id}
            AND r.round_number = ${round_number}
            ${game_number ? sql`AND g.sequence_number = ${game_number}` : sql``}
          ORDER BY g.sequence_number
          LIMIT 1
        `

        if (rounds.length === 0) {
          return JSON.stringify({ error: "Round not found" })
        }

        const round = rounds[0]

        // Get player stats for this round
        const playerStats = await sql`
          SELECT
            p.name as player_name,
            t.name as team_name,
            prs.agent,
            prs.kills,
            prs.deaths,
            prs.first_kill,
            prs.first_death,
            prs.clutch_situation,
            prs.clutch_won,
            prs.loadout_value,
            prs.traded
          FROM public.player_round_stats prs
          JOIN public.players p ON prs.player_id = p.id
          JOIN public.teams t ON prs.team_id = t.id
          WHERE prs.round_id = ${round.id}
          ORDER BY t.name, prs.kills DESC
        `

        // Get kill events for this round
        const kills = await sql`
          SELECT
            pk.name as killer_name,
            pv.name as victim_name,
            ke.weapon,
            ke.is_headshot,
            ke.is_first_kill,
            ke.game_time_ms
          FROM public.kill_events ke
          JOIN public.players pk ON ke.killer_id = pk.id
          JOIN public.players pv ON ke.victim_id = pv.id
          WHERE ke.round_id = ${round.id}
          ORDER BY ke.game_time_ms
        `

        return JSON.stringify({
          round: {
            number: round.round_number,
            game_number: round.game_number,
            map: round.map_name,
            winner: round.winning_team_name,
            winning_condition: round.winning_condition,
            spike_planted: round.spike_planted,
            spike_defused: round.spike_defused,
            team_a_economy: round.team_a_loadout_value,
            team_b_economy: round.team_b_loadout_value
          },
          players: playerStats,
          kill_sequence: kills
        })
      }

      case "get_economy_analysis": {
        const { series_id, team_id } = args as { series_id: string; team_id: string }

        // Get round-by-round economy and outcomes
        const economyData = await sql`
          SELECT
            g.map_name,
            r.round_number,
            CASE
              WHEN ${team_id} = (SELECT team_a_id FROM public.series WHERE id = ${series_id})
              THEN r.team_a_loadout_value
              ELSE r.team_b_loadout_value
            END as team_loadout,
            CASE
              WHEN ${team_id} = (SELECT team_a_id FROM public.series WHERE id = ${series_id})
              THEN r.team_b_loadout_value
              ELSE r.team_a_loadout_value
            END as opponent_loadout,
            r.winning_team_id = ${team_id} as won,
            CASE
              WHEN r.round_number IN (1, 13) THEN 'pistol'
              WHEN CASE
                WHEN ${team_id} = (SELECT team_a_id FROM public.series WHERE id = ${series_id})
                THEN r.team_a_loadout_value
                ELSE r.team_b_loadout_value
              END < 5000 THEN 'eco'
              WHEN CASE
                WHEN ${team_id} = (SELECT team_a_id FROM public.series WHERE id = ${series_id})
                THEN r.team_a_loadout_value
                ELSE r.team_b_loadout_value
              END < 15000 THEN 'force'
              ELSE 'full_buy'
            END as buy_type
          FROM public.rounds r
          JOIN public.games g ON r.game_id = g.id
          WHERE g.series_id = ${series_id}
          ORDER BY g.sequence_number, r.round_number
        `

        // Aggregate stats by buy type
        const buyTypeStats = await sql`
          WITH round_economy AS (
            SELECT
              r.id,
              CASE
                WHEN r.round_number IN (1, 13) THEN 'pistol'
                WHEN CASE
                  WHEN ${team_id} = (SELECT team_a_id FROM public.series WHERE id = ${series_id})
                  THEN r.team_a_loadout_value
                  ELSE r.team_b_loadout_value
                END < 5000 THEN 'eco'
                WHEN CASE
                  WHEN ${team_id} = (SELECT team_a_id FROM public.series WHERE id = ${series_id})
                  THEN r.team_a_loadout_value
                  ELSE r.team_b_loadout_value
                END < 15000 THEN 'force'
                ELSE 'full_buy'
              END as buy_type,
              r.winning_team_id = ${team_id} as won
            FROM public.rounds r
            JOIN public.games g ON r.game_id = g.id
            WHERE g.series_id = ${series_id}
          )
          SELECT
            buy_type,
            COUNT(*) as total_rounds,
            SUM(CASE WHEN won THEN 1 ELSE 0 END) as wins,
            ROUND(SUM(CASE WHEN won THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as win_rate
          FROM round_economy
          GROUP BY buy_type
          ORDER BY buy_type
        `

        return JSON.stringify({
          rounds: economyData,
          buy_type_summary: buyTypeStats
        })
      }

      case "get_counter_strategies": {
        const { team_id, focus } = args as { team_id: string; focus?: string }

        const strategies: Record<string, unknown> = {}

        // Get team name
        const teamInfo = await sql`SELECT name FROM public.teams WHERE id = ${team_id}`
        strategies.team_name = teamInfo[0]?.name || "Unknown"

        // First blood analysis
        if (!focus || focus === "all" || focus === "first_blood") {
          const fbStats = await sql`
            SELECT
              p.name as player_name,
              SUM(CASE WHEN prs.first_kill THEN 1 ELSE 0 END) as first_kills,
              SUM(CASE WHEN prs.first_death THEN 1 ELSE 0 END) as first_deaths,
              SUM(CASE WHEN prs.first_kill THEN 1 ELSE 0 END) - SUM(CASE WHEN prs.first_death THEN 1 ELSE 0 END) as differential
            FROM public.player_round_stats prs
            JOIN public.players p ON prs.player_id = p.id
            WHERE prs.team_id = ${team_id}
            GROUP BY p.id, p.name
            ORDER BY differential
            LIMIT 5
          `
          strategies.first_blood = {
            vulnerable_players: fbStats.filter(p => (p.differential as number) < 0),
            sample_size: fbStats.reduce((acc, p) => acc + (p.first_kills as number) + (p.first_deaths as number), 0)
          }
        }

        // Trading efficiency
        if (!focus || focus === "all" || focus === "trading") {
          const tradeStats = await sql`
            SELECT
              COUNT(*) as total_deaths,
              SUM(CASE WHEN prs.traded THEN 1 ELSE 0 END) as traded_deaths,
              ROUND(SUM(CASE WHEN prs.traded THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as trade_rate
            FROM public.player_round_stats prs
            WHERE prs.team_id = ${team_id} AND prs.deaths > 0
          `
          strategies.trading = {
            stats: tradeStats[0],
            recommendation: (tradeStats[0]?.trade_rate as number) < 35
              ? "Team has poor trading - isolate players and prevent trades"
              : "Team trades well - need to get multiple kills before engagement"
          }
        }

        // Pistol rounds
        if (!focus || focus === "all" || focus === "economy") {
          const pistolStats = await sql`
            SELECT
              COUNT(*) as total_pistols,
              SUM(CASE WHEN r.winning_team_id = ${team_id} THEN 1 ELSE 0 END) as wins,
              ROUND(SUM(CASE WHEN r.winning_team_id = ${team_id} THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as win_rate
            FROM public.rounds r
            JOIN public.games g ON r.game_id = g.id
            JOIN public.series s ON g.series_id = s.id
            WHERE r.round_number IN (1, 13)
              AND (s.team_a_id = ${team_id} OR s.team_b_id = ${team_id})
          `
          strategies.pistol = {
            stats: pistolStats[0],
            recommendation: (pistolStats[0]?.win_rate as number) < 45
              ? "Weak pistol rounds - prioritize pistol round wins for early advantage"
              : "Strong pistol performance - focus on anti-eco after their pistol wins"
          }
        }

        // Site preference (if site data available)
        if (!focus || focus === "all" || focus === "site_preference") {
          const siteStats = await sql`
            SELECT
              se.site,
              COUNT(*) as plants,
              SUM(CASE WHEN r.winning_team_id = ${team_id} THEN 1 ELSE 0 END) as wins,
              ROUND(SUM(CASE WHEN r.winning_team_id = ${team_id} THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as win_rate
            FROM public.spike_events se
            JOIN public.rounds r ON se.round_id = r.id
            JOIN public.games g ON r.game_id = g.id
            JOIN public.series s ON g.series_id = s.id
            WHERE se.event_type = 'plant'
              AND (s.team_a_id = ${team_id} OR s.team_b_id = ${team_id})
            GROUP BY se.site
            ORDER BY plants DESC
          `
          if (siteStats.length > 0) {
            const weakestSite = siteStats.reduce((min, s) =>
              (s.win_rate as number) < (min.win_rate as number) ? s : min, siteStats[0])
            strategies.site_preference = {
              stats: siteStats,
              weak_site: weakestSite,
              recommendation: `Stack ${weakestSite.site} site - only ${weakestSite.win_rate}% win rate (${weakestSite.wins}/${weakestSite.plants} rounds)`
            }
          }
        }

        return JSON.stringify(strategies)
      }

      case "get_untraded_deaths": {
        const { series_id, team_id } = args as { series_id: string; team_id: string }

        const untradedStats = await sql`
          SELECT
            p.name as player_name,
            g.map_name,
            COUNT(*) as total_deaths,
            SUM(CASE WHEN NOT prs.traded THEN 1 ELSE 0 END) as untraded_deaths,
            ROUND(SUM(CASE WHEN NOT prs.traded THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as untraded_rate
          FROM public.player_round_stats prs
          JOIN public.players p ON prs.player_id = p.id
          JOIN public.rounds r ON prs.round_id = r.id
          JOIN public.games g ON r.game_id = g.id
          WHERE g.series_id = ${series_id}
            AND prs.team_id = ${team_id}
            AND prs.deaths > 0
          GROUP BY p.id, p.name, g.map_name
          ORDER BY untraded_rate DESC
        `

        const totalUntraded = await sql`
          SELECT
            COUNT(*) as total_deaths,
            SUM(CASE WHEN NOT prs.traded THEN 1 ELSE 0 END) as untraded,
            ROUND(SUM(CASE WHEN NOT prs.traded THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as rate
          FROM public.player_round_stats prs
          JOIN public.rounds r ON prs.round_id = r.id
          JOIN public.games g ON r.game_id = g.id
          WHERE g.series_id = ${series_id}
            AND prs.team_id = ${team_id}
            AND prs.deaths > 0
        `

        return JSON.stringify({
          overall: totalUntraded[0],
          by_player_map: untradedStats
        })
      }

      case "get_site_analysis": {
        const { team_id, map_name } = args as { team_id: string; map_name?: string }

        const siteStats = await sql`
          SELECT
            g.map_name,
            se.site,
            COUNT(*) as total_attacks,
            SUM(CASE WHEN r.winning_team_id = ${team_id} THEN 1 ELSE 0 END) as wins,
            ROUND(SUM(CASE WHEN r.winning_team_id = ${team_id} THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as success_rate
          FROM public.spike_events se
          JOIN public.rounds r ON se.round_id = r.id
          JOIN public.games g ON r.game_id = g.id
          JOIN public.series s ON g.series_id = s.id
          WHERE se.event_type = 'plant'
            AND (s.team_a_id = ${team_id} OR s.team_b_id = ${team_id})
            ${map_name ? sql`AND g.map_name = ${map_name}` : sql``}
          GROUP BY g.map_name, se.site
          ORDER BY g.map_name, se.site
        `

        return JSON.stringify({
          site_stats: siteStats
        })
      }

      default:
        return JSON.stringify({ error: "Unknown tool" })
    }
  } catch (error) {
    console.error("Tool execution error:", error)
    return JSON.stringify({ error: "Failed to execute query", details: String(error) })
  }
  // Note: No sql.end() - we use a shared connection pool
}

export async function POST(req: NextRequest) {
  try {
    const { messages, context, screenData, stream: useStream = true } = await req.json()

    // Build context from screen data with clear ID extraction
    let contextInfo = ""
    if (context) {
      contextInfo += `\n\n## Current Page Context:\n${context}`
    }

    // Extract IDs clearly for the AI to use
    if (screenData) {
      const pageType = screenData.page || screenData.type || "unknown"
      contextInfo += `\n\n## Current Page IDs (USE THESE FOR TOOL CALLS):`

      if (screenData.seriesId) {
        contextInfo += `\n- seriesId: "${screenData.seriesId}" (use this with get_match_summary, query_series_stats, query_round_breakdown)`
      }
      if (screenData.teamId) {
        contextInfo += `\n- teamId: "${screenData.teamId}" (use this with query_team_stats, get_team_roster_stats)`
      }
      if (screenData.playerId) {
        contextInfo += `\n- playerId: "${screenData.playerId}" (use this with query_player_stats)`
      }
      if (screenData.tournamentId) {
        contextInfo += `\n- tournamentId: "${screenData.tournamentId}"`
      }
      if (screenData.gameId) {
        contextInfo += `\n- gameId: "${screenData.gameId}"`
      }

      contextInfo += `\n\n## Page Type: ${pageType}`

      // Include rich context data
      if (screenData.teamA && screenData.teamB) {
        contextInfo += `\n## Match Details: ${screenData.teamA} vs ${screenData.teamB}`
      }
      if (screenData.teamName) {
        contextInfo += `\n## Team: ${screenData.teamName}`
      }
      if (screenData.playerName) {
        contextInfo += `\n## Player: ${screenData.playerName}`
      }
      if (screenData.tournamentName) {
        contextInfo += `\n## Tournament: ${screenData.tournamentName}`
      }
      if (screenData.games && Array.isArray(screenData.games)) {
        contextInfo += `\n## Games in Series: ${screenData.games.map((g: { map: string; scoreA: number; scoreB: number }) => `${g.map} (${g.scoreA}-${g.scoreB})`).join(", ")}`
      }
      if (screenData.players && Array.isArray(screenData.players)) {
        contextInfo += `\n## Players on Team: ${screenData.players.join(", ")}`
      }

      // Include visible data from components on screen
      if (screenData.visibleData && typeof screenData.visibleData === 'object') {
        const visibleData = screenData.visibleData as Record<string, unknown>
        const dataKeys = Object.keys(visibleData)

        if (dataKeys.length > 0) {
          contextInfo += `\n\n## ACTUAL DATA CURRENTLY VISIBLE ON SCREEN:`
          contextInfo += `\n(The user can see this data right now - use it to answer their questions directly!)`

          for (const key of dataKeys) {
            const data = visibleData[key]
            contextInfo += `\n\n### ${key}:\n`
            contextInfo += formatVisibleData(data)
          }
        }
      }
    }

    const fullSystemPrompt = systemPrompt + contextInfo

    // First call with tools
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: fullSystemPrompt },
        ...messages,
      ],
      tools,
      tool_choice: "auto",
      max_tokens: 2000,
      temperature: 0.7,
    })

    let assistantMessage = response.choices[0]?.message

    // Track tool calls for streaming events
    const toolCallsExecuted: string[] = []

    // Handle tool calls
    if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolResults: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== "function") continue

        // Track the tool name for streaming
        const toolName = toolCall.function.name
        toolCallsExecuted.push(toolName)

        const args = JSON.parse(toolCall.function.arguments)
        const result = await executeTool(toolName, args)

        toolResults.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        })
      }

      // Second call with tool results
      const finalResponse = await openai.chat.completions.create({
        model: MODEL,
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...messages,
          assistantMessage,
          ...toolResults,
        ],
        max_tokens: 2000,
        temperature: 0.7,
      })

      assistantMessage = finalResponse.choices[0]?.message
    }

    const content = assistantMessage?.content || "I couldn't generate a response. Please try again."

    if (useStream) {
      // For streaming, first emit tool call events, then content
      const encoder = new TextEncoder()

      // Stream content in chunks for better UX
      const readableStream = new ReadableStream({
        async start(controller) {
          // First, emit tool call events if any tools were used
          for (const toolName of toolCallsExecuted) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', tool: toolName })}\n\n`))
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          // Then stream the content - use larger chunks for faster delivery
          // but still maintain streaming feel
          const chunkSize = 5 // words per chunk
          const words = content.split(" ")

          for (let i = 0; i < words.length; i += chunkSize) {
            const chunk = words.slice(i, i + chunkSize).join(" ") + (i + chunkSize < words.length ? " " : "")
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
            await new Promise(resolve => setTimeout(resolve, 30))
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        },
      })

      return new Response(readableStream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    } else {
      return new Response(
        JSON.stringify({ message: content }),
        { headers: { "Content-Type": "application/json" } }
      )
    }
  } catch (error: unknown) {
    console.error("Chat API error:", error)
    const errorMessage = error instanceof Error ? error.message : "Failed to process chat request"
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    )
  }
}
