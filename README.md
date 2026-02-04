# Lumina

**Advanced VALORANT Analytics & AI Coaching Platform**

Lumina is a comprehensive VALORANT esports analytics platform that provides deep insights into player performance, team strategies, and match analysis. Built for professional teams, coaches, and analysts, it combines detailed statistical breakdowns with AI-powered conversational insights.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green)

## 🎯 Features

### Core Analytics
- **Player Performance Tracking**: Individual player stats across multiple metrics
- **Team Macro Analysis**: Strategic patterns, site preferences, economy management
- **Match-by-Match Breakdown**: Round-level detail with key moments highlighted
- **Tournament Analytics**: Multi-tournament comparisons and trends
- **Agent Performance**: Per-agent statistics and comfort picks
- **Scenario Analysis**: Clutch situations, eco rounds, force buys

### AI-Powered Features
- **Conversational AI Assistant**: Ask questions about stats in natural language
- **Context-Aware Responses**: AI knows what's on your screen and references specific data
- **Tool Calling System**: AI queries database directly for accurate information
- **Structured Block Rendering**: Stats, insights, and recommendations in formatted blocks
- **Streaming Responses**: Real-time AI responses with live database queries

### Advanced Metrics
- **Lumina Combat Score (LCS)**: Weighted performance metric similar to ACS
- **Trading Efficiency**: How often deaths are traded by teammates
- **Opening Duel Success**: First kill/first death differential
- **Clutch Performance**: Win rate in 1vX situations
- **First Death Impact**: Round loss rate when dying first
- **Economy Phase Analysis**: Performance on eco, force, and full buy rounds

## 🚀 Technical Stack

### Frontend
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript 5.0
- **Styling**: Tailwind CSS with custom design system
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: React Query (TanStack Query) for data caching
- **Animations**: Framer Motion
- **Charts**: Recharts for data visualization
- **Markdown**: ReactMarkdown for rich text rendering

### Backend
- **Database**: Supabase (PostgreSQL)
- **Query Layer**: Supabase RPC functions + direct client queries
- **API Routes**: Next.js API routes with streaming
- **AI**: OpenAI GPT-4o with function calling
- **Data Source**: Grid.gg API (VALORANT esports data)

### Infrastructure
- **Hosting**: Vercel
- **Database**: Supabase Cloud with connection pooling
- **CDN**: Vercel Edge Network
- **Real-time**: Supabase Realtime for live updates

## 📊 Database Schema

### Core Tables

**`public.tournaments`**
```sql
id                text PRIMARY KEY
name              text
region            text
start_date        timestamp
end_date          timestamp
```

**`public.teams`**
```sql
id                text PRIMARY KEY
name              text
short_name        text
region            text
```

**`public.players`**
```sql
id                text PRIMARY KEY
name              text
handle            text
team_id           text REFERENCES teams(id)
```

**`public.series`**
```sql
id                text PRIMARY KEY
tournament_id     text REFERENCES tournaments(id)
team_a_id         text REFERENCES teams(id)
team_b_id         text REFERENCES teams(id)
winner_id         text REFERENCES teams(id)
format            text (e.g., 'bo3', 'bo5')
start_time        timestamp
processed         boolean
```

**`public.games`**
```sql
id                text PRIMARY KEY
series_id         text REFERENCES series(id)
sequence_number   integer
map_name          text
team_a_score      integer
team_b_score      integer
winner_id         text REFERENCES teams(id)
```

**`public.rounds`**
```sql
id                text PRIMARY KEY
game_id           text REFERENCES games(id)
round_number      integer
winning_team_id   text REFERENCES teams(id)
winning_condition text (elimination/spike_detonation/spike_defuse/time_expired)
spike_planted     boolean
spike_defused     boolean
team_a_loadout_value integer
team_b_loadout_value integer
```

**`public.player_round_stats`**
```sql
id                bigint PRIMARY KEY
round_id          text REFERENCES rounds(id)
player_id         text REFERENCES players(id)
team_id           text REFERENCES teams(id)
agent             text
kills             integer
deaths            integer
assists           integer
first_kill        boolean
first_death       boolean
clutch_situation  boolean
clutch_won        boolean
loadout_value     integer
armor             integer
traded            boolean
traded_by_teammate boolean
```

**`public.kill_events`**
```sql
id                bigint PRIMARY KEY
round_id          text REFERENCES rounds(id)
killer_id         text REFERENCES players(id)
victim_id         text REFERENCES players(id)
weapon            text
is_headshot       boolean
is_wallbang       boolean
is_first_kill     boolean
game_time_ms      integer
killer_team_id    text
victim_team_id    text
```

**`public.spike_events`**
```sql
id                bigint PRIMARY KEY
round_id          text REFERENCES rounds(id)
event_type        text (plant/defuse_start/defuse_complete)
player_id         text REFERENCES players(id)
game_time_ms      integer
site              text (A/B/C)
```

### Database Functions (RPC)

Lumina uses PostgreSQL functions for efficient analytics queries:

**Player Analytics Functions**
- `query_first_death_impact(p_player_id, p_tournament_id)` - First death impact analysis
- `query_trading_efficiency(p_player_id, p_tournament_id)` - Trading stats
- `query_opening_duels(p_player_id, p_tournament_id)` - Opening duel performance
- `query_clutch_performance(p_player_id, p_tournament_id)` - Clutch situation analysis
- `query_agent_performance(p_player_id, p_tournament_id)` - Per-agent breakdown
- `query_multi_kill_rounds(p_player_id, p_tournament_id)` - Multi-kill analysis
- `query_eco_round_performance(p_player_id, p_tournament_id)` - Eco round stats

**Team Analytics Functions**
- `query_team_site_preferences(p_team_id, p_series_ids)` - Attack/defense site tendencies
- `query_team_economy_patterns(p_team_id, p_series_ids)` - Buy decision analysis
- `query_team_pistol_rounds(p_team_id, p_series_ids)` - Pistol round performance

## 🧮 Analytics & Logic

### 1. **Lumina Combat Score (LCS)**
Custom performance metric weighted by impact:

```typescript
// Per-round LCS calculation
lcs = (
  kills * 150 +
  assists * 50 +
  first_kill * 100 +
  clutch_won * 150 +
  deaths * -50 +
  first_death * -100
)

// Average LCS per player
player_lcs = sum(lcs_per_round) / total_rounds
```

### 2. **Trading Efficiency**
Measures how well teammates trade deaths:

```typescript
// Trading window: 5 seconds after death
traded = kill_events.exists(
  killer = teammate &&
  victim = killer_of_dead_player &&
  time_diff <= 5000ms
)

trading_rate = traded_deaths / total_deaths * 100
```

**Confidence Scoring**
```typescript
// Statistical confidence based on sample size
if (sample_size >= 50) confidence = "HIGH"
else if (sample_size >= 20) confidence = "MEDIUM"
else confidence = "LOW"
```

### 3. **Opening Duel Success**
First engagement outcome analysis:

```typescript
first_kills = player_round_stats
  .filter(s => s.first_kill === true)
  .count()

first_deaths = player_round_stats
  .filter(s => s.first_death === true)
  .count()

opening_diff = first_kills - first_deaths
success_rate = first_kills / (first_kills + first_deaths) * 100
```

### 4. **Clutch Performance**
Analyzing 1vX situations:

```typescript
// Clutch situation: player alive, 2+ enemies alive, all teammates dead
clutch_situations = player_round_stats
  .filter(s => s.clutch_situation === true)
  .count()

clutch_wins = player_round_stats
  .filter(s => s.clutch_won === true)
  .count()

clutch_rate = clutch_wins / clutch_situations * 100
```

**Clutch Type Breakdown**
- 1v1: Most common, 30-40% expected win rate
- 1v2: Difficult, 15-20% expected win rate
- 1v3+: Rare, <10% expected win rate

### 5. **Economy Phase Classification**
Rounds categorized by team loadout value:

```typescript
// Per-team loadout value thresholds
function classifyEconomyPhase(loadout_value: number): string {
  if (loadout_value < 5000) return "eco"        // Save round
  if (loadout_value < 15000) return "force"     // Force buy
  if (loadout_value >= 15000) return "full_buy" // Full buy
  return "unknown"
}

// Special cases
if (round_number === 1 || round_number === 13) return "pistol"
```

### 6. **First Death Impact**
Correlation between first death and round outcome:

```typescript
// Query rounds where player died first
first_death_rounds = player_round_stats
  .filter(s => s.first_death === true)

// Check if team lost those rounds
rounds_lost_after_first_death = first_death_rounds
  .filter(s => s.team_id !== round.winning_team_id)
  .count()

loss_rate = rounds_lost_after_first_death / first_death_rounds.count() * 100
```

**Interpretation**
- Loss rate > 70%: High impact - player dying first strongly predicts loss
- Loss rate 50-70%: Moderate impact - some correlation
- Loss rate < 50%: Low impact - team can recover

### 7. **AI Chat Tool Calling System**
AI assistant uses function calling to query database:

**Available Tools**
```typescript
tools = [
  {
    name: "get_player_by_name",
    description: "Find player and get comprehensive stats",
    parameters: { name: string }
  },
  {
    name: "get_team_by_name",
    description: "Find team and get overview stats",
    parameters: { name: string }
  },
  // ... 12 more specialized tools
]
```

**Execution Flow**
1. User asks: "Tell me about bang"
2. AI identifies tool needed: `get_player_by_name`
3. Tool executes Supabase query
4. Results returned to AI
5. AI formats response with specific numbers
6. Response streamed to user with structured blocks

**Structured Block Types**
- `:::stat` - Key metrics with trend indicators
- `:::insight` - Analysis findings (weakness/strength/opportunity)
- `:::player` - Player cards with agent icons
- `:::recommendation` - Actionable suggestions with priority
- `:::round` - Round-specific analysis with outcome
- `:::map` - Map-specific stats with images

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 18+
- npm or pnpm
- Supabase account
- OpenAI API key

### Environment Variables
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
OPENAI_API_KEY=your_openai_key
```

### Installation
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

### Database Setup
1. Create Supabase project
2. Run SQL migrations from `/supabase/migrations/`
3. Create RPC functions for analytics queries
4. Import sample data or connect to Grid.gg API

## 📖 Usage

### Player Analytics
1. Navigate to **Players** page
2. Search for a player
3. Click player card to view detailed analytics
4. View insights across multiple metrics
5. Use AI chat to ask specific questions

### Team Macro Analysis
1. Navigate to **Teams** page
2. Select a team
3. Choose series to analyze
4. View site preferences, economy patterns
5. Generate counter-strategies

### AI Chat Assistant
1. Open chat panel (bottom right)
2. Ask natural language questions
3. AI references visible data automatically
4. Get database-backed responses with citations
5. Use suggested prompts for common queries

**Example Queries**
- "What is bang's clutch rate?"
- "Show me Sentinels' site preferences on Bind"
- "Analyze the economy management in this series"
- "Who had the best opening duel performance?"

## 🤝 Contributing

Contributions welcome! This is an open-source project.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Grid.gg** for VALORANT esports data API
- **Riot Games** for VALORANT
- **OpenAI** for GPT-4o and function calling
- **Vercel** for hosting
- **Supabase** for database infrastructure

---

Built with ❤️ for the VALORANT esports community
