# Lumina Implementation Guide

## Overview

This document provides a comprehensive guide for implementing the Lumina Assistant Coach, a data-driven coaching tool for professional VALORANT that analyzes VCT Americas tournament data from GRID.gg APIs.

**Project Timeline:** 8 phases
**Data Source:** GRID.gg APIs (VCT Americas tournaments, 2024-2025)
**Tech Stack:** Python (FastAPI) + Next.js + SQLite

---

## Table of Contents

1. [Phase 1: Project Setup & GRID API Connection](#phase-1-project-setup--grid-api-connection)
2. [Phase 2: Data Ingestion ETL](#phase-2-data-ingestion-etl)
3. [Phase 3: Analytics Engine - Player Insights](#phase-3-analytics-engine---player-insights)
4. [Phase 4: Analytics Engine - Macro Review](#phase-4-analytics-engine---macro-review)
5. [Phase 5: Analytics Engine - Hypothetical Analyzer](#phase-5-analytics-engine---hypothetical-analyzer)
6. [Phase 6: Backend API](#phase-6-backend-api)
7. [Phase 7: Frontend UI](#phase-7-frontend-ui)
8. [Phase 8: Integration & Polish](#phase-8-integration--polish)

---

## Phase 1: Project Setup & GRID API Connection

### Goal

Establish project structure and verify GRID API access.

### Directory Structure

```
grid-gg/
├── backend/
│   ├── etl/           # Data ingestion scripts
│   │   ├── __init__.py
│   │   └── grid_client.py
│   ├── analytics/     # Analysis modules
│   ├── api/           # FastAPI endpoints
│   ├── db/            # Database models and schema
│   └── tests/
├── frontend/          # Next.js app (Phase 7)
├── data/              # Local cache for JSONL files
│   └── events/        # Downloaded event files
├── docs/              # Documentation
├── requirements.txt
├── .env.example
└── .gitignore
```

### Dependencies (requirements.txt)

```
# ETL & Data Processing
httpx>=0.25.0
python-dotenv>=1.0.0
aiosqlite>=0.19.0
pandas>=2.0.0
numpy>=1.24.0

# Analytics
scipy>=1.11.0

# API
fastapi>=0.104.0
uvicorn>=0.24.0
pydantic>=2.5.0

# Development
pytest>=7.4.0
pytest-asyncio>=0.21.0
```

### GRID API Client (backend/etl/grid_client.py)

The client connects to three GRID APIs:

| API           | Base URL                                                     | Purpose                  |
| ------------- | ------------------------------------------------------------ | ------------------------ |
| Central Data  | `https://api-op.grid.gg/central-data/graphql`                | Tournament/team metadata |
| Series State  | `https://api-op.grid.gg/live-data-feed/series-state/graphql` | Post-match stats         |
| File Download | `https://api.grid.gg`                                        | Event timelines (JSONL)  |

**Key Methods:**

- `get_tournament(tournament_id)` - Fetch tournament metadata
- `get_tournament_series(tournament_id)` - List all series in a tournament
- `get_series_state(series_id)` - Get final match state (K/D, scores)
- `download_series_events(series_id)` - Download JSONL event file

**Important Discovery - Tournament Hierarchy:**
The VCT tournament IDs from the hackathon are parent tournaments. Series are stored under child tournaments:

```
757481 (VCT Americas - Stage 1 2024)        <- Parent (no series)
├── 757482 (Regular Season)
│   ├── 757320 (Omega Group)                <- Leaf (has series)
│   └── 757319 (Alpha Group)                <- Leaf (has series)
└── 757619 (Playoffs)
    └── 757321 (Playoffs)                   <- Leaf (has series)
```

To fetch all series for a parent tournament, you must:

1. Query the parent tournament's `children` field
2. Recursively fetch series from each child tournament

### Environment Setup

```bash
# Create .env file
cp .env.example .env
# Edit .env and add: GRID_API_KEY=your_key_here

# Install dependencies
pip install -r requirements.txt
```

### Milestone Test

```bash
python3 -m backend.etl.grid_client --test
```

**Expected Output:**

```
============================================================
GRID API Connection Test
============================================================
[OK] API key loaded
1. Testing Central Data API...
   [OK] Tournament: VCT Americas - Stage 1 2024
2. Testing Series Query...
   [OK] Found 5 series
   [OK] First series: FURIA vs NRG
3. Testing Series State API...
   [OK] Series has 2 games
   [OK] First map: breeze
4. Testing File Download API...
   [OK] Found 2 files available
5. Testing File Download...
   [OK] Downloaded: 2629390_events.jsonl (56220.6 KB)
   [OK] File contains valid JSONL events
============================================================
```

### Files Created

- `backend/etl/grid_client.py` - Async API client
- `requirements.txt` - Python dependencies
- `.env.example` - Environment template
- `.gitignore` - Git ignore rules

---

## Phase 2: Data Ingestion ETL

### Goal

Fetch and store all VCT Americas data in SQLite database.

### Actual Results (Completed)

| Table              | Rows   |
| ------------------ | ------ |
| tournaments        | 5      |
| teams              | 12     |
| players            | 90     |
| series             | 72     |
| games              | 178    |
| rounds             | 3,620  |
| player_round_stats | 36,200 |
| kill_events        | 25,822 |
| spike_events       | 3,803  |
| scenario_index     | 3,777  |

### Database Schema (data/lumina.db)

The complete schema is in `backend/db/schema.sql`. Key tables:

```sql
-- Core tables
CREATE TABLE tournaments (id, name, start_date, end_date, parent_id);
CREATE TABLE teams (id, name);
CREATE TABLE players (id, name, team_id);
CREATE TABLE series (id, tournament_id, start_time, format, team_a_id, team_b_id, winner_id, processed);
CREATE TABLE games (id, series_id, sequence_number, map_name, team_a_score, team_b_score, winner_id);

-- Round-level tables
CREATE TABLE rounds (
    id TEXT PRIMARY KEY,  -- game_id + round_number
    game_id, round_number, phase,  -- pistol, eco, force, full
    winning_team_id, winning_condition,  -- elimination, spike_defuse, spike_explode, time
    spike_planted, spike_defused,
    team_a_alive, team_b_alive,
    team_a_loadout_value, team_b_loadout_value
);

CREATE TABLE player_round_stats (
    round_id, player_id, team_id, agent,
    kills, deaths, assists,
    first_kill, first_death,
    traded, got_trade,
    clutch_situation, clutch_won,
    loadout_value, ultimate_points, ultimate_used
);

-- Event tables
CREATE TABLE kill_events (round_id, game_time_ms, killer_id, victim_id, weapon, is_first_kill, positions...);
CREATE TABLE spike_events (round_id, game_time_ms, event_type, player_id, site);
CREATE TABLE orb_events (round_id, game_time_ms, player_id, orb_type);

-- Analytics tables
CREATE TABLE scenario_index (
    round_id, game_id, round_number,
    attacker_alive, defender_alive, spike_planted,
    attacker_economy, defender_economy,
    attacker_won, map_name, tournament_id
);
```

### Database Indexes

27 custom indices optimized for all query patterns:

```sql
-- Navigation (5 indices)
idx_series_tournament, idx_series_teams
idx_games_series, idx_games_series_seq, idx_games_map
idx_rounds_game

-- Player Insights queries (12 indices)
idx_player_round_stats_player, idx_player_round_stats_round, idx_player_round_stats_team
idx_player_round_stats_agent, idx_player_round_stats_first_death, idx_player_round_stats_first_kill
idx_player_round_stats_clutch
idx_players_name, idx_players_team
-- Composite indices for common patterns:
idx_player_round_stats_player_agent, idx_player_round_stats_player_first_death
idx_player_round_stats_player_first_kill

-- Kill analysis (5 indices)
idx_kill_events_round, idx_kill_events_killer, idx_kill_events_victim
idx_kill_events_first_kill, idx_kill_events_time

-- Hypothetical Analyzer queries (6 indices)
idx_scenario_state (attacker_alive, defender_alive, spike_planted)
idx_scenario_full (attacker_alive, defender_alive, spike_planted, map_name)
idx_scenario_map, idx_scenario_game, idx_scenario_economy, idx_scenario_outcome

-- Macro Review queries (8 indices)
idx_rounds_phase, idx_rounds_winning_condition, idx_rounds_winner, idx_rounds_spike
idx_spike_events_round, idx_spike_events_type, idx_spike_events_player
idx_orb_events_round, idx_orb_events_player

-- ETL tracking
idx_series_processed
```

### VCT Americas Tournament IDs

```python
VCT_AMERICAS_TOURNAMENTS = {
    "757371": "VCT Americas - Kickoff 2024",
    "757481": "VCT Americas - Stage 1 2024",
    "774782": "VCT Americas - Stage 2 2024",
    "775516": "VCT Americas - Kickoff 2025",
    "800675": "VCT Americas - Stage 1 2025",
    "826660": "VCT Americas - Stage 2 2025",
}
```

### ETL Pipeline Components

**1. Data Processor (backend/etl/data_processor.py)**

Parses GRID.gg JSONL event files and extracts structured data:

```python
class EventProcessor:
    """Processes GRID.gg JSONL event files"""

    def process_file(self, jsonl_path: Path) -> ProcessedSeries:
        """Returns ProcessedSeries containing all extracted data"""
        # Handles event types:
        # - tournament-started-series: Extract teams, players, metadata
        # - series-started-game: Track game/map info
        # - game-started-round: Extract player agents, team sides
        # - team-won-round: Round outcome, win condition, alive counts
        # - player-killed-player: Kill events, first blood tracking
        # - player-completed-plantBomb/defuseBomb/explodeBomb: Spike events
```

**2. Database Loader (backend/etl/db_loader.py)**

```python
class DatabaseLoader:
    async def load_processed_series(self, data: ProcessedSeries) -> bool:
        """Load all data in dependency order"""
        # 1. Tournament → 2. Teams → 3. Players → 4. Series
        # 5. Games → 6. Rounds → 7. Player stats (batch)
        # 8. Kill events (batch) → 9. Spike/Orb events
        # 10. Scenario indices (built during processing)
```

**3. ETL Orchestrator (backend/etl/run_etl.py)**

```python
class ETLOrchestrator:
    async def run_etl(self, tournament_ids=None, limit=None):
        """Run full ETL pipeline"""
        # 1. Initialize database schema
        # 2. Discover child tournaments (via known mappings)
        # 3. Fetch series metadata from each child
        # 4. Download JSONL files, process, and load
        # Rate limiting: 1s between API calls
```

### Running the ETL

```bash
# Full ETL (all 6 VCT Americas tournaments)
python3 -m backend.etl.run_etl --tournaments all

# Test mode (2 series only)
python3 -m backend.etl.run_etl --test

# Specific tournament
python3 -m backend.etl.run_etl --tournaments 757371

# Verify results
sqlite3 data/lumina.db "SELECT COUNT(*) FROM rounds;"
# Actual result: 3,620
```

### Files Created

- `backend/db/schema.sql` - SQLite schema (11 tables, 27 custom indexes)
- `backend/db/models.py` - Async database wrapper with dataclasses
- `backend/etl/data_processor.py` - JSONL event parser (ProcessedSeries)
- `backend/etl/db_loader.py` - Database loader with batch inserts
- `backend/etl/run_etl.py` - ETL orchestrator with CLI

---

## Phase 3: Analytics Engine - Player Insights

### Goal

Generate player-specific insights using conditional probability queries.

### Analytics Methodology

**Why Statistical Methods (Not ML):**

- ~15k rounds is insufficient for deep learning
- Statistical methods are explainable and trustworthy
- Results are backed by real tournament outcomes
- Fast computation (<2s per query)

**Methods Used:**

1. Conditional Probability: `P(loss | first_death, no_KAST)`
2. Aggregation: Count-based metrics
3. Time-windowed Analysis: Trading within 5s (using `kill_events.game_time_ms`)

### Available Data Fields (from Phase 2 Schema)

The `player_round_stats` table provides these fields for insights:

| Field              | Type    | Use Case                     |
| ------------------ | ------- | ---------------------------- |
| `first_kill`       | BOOLEAN | First blood rate analysis    |
| `first_death`      | BOOLEAN | Opening death impact         |
| `kills`            | INTEGER | KAST calculation             |
| `assists`          | INTEGER | KAST calculation             |
| `traded`           | BOOLEAN | Was player's death traded?   |
| `got_trade`        | BOOLEAN | Did player get a trade kill? |
| `clutch_situation` | BOOLEAN | 1vN situation occurred       |
| `clutch_won`       | BOOLEAN | Clutch success rate          |
| `damage_dealt`     | INTEGER | ADR calculations             |
| `agent`            | TEXT    | Agent-specific performance   |
| `loadout_value`    | INTEGER | Eco round performance        |
| `ultimate_used`    | BOOLEAN | Ultimate usage patterns      |

The `kill_events` table provides:

| Field           | Type    | Use Case                |
| --------------- | ------- | ----------------------- |
| `game_time_ms`  | INTEGER | Trading window (5000ms) |
| `is_first_kill` | BOOLEAN | First blood analysis    |
| `weapon`        | TEXT    | Weapon preference stats |
| `headshot`      | BOOLEAN | Headshot percentage     |
| `killer_pos_*`  | REAL    | Position heatmaps       |
| `victim_pos_*`  | REAL    | Death location analysis |

### Player Insights Module (analytics/insights.py)

```python
class PlayerInsightGenerator:
    def __init__(self, db):
        self.db = db

    async def calculate_first_death_impact(self, player_id, tournament_ids=None):
        """
        Calculate: When player dies first without KAST,
        what % of rounds are lost?

        Uses: player_round_stats.first_death, kills, assists
        Joins: rounds (for winning_team_id), games, series (for tournament filter)
        """
        query = """
        SELECT
            SUM(CASE WHEN r.winning_team_id != prs.team_id THEN 1 ELSE 0 END) as losses,
            COUNT(*) as total
        FROM player_round_stats prs
        JOIN rounds r ON prs.round_id = r.id
        JOIN games g ON r.game_id = g.id
        JOIN series s ON g.series_id = s.id
        WHERE prs.player_id = ?
          AND prs.first_death = 1
          AND prs.kills = 0
          AND prs.assists = 0
        """
        params = [player_id]
        if tournament_ids:
            placeholders = ','.join('?' * len(tournament_ids))
            query += f" AND s.tournament_id IN ({placeholders})"
            params.extend(tournament_ids)

        async with self.db.connection() as conn:
            cursor = await conn.execute(query, params)
            row = await cursor.fetchone()
            losses, total = row[0] or 0, row[1] or 0

        return {
            "metric": "first_death_impact",
            "losses": losses,
            "total": total,
            "loss_rate": losses / total if total > 0 else 0,
            "confidence": calculate_confidence(total),
            "insight": self.generate_first_death_insight(losses, total)
        }

    async def analyze_trading_efficiency(self, player_id):
        """
        Calculate: How often is player's death traded within 5 seconds?

        Uses pre-computed player_round_stats.traded field for efficiency.
        Falls back to kill_events.game_time_ms for detailed analysis.
        """
        # Fast path: use pre-computed traded field
        query = """
        SELECT
            SUM(CASE WHEN traded = 1 THEN 1 ELSE 0 END) as traded_count,
            SUM(CASE WHEN deaths > 0 THEN 1 ELSE 0 END) as death_count
        FROM player_round_stats
        WHERE player_id = ?
        """
        async with self.db.connection() as conn:
            cursor = await conn.execute(query, (player_id,))
            row = await cursor.fetchone()
            traded, total = row[0] or 0, row[1] or 0

        return {
            "metric": "trading_efficiency",
            "traded": traded,
            "total": total,
            "trade_rate": traded / total if total > 0 else 0,
            "confidence": calculate_confidence(total)
        }

    async def analyze_trading_detailed(self, player_id, trade_window_ms=5000):
        """
        Detailed trading analysis using kill_events timeline.

        Uses: kill_events.game_time_ms, victim_id, killer_id
        Computes trades within trade_window_ms (default 5 seconds)
        """
        # Get all deaths for this player with timestamps
        query = """
        SELECT ke.round_id, ke.game_time_ms, prs.team_id
        FROM kill_events ke
        JOIN player_round_stats prs ON ke.round_id = prs.round_id
            AND prs.player_id = ke.victim_id
        WHERE ke.victim_id = ?
        ORDER BY ke.round_id, ke.game_time_ms
        """
        async with self.db.connection() as conn:
            cursor = await conn.execute(query, (player_id,))
            deaths = await cursor.fetchall()

            traded = 0
            for death in deaths:
                round_id, death_time, team_id = death
                # Check for teammate kill within window
                trade_query = """
                SELECT COUNT(*) FROM kill_events ke
                JOIN player_round_stats prs ON ke.round_id = prs.round_id
                    AND prs.player_id = ke.killer_id
                WHERE ke.round_id = ?
                  AND prs.team_id = ?
                  AND ke.game_time_ms > ?
                  AND ke.game_time_ms <= ?
                """
                cursor = await conn.execute(
                    trade_query,
                    (round_id, team_id, death_time, death_time + trade_window_ms)
                )
                if (await cursor.fetchone())[0] > 0:
                    traded += 1

        return {
            "metric": "trading_detailed",
            "traded": traded,
            "total": len(deaths),
            "trade_rate": traded / len(deaths) if deaths else 0,
            "trade_window_ms": trade_window_ms
        }

    async def analyze_agent_performance(self, player_id):
        """
        Analyze performance by agent.

        Uses: player_round_stats.agent, kills, deaths, first_kill, first_death
        """
        query = """
        SELECT
            prs.agent,
            COUNT(*) as rounds_played,
            SUM(prs.kills) as total_kills,
            SUM(prs.deaths) as total_deaths,
            SUM(CASE WHEN prs.first_kill = 1 THEN 1 ELSE 0 END) as first_kills,
            SUM(CASE WHEN prs.first_death = 1 THEN 1 ELSE 0 END) as first_deaths,
            SUM(CASE WHEN r.winning_team_id = prs.team_id THEN 1 ELSE 0 END) as wins
        FROM player_round_stats prs
        JOIN rounds r ON prs.round_id = r.id
        WHERE prs.player_id = ?
          AND prs.agent IS NOT NULL
        GROUP BY prs.agent
        ORDER BY rounds_played DESC
        """
        async with self.db.connection() as conn:
            cursor = await conn.execute(query, (player_id,))
            rows = await cursor.fetchall()

        agents = []
        for row in rows:
            agent, rounds, kills, deaths, fk, fd, wins = row
            agents.append({
                "agent": agent,
                "rounds_played": rounds,
                "kd_ratio": kills / deaths if deaths > 0 else kills,
                "first_kill_rate": fk / rounds if rounds > 0 else 0,
                "first_death_rate": fd / rounds if rounds > 0 else 0,
                "win_rate": wins / rounds if rounds > 0 else 0,
                "confidence": calculate_confidence(rounds)
            })

        return {
            "metric": "agent_performance",
            "agents": agents
        }

    async def analyze_clutch_performance(self, player_id):
        """
        Analyze clutch (1vN) situations.

        Uses: player_round_stats.clutch_situation, clutch_won
        """
        query = """
        SELECT
            SUM(CASE WHEN clutch_won = 1 THEN 1 ELSE 0 END) as clutches_won,
            COUNT(*) as clutch_situations
        FROM player_round_stats
        WHERE player_id = ?
          AND clutch_situation = 1
        """
        async with self.db.connection() as conn:
            cursor = await conn.execute(query, (player_id,))
            row = await cursor.fetchone()
            won, total = row[0] or 0, row[1] or 0

        return {
            "metric": "clutch_performance",
            "clutches_won": won,
            "clutch_situations": total,
            "clutch_rate": won / total if total > 0 else 0,
            "confidence": calculate_confidence(total)
        }

    async def analyze_opening_duels(self, player_id):
        """
        First kill vs first death analysis (opening duel success).

        Uses: player_round_stats.first_kill, first_death
        """
        query = """
        SELECT
            SUM(CASE WHEN first_kill = 1 THEN 1 ELSE 0 END) as first_kills,
            SUM(CASE WHEN first_death = 1 THEN 1 ELSE 0 END) as first_deaths,
            COUNT(*) as total_rounds
        FROM player_round_stats
        WHERE player_id = ?
        """
        async with self.db.connection() as conn:
            cursor = await conn.execute(query, (player_id,))
            row = await cursor.fetchone()
            fk, fd, total = row[0] or 0, row[1] or 0, row[2] or 0

        opening_duels = fk + fd
        return {
            "metric": "opening_duels",
            "first_kills": fk,
            "first_deaths": fd,
            "opening_duel_rate": opening_duels / total if total > 0 else 0,
            "opening_duel_success": fk / opening_duels if opening_duels > 0 else 0,
            "confidence": calculate_confidence(opening_duels)
        }

    def generate_first_death_insight(self, losses, total):
        """Generate human-readable insight"""
        if total == 0:
            return "Insufficient data"
        rate = losses / total * 100
        return f"Dies first without value in {total} rounds → team loses {rate:.1f}%"
```

### Confidence Scoring

| Sample Size | Confidence | Display                                 |
| ----------- | ---------- | --------------------------------------- |
| n < 10      | Low        | "Limited data - interpret with caution" |
| 10 ≤ n < 30 | Medium     | "Moderate confidence"                   |
| n ≥ 30      | High       | "Statistically significant"             |

### Output Format

```json
{
    "player_id": "12345",
    "player_name": "Oxy",
    "insights": [
        {
            "metric": "first_death_impact",
            "data": "Dies first without KAST in 23 rounds → team loses 78%",
            "impact": "Round loss probability increases by 62% vs team average",
            "recommendation": "Ensure teammate positioned for immediate trade",
            "confidence": "high",
            "sample_size": 23
        },
        {
            "metric": "trading_efficiency",
            "data": "Traded within 5s: 45% of deaths",
            "impact": "Below team average (52%)",
            "recommendation": "Review positioning relative to teammates",
            "confidence": "high",
            "sample_size": 67
        }
    ]
}
```

### Milestone Test

```bash
python3 -m backend.analytics.insights --player "Oxy" --tournament 757481
```

### Computed Fields

The ETL computes derived fields for analytics:

| Field              | Computation                                                |
| ------------------ | ---------------------------------------------------------- |
| `traded`           | Death was traded by teammate within 5 seconds              |
| `got_trade`        | Player got a trade kill within 5 seconds of teammate death |
| `clutch_situation` | Player was last alive on team vs 1+ opponents              |
| `clutch_won`       | Player's team won the clutch situation                     |

**Database Stats (after full ETL):**

- 16,458 traded deaths (45% of all deaths)
- 3,919 clutch situations
- 600 clutch wins (15% clutch success rate)

### Milestone Test (Actual Output)

```bash
python3 -m backend.analytics.insights --test
```

```
============================================================
Player Insights Test
============================================================

Database: data/lumina.db
Found 5 players with data:
  - artzin (1043 rounds)
  - JAWGEMO (974 rounds)
  - aspas (860 rounds)
  ...

Generating insights for: artzin
Player: artzin (MIBR (1))
Insights generated: 7

[FIRST_DEATH_IMPACT]
  Dies first without value in 150 rounds → team loses 70.7%
  → Consider adjusting entry timing to guarantee trade opportunities.
  Confidence: high

[TRADING_EFFICIENCY]
  Deaths traded by teammates: 582/780 (74.6%)
  Confidence: high

[OPENING_DUELS]
  Opening duels: 139W-151L (47.9% success) in 27.8% of rounds
  Confidence: high

[CLUTCH_PERFORMANCE]
  Clutch situations: 13/70 (18.6%)
  Confidence: high

[AGENT_PERFORMANCE]
  Played 12 agents across 1043 rounds
  → Consider playing more harbor (71% WR) over killjoy (33% WR)
  Confidence: high

[MULTI_KILL_ROUNDS]
  Multi-kills: 10 4K rounds, 53 3K rounds | KPR: 0.67
  Confidence: high

[ECO_ROUND_PERFORMANCE]
  Performance by round type across 1043 rounds
  → Strong eco round performer - consider hero plays on eco
  Confidence: high
```

### Files Created

- `backend/analytics/insights.py` - Player insight generator with CLI
- `backend/analytics/confidence.py` - Confidence scoring utilities
- `backend/analytics/__init__.py` - Module exports

---

## Phase 4: Analytics Engine - Macro Review

### Goal

Generate structured match review agendas automatically.

### Available Data Fields (from Phase 2 Schema)

The macro review uses these key tables:

| Table                | Fields                                                | Use Case              |
| -------------------- | ----------------------------------------------------- | --------------------- |
| `rounds`             | `phase`, `winning_condition`, `spike_planted/defused` | Round classification  |
| `rounds`             | `team_a_loadout_value`, `team_b_loadout_value`        | Economy analysis      |
| `spike_events`       | `game_time_ms`, `event_type`, `site`                  | Plant timing analysis |
| `player_round_stats` | `clutch_situation`, `clutch_won`                      | Critical moments      |
| `games`              | `sequence_number`, `map_name`                         | Game context          |

**Note:** The `rounds.phase` field contains economy classification (pistol, eco, force, full).
The schema does NOT have `attacking_team_id` - determine attacker by round_number (1-12 = team_a attacks, 13-24 = team_b attacks in standard VALORANT).

### Macro Review Module (analytics/macro.py)

```python
class MacroReviewGenerator:
    def __init__(self, db):
        self.db = db

    async def generate_review_agenda(self, series_id, team_focus=None):
        """Generate complete match review agenda"""
        agenda = {
            "series_id": series_id,
            "sections": []
        }

        # Get series and games info
        async with self.db.connection() as conn:
            cursor = await conn.execute("""
                SELECT s.*, t1.name as team_a_name, t2.name as team_b_name
                FROM series s
                LEFT JOIN teams t1 ON s.team_a_id = t1.id
                LEFT JOIN teams t2 ON s.team_b_id = t2.id
                WHERE s.id = ?
            """, (series_id,))
            series = await cursor.fetchone()

            cursor = await conn.execute("""
                SELECT * FROM games WHERE series_id = ?
                ORDER BY sequence_number
            """, (series_id,))
            games = await cursor.fetchall()

        agenda["teams"] = {
            "team_a": {"id": series["team_a_id"], "name": series["team_a_name"]},
            "team_b": {"id": series["team_b_id"], "name": series["team_b_name"]}
        }
        agenda["games"] = [dict(g) for g in games]

        # Build sections
        agenda["sections"].append(await self.analyze_pistol_rounds(series_id, team_focus))
        agenda["sections"].append(await self.analyze_economy(series_id, team_focus))
        agenda["sections"].append(await self.analyze_execution_timing(series_id, team_focus))
        agenda["sections"].append(await self.analyze_ultimate_economy(series_id, team_focus))
        agenda["sections"].append(await self.identify_critical_moments(series_id, team_focus))

        return agenda

    async def analyze_pistol_rounds(self, series_id, team_focus):
        """
        Analyze pistol rounds (rounds 1 and 13 per game).

        Uses: rounds.round_number, rounds.winning_team_id, games.sequence_number
        """
        async with self.db.connection() as conn:
            cursor = await conn.execute("""
                SELECT r.id, r.round_number, r.winning_team_id, r.winning_condition,
                       g.sequence_number as game_number, g.map_name
                FROM rounds r
                JOIN games g ON r.game_id = g.id
                WHERE g.series_id = ?
                  AND r.round_number IN (1, 13)
                ORDER BY g.sequence_number, r.round_number
            """, (series_id,))
            pistol_rounds = await cursor.fetchall()

        analysis = {
            "title": "Pistol Rounds",
            "items": [],
            "summary": {"wins": 0, "losses": 0}
        }

        for round_data in pistol_rounds:
            won = round_data["winning_team_id"] == team_focus
            analysis["summary"]["wins" if won else "losses"] += 1

            analysis["items"].append({
                "game": round_data["game_number"],
                "map": round_data["map_name"],
                "round": round_data["round_number"],
                "side": "Attack" if round_data["round_number"] == 1 else "Defense",
                "result": "Won" if won else "Lost",
                "win_condition": round_data["winning_condition"]
            })

        return analysis

    async def analyze_economy(self, series_id, team_focus):
        """
        Detect economy patterns and force buy chains.

        Uses: rounds.phase (eco, force, full), rounds.team_a_loadout_value, team_b_loadout_value
        """
        async with self.db.connection() as conn:
            cursor = await conn.execute("""
                SELECT r.id, r.round_number, r.phase, r.winning_team_id,
                       r.team_a_loadout_value, r.team_b_loadout_value,
                       g.sequence_number as game_number
                FROM rounds r
                JOIN games g ON r.game_id = g.id
                WHERE g.series_id = ?
                ORDER BY g.sequence_number, r.round_number
            """, (series_id,))
            rounds = await cursor.fetchall()

        # Track consecutive losses by phase
        eco_issues = []
        force_streak = []

        for round_data in rounds:
            won = round_data["winning_team_id"] == team_focus
            phase = round_data["phase"]

            # Detect force buy chains
            if phase == "force" and not won:
                force_streak.append({
                    "game": round_data["game_number"],
                    "round": round_data["round_number"]
                })
            else:
                if len(force_streak) >= 2:
                    eco_issues.append({
                        "type": "force_chain",
                        "rounds": force_streak.copy(),
                        "impact": f"Lost {len(force_streak)} consecutive force buys"
                    })
                force_streak = []

            # Detect eco wins (upset)
            if phase == "eco" and won:
                eco_issues.append({
                    "type": "eco_win",
                    "game": round_data["game_number"],
                    "round": round_data["round_number"],
                    "impact": "Won eco round - review what worked"
                })

        return {
            "title": "Economy Management",
            "issues": eco_issues,
            "phase_breakdown": await self._get_phase_breakdown(series_id, team_focus)
        }

    async def _get_phase_breakdown(self, series_id, team_focus):
        """Get win rate by round phase"""
        async with self.db.connection() as conn:
            cursor = await conn.execute("""
                SELECT r.phase,
                       COUNT(*) as total,
                       SUM(CASE WHEN r.winning_team_id = ? THEN 1 ELSE 0 END) as wins
                FROM rounds r
                JOIN games g ON r.game_id = g.id
                WHERE g.series_id = ?
                  AND r.phase IS NOT NULL
                GROUP BY r.phase
            """, (team_focus, series_id))
            rows = await cursor.fetchall()

        return {row["phase"]: {"wins": row["wins"], "total": row["total"]} for row in rows}

    async def analyze_execution_timing(self, series_id, team_focus):
        """
        Analyze site execution timing using spike_events.

        Uses: spike_events.game_time_ms, spike_events.event_type, spike_events.site
        """
        async with self.db.connection() as conn:
            # Get plant events with timing
            cursor = await conn.execute("""
                SELECT se.round_id, se.game_time_ms, se.site,
                       r.round_number, r.winning_team_id, r.duration_ms,
                       g.sequence_number as game_number, g.map_name
                FROM spike_events se
                JOIN rounds r ON se.round_id = r.id
                JOIN games g ON r.game_id = g.id
                WHERE g.series_id = ?
                  AND se.event_type = 'plant_complete'
                ORDER BY g.sequence_number, r.round_number
            """, (series_id,))
            plants = await cursor.fetchall()

        late_executes = []
        site_stats = {}

        for plant in plants:
            # Estimate time remaining (round duration - plant time)
            # Standard VALORANT round is 100,000ms
            ROUND_LENGTH_MS = 100000
            time_at_plant = plant["game_time_ms"] or 0
            time_remaining_ms = ROUND_LENGTH_MS - time_at_plant

            site = plant["site"] or "Unknown"
            if site not in site_stats:
                site_stats[site] = {"total": 0, "wins": 0, "late_plants": 0}

            site_stats[site]["total"] += 1
            if plant["winning_team_id"] == team_focus:
                site_stats[site]["wins"] += 1

            # Late execute = less than 25s remaining at plant
            if time_remaining_ms < 25000:
                site_stats[site]["late_plants"] += 1
                late_executes.append({
                    "game": plant["game_number"],
                    "round": plant["round_number"],
                    "site": site,
                    "time_remaining_sec": time_remaining_ms / 1000,
                    "result": "Won" if plant["winning_team_id"] == team_focus else "Lost"
                })

        return {
            "title": "Site Execution Timing",
            "late_executes": late_executes,
            "site_stats": site_stats,
            "late_execute_count": len(late_executes)
        }

    async def analyze_ultimate_economy(self, series_id, team_focus):
        """
        Compare ultimate orb collection.

        Uses: orb_events table joined with player_round_stats for team info
        """
        async with self.db.connection() as conn:
            cursor = await conn.execute("""
                SELECT prs.team_id, COUNT(*) as orbs
                FROM orb_events oe
                JOIN player_round_stats prs ON oe.round_id = prs.round_id
                    AND oe.player_id = prs.player_id
                JOIN rounds r ON oe.round_id = r.id
                JOIN games g ON r.game_id = g.id
                WHERE g.series_id = ?
                GROUP BY prs.team_id
            """, (series_id,))
            orb_data = await cursor.fetchall()

        team_orbs = 0
        opponent_orbs = 0
        for row in orb_data:
            if row["team_id"] == team_focus:
                team_orbs = row["orbs"]
            else:
                opponent_orbs += row["orbs"]

        return {
            "title": "Ultimate Economy",
            "team_orbs": team_orbs,
            "opponent_orbs": opponent_orbs,
            "differential": team_orbs - opponent_orbs
        }

    async def identify_critical_moments(self, series_id, team_focus):
        """
        Identify clutches and retake situations.

        Uses: player_round_stats.clutch_situation, clutch_won
        Uses: rounds.spike_planted, team_a_alive, team_b_alive
        """
        async with self.db.connection() as conn:
            # Get clutch situations
            cursor = await conn.execute("""
                SELECT prs.round_id, prs.player_id, prs.clutch_won,
                       p.name as player_name,
                       r.round_number, r.winning_team_id,
                       g.sequence_number as game_number
                FROM player_round_stats prs
                JOIN players p ON prs.player_id = p.id
                JOIN rounds r ON prs.round_id = r.id
                JOIN games g ON r.game_id = g.id
                WHERE g.series_id = ?
                  AND prs.clutch_situation = 1
                  AND prs.team_id = ?
                ORDER BY g.sequence_number, r.round_number
            """, (series_id, team_focus))
            clutches = await cursor.fetchall()

            # Get retake situations (spike planted, team at disadvantage)
            cursor = await conn.execute("""
                SELECT r.id, r.round_number, r.team_a_alive, r.team_b_alive,
                       r.winning_team_id, r.spike_planted,
                       g.sequence_number as game_number
                FROM rounds r
                JOIN games g ON r.game_id = g.id
                JOIN series s ON g.series_id = s.id
                WHERE g.series_id = ?
                  AND r.spike_planted = 1
            """, (series_id,))
            retake_rounds = await cursor.fetchall()

        moments = []

        # Add clutch moments
        for clutch in clutches:
            moments.append({
                "type": "clutch",
                "game": clutch["game_number"],
                "round": clutch["round_number"],
                "player": clutch["player_name"],
                "result": "Won" if clutch["clutch_won"] else "Lost"
            })

        # Add disadvantaged retakes
        for round_data in retake_rounds:
            # Determine if team_focus was at disadvantage
            # This requires knowing which team is team_a vs team_b
            # For now, flag any retake with player disadvantage
            alive_diff = abs((round_data["team_a_alive"] or 0) - (round_data["team_b_alive"] or 0))
            if alive_diff >= 2:  # Significant disadvantage
                moments.append({
                    "type": "retake_disadvantage",
                    "game": round_data["game_number"],
                    "round": round_data["round_number"],
                    "alive_diff": alive_diff,
                    "result": "Won" if round_data["winning_team_id"] == team_focus else "Lost"
                })

        return {
            "title": "Critical Moments",
            "moments": moments,
            "clutch_count": len([m for m in moments if m["type"] == "clutch"]),
            "retake_count": len([m for m in moments if m["type"] == "retake_disadvantage"])
        }
```

### Output Format

```
MATCH REVIEW AGENDA
═══════════════════════════════════════════════════
Series: 2692648 - Cloud9 vs Team Liquid
Map: Haven
Final Score: 11-13 (Cloud9 Loss)

CRITICAL REVIEW POINTS:
───────────────────────────────────────────────────

1. PISTOL ROUNDS
   ✗ Round 1 (Attack): Lost
     - Issue: Split A push without smoke cover
   ✗ Round 13 (Defense): Lost
     - Issue: Gave up C-site control without utility
   IMPACT: 0-2 pistol record created -4000 credit disadvantage

2. ECONOMY MANAGEMENT
   ⚠ Round 4: Force buy → Lost
   ⚠ Round 5: Eco → Lost
   ⚠ Round 6: Half buy → Lost
   ANALYSIS: 0-5 deficit from poor pistol → force chain

3. SITE EXECUTION TIMING
   Late executes (<25s remaining): 4 rounds
   Success rate: 25% (1-3)
   RECOMMENDATION: Earlier site takes

4. ULTIMATE ECONOMY
   Orbs collected: 8 vs 13
   IMPACT: -5 orb differential

5. CRITICAL MOMENTS
   → Round 18: 3v5 retake attempted → LOST
   → Round 22: Timeout before eco round
```

### Milestone Test

```bash
python3 -m backend.analytics.macro --test
python3 -m backend.analytics.macro --series 2748766
```

### Actual Output

```
Testing with series: Sentinels vs G2 Esports (101 rounds)

============================================================
MACRO REVIEW: Sentinels vs G2 Esports
Series ID: 2748766
============================================================

GAMES:
  Game 1: split - 13-4
  Game 2: pearl - 8-13
  Game 3: abyss - 13-9
  Game 4: fracture - 5-13
  Game 5: haven - 10-13

Series Result: 2-3
------------------------------------------------------------

[PISTOL ROUNDS]
  Record: 3-7 (30%)
  → Pistol rounds need work (3/10). Consider reviewing buy strategies.

[ECONOMY MANAGEMENT]
  Eco: 6/13 (46%)
  Force: 39/76 (51%)
  Pistol: 3/10 (30%)
  → Lost 2 force buy chain(s). Consider saving for full buys.

[SITE EXECUTION TIMING]
  Plants: 76, Won: 36
  Late executes (<25s): 0

[CRITICAL MOMENTS]
  Clutch situations: 8/56 (14%)
  Notable multi-kills (4K+): 3

============================================================
KEY TAKEAWAYS
============================================================

Areas to Improve:
  • [Pistol Rounds] Pistol rounds need work (3/10).
  • [Economy Management] Lost 2 force buy chain(s).
  • [Critical Moments] Clutch situations: 8/56 (14%).
```

### Files Created

- `backend/analytics/macro.py` - Macro review generator with CLI

---

## Phase 5: Analytics Engine - Hypothetical Analyzer

### Goal

"What if" scenario analysis using historical data matching.

### Methodology

**Not ML - Pure Statistical Matching:**

1. Extract game state at decision point
2. Query `scenario_index` for similar situations
3. Calculate probabilities from outcomes
4. Compare expected values

### Available Data Fields (from Phase 2 Schema)

The `scenario_index` table is pre-built during ETL with these fields:

| Field               | Type    | Description                           |
| ------------------- | ------- | ------------------------------------- |
| `round_id`          | TEXT    | Reference to the round                |
| `game_id`           | TEXT    | Reference to the game                 |
| `round_number`      | INTEGER | Round number (1-24+)                  |
| `attacker_alive`    | INTEGER | Players alive on attacking team (0-5) |
| `defender_alive`    | INTEGER | Players alive on defending team (0-5) |
| `spike_planted`     | BOOLEAN | Whether spike was planted             |
| `time_remaining_ms` | INTEGER | Time remaining in round               |
| `attacker_economy`  | INTEGER | Average loadout value for attackers   |
| `defender_economy`  | INTEGER | Average loadout value for defenders   |
| `attacker_won`      | BOOLEAN | Did attacking team win?               |
| `map_name`          | TEXT    | Map name                              |
| `tournament_id`     | TEXT    | Tournament for filtering              |

**Key Indices for fast queries:**

- `idx_scenario_state`: (attacker_alive, defender_alive, spike_planted)
- `idx_scenario_full`: (attacker_alive, defender_alive, spike_planted, map_name)
- `idx_scenario_economy`: (attacker_economy, defender_economy)

### Hypothetical Analyzer (analytics/hypotheticals.py)

```python
from backend.analytics.confidence import calculate_confidence, wilson_score_interval

class HypotheticalAnalyzer:
    def __init__(self, db):
        self.db = db

    async def analyze_hypothetical(self, series_id, round_num, scenario_type, team_focus=None):
        """
        Analyze a hypothetical decision.

        Args:
            series_id: The series to analyze
            round_num: Round number (1-24+)
            scenario_type: 'save_vs_retake', 'force_vs_eco'
            team_focus: Team ID to analyze for (optional)

        Returns:
            Analysis with probabilities and recommendation
        """
        # 1. Extract game state at decision point
        state = await self.extract_round_state(series_id, round_num, team_focus)

        # 2. Find similar historical scenarios
        similar = await self.find_similar_scenarios(state)

        # 3. Calculate probabilities for each option
        options = self.get_scenario_options(scenario_type)
        analysis = {}

        for option in options:
            current_prob = self.calculate_win_probability(similar)
            next_round_prob = await self.project_next_round(state, option)

            # Expected value over 2 rounds
            if option == "save":
                # Concede current round, full buy next
                ev = 0 + next_round_prob
            else:
                # Try to win current, eco next if fail
                ev = current_prob + (1 - current_prob) * next_round_prob

            analysis[option] = {
                "current_round_win_prob": current_prob if option != "save" else 0,
                "next_round_win_prob": next_round_prob,
                "expected_value": ev,
                "sample_size": len(similar),
                "confidence": calculate_confidence(len(similar), "scenarios")
            }

        # 4. Generate recommendation
        best_option = max(analysis.items(), key=lambda x: x[1]["expected_value"])
        worst_ev = min(a["expected_value"] for a in analysis.values())

        return {
            "series_id": series_id,
            "round_number": round_num,
            "game_state": state,
            "scenario_type": scenario_type,
            "analysis": analysis,
            "recommendation": best_option[0],
            "ev_gain": best_option[1]["expected_value"] - worst_ev,
            "historical_scenarios": len(similar)
        }

    async def extract_round_state(self, series_id, round_num, team_focus=None):
        """
        Extract game state at a specific round.

        Uses: scenario_index (pre-computed), rounds, games
        """
        async with self.db.connection() as conn:
            # Get the round and scenario data
            cursor = await conn.execute("""
                SELECT si.*, r.winning_team_id, r.winning_condition,
                       g.map_name, g.team_a_score, g.team_b_score,
                       s.team_a_id, s.team_b_id
                FROM scenario_index si
                JOIN rounds r ON si.round_id = r.id
                JOIN games g ON si.game_id = g.id
                JOIN series s ON g.series_id = s.id
                WHERE s.id = ?
                  AND si.round_number = ?
                LIMIT 1
            """, (series_id, round_num))
            row = await cursor.fetchone()

            if not row:
                raise ValueError(f"Round {round_num} not found in series {series_id}")

        # Determine if team_focus is attacker or defender
        # Rounds 1-12: team_a attacks, 13-24: team_b attacks (standard VALORANT)
        is_first_half = round_num <= 12
        attacker_is_team_a = is_first_half

        if team_focus:
            team_is_attacker = (team_focus == row["team_a_id"]) == attacker_is_team_a
        else:
            team_is_attacker = True  # Default to attacker perspective

        return {
            "round_id": row["round_id"],
            "map_name": row["map_name"],
            "attacker_alive": row["attacker_alive"],
            "defender_alive": row["defender_alive"],
            "spike_planted": bool(row["spike_planted"]),
            "time_remaining_ms": row["time_remaining_ms"],
            "attacker_economy": row["attacker_economy"],
            "defender_economy": row["defender_economy"],
            "team_is_attacker": team_is_attacker,
            "actual_outcome": bool(row["attacker_won"]) == team_is_attacker
        }

    async def find_similar_scenarios(self, state, tolerance=1):
        """
        Query scenario_index for similar situations.

        Uses indices: idx_scenario_state, idx_scenario_full
        """
        async with self.db.connection() as conn:
            # Exact match on key features
            cursor = await conn.execute("""
                SELECT attacker_alive, defender_alive, spike_planted,
                       attacker_won, COUNT(*) as count
                FROM scenario_index
                WHERE attacker_alive = ?
                  AND defender_alive = ?
                  AND spike_planted = ?
                  AND map_name = ?
                GROUP BY attacker_alive, defender_alive, spike_planted, attacker_won
            """, (
                state["attacker_alive"],
                state["defender_alive"],
                state["spike_planted"],
                state["map_name"]
            ))
            exact_matches = await cursor.fetchall()

            # If not enough exact matches, widen search
            if sum(row["count"] for row in exact_matches) < 10:
                cursor = await conn.execute("""
                    SELECT attacker_alive, defender_alive, spike_planted,
                           attacker_won, COUNT(*) as count
                    FROM scenario_index
                    WHERE attacker_alive BETWEEN ? AND ?
                      AND defender_alive BETWEEN ? AND ?
                      AND spike_planted = ?
                    GROUP BY attacker_alive, defender_alive, spike_planted, attacker_won
                """, (
                    state["attacker_alive"] - tolerance,
                    state["attacker_alive"] + tolerance,
                    state["defender_alive"] - tolerance,
                    state["defender_alive"] + tolerance,
                    state["spike_planted"]
                ))
                exact_matches = await cursor.fetchall()

        return list(exact_matches)

    def calculate_win_probability(self, scenarios):
        """
        Calculate win probability from historical scenarios.

        Returns probability that attacker wins.
        """
        if not scenarios:
            return 0.5  # No data, assume 50/50

        total_wins = sum(row["count"] for row in scenarios if row["attacker_won"])
        total_count = sum(row["count"] for row in scenarios)

        if total_count == 0:
            return 0.5

        # Return point estimate with Wilson interval for confidence
        prob = total_wins / total_count
        lower, upper = wilson_score_interval(total_wins, total_count)

        return prob

    async def project_next_round(self, state, decision):
        """
        Project next round win probability based on decision.

        Uses: scenario_index for economy-based queries
        """
        async with self.db.connection() as conn:
            if decision == "save":
                # Full buy next round: economy >= 4000 per player
                cursor = await conn.execute("""
                    SELECT
                        SUM(CASE WHEN attacker_won = 1 THEN 1 ELSE 0 END) as wins,
                        COUNT(*) as total
                    FROM scenario_index
                    WHERE map_name = ?
                      AND attacker_economy >= 4000
                      AND defender_economy >= 4000
                """, (state["map_name"],))
            elif decision == "retake":
                # Eco next round after failed retake: economy < 2000
                cursor = await conn.execute("""
                    SELECT
                        SUM(CASE WHEN attacker_won = 1 THEN 1 ELSE 0 END) as wins,
                        COUNT(*) as total
                    FROM scenario_index
                    WHERE map_name = ?
                      AND attacker_economy < 2000
                """, (state["map_name"],))
            elif decision == "force":
                # Force buy: economy 2000-3500
                cursor = await conn.execute("""
                    SELECT
                        SUM(CASE WHEN attacker_won = 1 THEN 1 ELSE 0 END) as wins,
                        COUNT(*) as total
                    FROM scenario_index
                    WHERE map_name = ?
                      AND attacker_economy BETWEEN 2000 AND 3500
                """, (state["map_name"],))
            else:
                return 0.5

            row = await cursor.fetchone()
            wins, total = row["wins"] or 0, row["total"] or 0
            return wins / total if total > 0 else 0.5

    @staticmethod
    def get_scenario_options(scenario_type):
        """Get available options for a scenario type"""
        options = {
            "save_vs_retake": ["save", "retake"],
            "force_vs_eco": ["force", "eco"],
            "force_vs_save": ["force", "save"],
        }
        return options.get(scenario_type, ["option_a", "option_b"])
```

### Output Format

```
HYPOTHETICAL ANALYSIS: Round 18 Decision
═══════════════════════════════════════════════════
Series: 2692648 (C9 vs Team Liquid - Haven)
Round: 18
Score: 10-8 (C9 leading)

SCENARIO: "Should we have saved instead of 3v5 retake?"

GAME STATE AT DECISION:
• Players Alive: 3 (C9) vs 5 (TL)
• Spike: Planted C-site
• Time Remaining: 27 seconds
• Weapons: 2 Vandals, 1 Phantom (8,700 credits)

HISTORICAL DATA: 47 similar scenarios
───────────────────────────────────────────────────

Option A: RETAKE ATTEMPT
• Round 18 win probability: 12.8%
• Round 19 win probability (eco): 18%
• Expected Value: 0.265 rounds

Option B: SAVE WEAPONS
• Round 18 win probability: 0%
• Round 19 win probability (full buy): 52%
• Expected Value: 0.52 rounds

RECOMMENDATION: SAVE
───────────────────────────────────────────────────
Expected value gain: +0.255 rounds
Confidence: High (47 historical scenarios)
```

### Milestone Test

```bash
python3 -m backend.analytics.hypotheticals \
  --series 2692648 \
  --round 18 \
  --scenario "save_vs_retake"
```

### Files Created

- `backend/analytics/hypotheticals.py` - Hypothetical analyzer

---

## Phase 6: Backend API

### Goal

REST API serving all analytics features.

### Database Integration Pattern

The API uses the `Database` class from `backend/db/models.py`:

```python
from backend.db.models import Database, get_database

# Get singleton database instance
db = get_database()

# Use async context manager for connections
async with db.connection() as conn:
    cursor = await conn.execute("SELECT * FROM tournaments")
    rows = await cursor.fetchall()
```

### FastAPI Application (api/main.py)

```python
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from contextlib import asynccontextmanager

from backend.db.models import Database, get_database
from backend.analytics.insights import PlayerInsightGenerator
from backend.analytics.macro import MacroReviewGenerator
from backend.analytics.hypotheticals import HypotheticalAnalyzer


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup"""
    db = get_database()
    await db.initialize()
    yield


app = FastAPI(
    title="Lumina API",
    description="Assistant Coach API for VALORANT",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://lumina.vercel.app"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db() -> Database:
    """Dependency to get database instance"""
    return get_database()


# ============================================================
# Data Models (Pydantic)
# ============================================================

class TournamentResponse(BaseModel):
    id: str
    name: str
    start_date: Optional[str]
    end_date: Optional[str]
    series_count: Optional[int]


class SeriesResponse(BaseModel):
    id: str
    tournament_id: str
    team_a_id: Optional[str]
    team_a_name: Optional[str]
    team_b_id: Optional[str]
    team_b_name: Optional[str]
    winner_id: Optional[str]
    game_count: int


class PlayerResponse(BaseModel):
    id: str
    name: str
    team_id: Optional[str]
    team_name: Optional[str]


class PlayerInsightRequest(BaseModel):
    player_id: str
    tournament_ids: Optional[List[str]] = None


class MacroReviewRequest(BaseModel):
    series_id: str
    team_focus: Optional[str] = None


class HypotheticalRequest(BaseModel):
    series_id: str
    round_number: int
    scenario_type: str  # save_vs_retake, force_vs_eco
    team_focus: Optional[str] = None


# ============================================================
# Tournament & Series Endpoints
# ============================================================

@app.get("/api/tournaments", response_model=List[TournamentResponse])
async def list_tournaments(db: Database = Depends(get_db)):
    """List all VCT Americas tournaments"""
    async with db.connection() as conn:
        cursor = await conn.execute("""
            SELECT t.id, t.name, t.start_date, t.end_date,
                   (SELECT COUNT(*) FROM series WHERE tournament_id = t.id) as series_count
            FROM tournaments t
            ORDER BY t.start_date DESC
        """)
        rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@app.get("/api/tournaments/{tournament_id}/series", response_model=List[SeriesResponse])
async def get_tournament_series(tournament_id: str, db: Database = Depends(get_db)):
    """List all series in a tournament with team names"""
    async with db.connection() as conn:
        cursor = await conn.execute("""
            SELECT s.id, s.tournament_id, s.team_a_id, s.team_b_id, s.winner_id,
                   t1.name as team_a_name, t2.name as team_b_name,
                   (SELECT COUNT(*) FROM games WHERE series_id = s.id) as game_count
            FROM series s
            LEFT JOIN teams t1 ON s.team_a_id = t1.id
            LEFT JOIN teams t2 ON s.team_b_id = t2.id
            WHERE s.tournament_id = ?
            ORDER BY s.start_time DESC
        """, (tournament_id,))
        rows = await cursor.fetchall()
    return [dict(row) for row in rows]


@app.get("/api/series/{series_id}/summary")
async def get_series_summary(series_id: str, db: Database = Depends(get_db)):
    """Get series overview with games and player stats"""
    async with db.connection() as conn:
        # Get series info
        cursor = await conn.execute("""
            SELECT s.*, t1.name as team_a_name, t2.name as team_b_name
            FROM series s
            LEFT JOIN teams t1 ON s.team_a_id = t1.id
            LEFT JOIN teams t2 ON s.team_b_id = t2.id
            WHERE s.id = ?
        """, (series_id,))
        series = await cursor.fetchone()
        if not series:
            raise HTTPException(404, "Series not found")

        # Get games
        cursor = await conn.execute("""
            SELECT id, sequence_number, map_name, team_a_score, team_b_score, winner_id
            FROM games WHERE series_id = ?
            ORDER BY sequence_number
        """, (series_id,))
        games = await cursor.fetchall()

        # Get player stats aggregated across series
        cursor = await conn.execute("""
            SELECT p.id, p.name, prs.team_id, t.name as team_name,
                   SUM(prs.kills) as kills,
                   SUM(prs.deaths) as deaths,
                   SUM(prs.assists) as assists,
                   COUNT(*) as rounds_played,
                   SUM(CASE WHEN prs.first_kill = 1 THEN 1 ELSE 0 END) as first_kills,
                   SUM(CASE WHEN prs.first_death = 1 THEN 1 ELSE 0 END) as first_deaths
            FROM player_round_stats prs
            JOIN players p ON prs.player_id = p.id
            JOIN teams t ON prs.team_id = t.id
            JOIN rounds r ON prs.round_id = r.id
            JOIN games g ON r.game_id = g.id
            WHERE g.series_id = ?
            GROUP BY p.id, p.name, prs.team_id, t.name
            ORDER BY kills DESC
        """, (series_id,))
        players = await cursor.fetchall()

    return {
        "series": dict(series),
        "games": [dict(g) for g in games],
        "players": [dict(p) for p in players]
    }


@app.get("/api/players", response_model=List[PlayerResponse])
async def list_players(
    team_id: Optional[str] = None,
    search: Optional[str] = None,
    db: Database = Depends(get_db)
):
    """List players with optional filters"""
    async with db.connection() as conn:
        query = """
            SELECT p.id, p.name, p.team_id, t.name as team_name
            FROM players p
            LEFT JOIN teams t ON p.team_id = t.id
            WHERE 1=1
        """
        params = []

        if team_id:
            query += " AND p.team_id = ?"
            params.append(team_id)

        if search:
            query += " AND p.name LIKE ?"
            params.append(f"%{search}%")

        query += " ORDER BY p.name"

        cursor = await conn.execute(query, params)
        rows = await cursor.fetchall()

    return [dict(row) for row in rows]


@app.get("/api/players/{player_id}")
async def get_player(player_id: str, db: Database = Depends(get_db)):
    """Get player details with career stats"""
    async with db.connection() as conn:
        # Player info
        cursor = await conn.execute("""
            SELECT p.id, p.name, p.team_id, t.name as team_name
            FROM players p
            LEFT JOIN teams t ON p.team_id = t.id
            WHERE p.id = ?
        """, (player_id,))
        player = await cursor.fetchone()
        if not player:
            raise HTTPException(404, "Player not found")

        # Aggregate stats
        cursor = await conn.execute("""
            SELECT
                COUNT(DISTINCT g.series_id) as series_played,
                COUNT(DISTINCT g.id) as games_played,
                COUNT(*) as rounds_played,
                SUM(prs.kills) as total_kills,
                SUM(prs.deaths) as total_deaths,
                SUM(prs.assists) as total_assists,
                SUM(CASE WHEN prs.first_kill = 1 THEN 1 ELSE 0 END) as first_kills,
                SUM(CASE WHEN prs.first_death = 1 THEN 1 ELSE 0 END) as first_deaths,
                SUM(CASE WHEN prs.clutch_won = 1 THEN 1 ELSE 0 END) as clutches_won,
                SUM(CASE WHEN prs.clutch_situation = 1 THEN 1 ELSE 0 END) as clutch_situations
            FROM player_round_stats prs
            JOIN rounds r ON prs.round_id = r.id
            JOIN games g ON r.game_id = g.id
            WHERE prs.player_id = ?
        """, (player_id,))
        stats = await cursor.fetchone()

    return {
        "player": dict(player),
        "stats": dict(stats) if stats else {}
    }


# ============================================================
# Analysis Endpoints
# ============================================================

@app.post("/api/analysis/player-insights")
async def generate_player_insights(
    request: PlayerInsightRequest,
    db: Database = Depends(get_db)
):
    """Generate comprehensive insights for a player"""
    generator = PlayerInsightGenerator(db)

    insights = {
        "player_id": request.player_id,
        "insights": []
    }

    # Get player name
    async with db.connection() as conn:
        cursor = await conn.execute(
            "SELECT name FROM players WHERE id = ?",
            (request.player_id,)
        )
        row = await cursor.fetchone()
        if row:
            insights["player_name"] = row["name"]

    # Generate all insight types
    insights["insights"].append(
        await generator.calculate_first_death_impact(
            request.player_id, request.tournament_ids
        )
    )
    insights["insights"].append(
        await generator.analyze_trading_efficiency(request.player_id)
    )
    insights["insights"].append(
        await generator.analyze_opening_duels(request.player_id)
    )
    insights["insights"].append(
        await generator.analyze_clutch_performance(request.player_id)
    )
    insights["insights"].append(
        await generator.analyze_agent_performance(request.player_id)
    )

    return insights


@app.post("/api/analysis/macro-review")
async def generate_macro_review(
    request: MacroReviewRequest,
    db: Database = Depends(get_db)
):
    """Generate macro review agenda for a series"""
    generator = MacroReviewGenerator(db)
    review = await generator.generate_review_agenda(
        request.series_id,
        request.team_focus
    )
    return review


@app.post("/api/analysis/hypothetical")
async def analyze_hypothetical(
    request: HypotheticalRequest,
    db: Database = Depends(get_db)
):
    """Analyze hypothetical scenario"""
    analyzer = HypotheticalAnalyzer(db)
    result = await analyzer.analyze_hypothetical(
        request.series_id,
        request.round_number,
        request.scenario_type,
        request.team_focus
    )
    return result


# ============================================================
# Health Check
# ============================================================

@app.get("/api/health")
async def health_check(db: Database = Depends(get_db)):
    """API health check with database stats"""
    stats = await db.get_stats()
    return {
        "status": "healthy",
        "database": stats
    }
```

### API Endpoints Summary

| Method | Endpoint                        | Description                      |
| ------ | ------------------------------- | -------------------------------- |
| GET    | `/api/tournaments`              | List all tournaments             |
| GET    | `/api/tournaments/{id}/series`  | List series in tournament        |
| GET    | `/api/series/{id}/summary`      | Series overview with stats       |
| GET    | `/api/players`                  | List players (filterable)        |
| GET    | `/api/players/{id}`             | Player details with career stats |
| POST   | `/api/analysis/player-insights` | Generate player insights         |
| POST   | `/api/analysis/macro-review`    | Generate review agenda           |
| POST   | `/api/analysis/hypothetical`    | Analyze what-if scenario         |
| GET    | `/api/health`                   | Health check with DB stats       |

### Milestone Test

```bash
# Start server
cd grid-gg
uvicorn backend.api.main:app --reload

# Test endpoints
curl http://localhost:8000/api/health
curl http://localhost:8000/api/tournaments
curl http://localhost:8000/api/players?search=Oxy
curl http://localhost:8000/api/series/2629390/summary

# Test analysis endpoints
curl -X POST http://localhost:8000/api/analysis/player-insights \
  -H "Content-Type: application/json" \
  -d '{"player_id": "12345"}'

curl -X POST http://localhost:8000/api/analysis/hypothetical \
  -H "Content-Type: application/json" \
  -d '{"series_id": "2629390", "round_number": 18, "scenario_type": "save_vs_retake"}'
```

### Files Created

- `backend/api/__init__.py`
- `backend/api/main.py` - FastAPI application with all routes
- `backend/api/schemas.py` - Pydantic models (optional, can be in main.py)

---

## Phase 7: Frontend UI

### Goal

Professional coaching interface with VALORANT aesthetic.

### Tech Stack

- Framework: Next.js 14 (App Router)
- Styling: TailwindCSS + shadcn/ui
- State: TanStack Query
- Charts: Recharts

### Design System

**Colors:**

```css
:root {
    --valorant-red: #ff4655;
    --valorant-dark: #0f1923;
    --background: #0d1117;
    --surface: #161b22;
    --text: #ffffff;
    --text-muted: #8b949e;
}
```

**Typography:**

- Headers: Bebas Neue or DIN Next
- Body: Inter

### Page Structure

```
/                           → Landing page
/tournaments                → Tournament list
/tournaments/[id]/series    → Series list
/series/[id]                → Match dashboard
├── /series/[id]/insights   → Player insights
├── /series/[id]/review     → Macro review
└── /series/[id]/hypothetical → What-if analyzer
```

### Key Components

**1. Series Dashboard**

```tsx
export default function SeriesDashboard({ seriesId }) {
    const { data: series } = useQuery(["series", seriesId], fetchSeries)

    return (
        <div className="min-h-screen bg-background">
            <MatchHeader
                teams={series.teams}
                score={series.score}
                map={series.map}
            />

            <QuickStats>
                <StatCard title="Pistols" value={series.pistolRecord} />
                <StatCard title="Force Buys" value={series.forceRecord} />
                <StatCard title="Ult Orbs" value={series.orbDiff} />
            </QuickStats>

            <RoundTimeline rounds={series.rounds} />

            <ActionButtons>
                <Button href={`/series/${seriesId}/insights`}>
                    View Insights
                </Button>
                <Button href={`/series/${seriesId}/review`}>
                    Generate Review
                </Button>
                <Button href={`/series/${seriesId}/hypothetical`}>
                    Analyze Scenario
                </Button>
            </ActionButtons>
        </div>
    )
}
```

**2. Player Insights View**

```tsx
export default function InsightsView({ seriesId }) {
    const [selectedPlayer, setSelectedPlayer] = useState(null)
    const { data: insights } = useQuery(
        ["insights", selectedPlayer],
        () => fetchInsights(selectedPlayer),
        { enabled: !!selectedPlayer },
    )

    return (
        <div>
            <PlayerSelector players={players} onSelect={setSelectedPlayer} />

            <InsightsList>
                {insights?.map((insight) => (
                    <InsightCard
                        key={insight.metric}
                        data={insight.data}
                        impact={insight.impact}
                        recommendation={insight.recommendation}
                        confidence={insight.confidence}
                    />
                ))}
            </InsightsList>

            <InsightChart data={insights} />
        </div>
    )
}
```

**3. Hypothetical Analyzer**

```tsx
export default function HypotheticalView({ seriesId }) {
    const [round, setRound] = useState(null)
    const [scenario, setScenario] = useState("save_vs_retake")

    const { data: analysis } = useMutation(analyzeHypothetical)

    return (
        <div>
            <RoundSelector rounds={rounds} onSelect={setRound} />

            {round && (
                <>
                    <GameStateDisplay state={round.state} />

                    <ScenarioSelector value={scenario} onChange={setScenario} />

                    <Button
                        onClick={() =>
                            analysis.mutate({ seriesId, round, scenario })
                        }
                    >
                        Analyze
                    </Button>

                    {analysis.data && (
                        <ProbabilityComparison
                            options={analysis.data.analysis}
                            recommendation={analysis.data.recommendation}
                        />
                    )}
                </>
            )}
        </div>
    )
}
```

### Setup Commands

```bash
cd frontend
npx create-next-app@latest . --typescript --tailwind --app
npx shadcn-ui@latest init
npm install @tanstack/react-query recharts
```

### Milestone Test

- Navigate through all pages
- Generate insights for a player
- View macro review
- Run hypothetical analysis

### Files Created

- `frontend/app/page.tsx` - Landing page
- `frontend/app/tournaments/page.tsx`
- `frontend/app/series/[id]/page.tsx`
- `frontend/components/` - UI components

---

## Phase 8: Integration & Polish

### Goal

End-to-end testing, optimization, and deployment.

### Tasks

**1. End-to-End Testing**

- Test all 3 core features with real VCT data
- Verify data accuracy against known match results
- Test edge cases (incomplete data, missing events)

**2. Performance Optimization**

- Add Redis/in-memory caching for API responses
- Optimize slow database queries
- Implement frontend code splitting

**3. Error Handling**

- Graceful degradation for missing data
- User-friendly error messages
- Logging and monitoring

**4. Deployment**

| Component | Platform | URL               |
| --------- | -------- | ----------------- |
| Frontend  | Vercel   | lumina.vercel.app |
| Backend   | Railway  | api.lumina.app    |
| Database  | Railway  | (internal)        |

```bash
# Frontend deployment
cd frontend
vercel deploy --prod

# Backend deployment
cd backend
railway up
```

**5. Demo Preparation**

- Pre-load demo scenarios
- Prepare 3-5 minute walkthrough video
- Create presentation deck

### Deployment Checklist

- [ ] Environment variables configured
- [ ] Database populated with VCT data
- [ ] API endpoints tested
- [ ] CORS configured
- [ ] SSL certificates active
- [ ] Demo scenarios ready
- [ ] Video recorded

### Milestone Test

- Live URL accessible
- All 3 core features working
- Response times <2s

---

## Quick Reference

### Commands by Phase

| Phase | Command                                                                  |
| ----- | ------------------------------------------------------------------------ |
| 1     | `python3 -m backend.etl.grid_client --test`                              |
| 2     | `python3 -m backend.etl.run_etl --tournaments all`                       |
| 3     | `python3 -m backend.analytics.insights --player "Oxy"`                   |
| 4     | `python3 -m backend.analytics.macro --series 2692648`                    |
| 5     | `python3 -m backend.analytics.hypotheticals --series 2692648 --round 18` |
| 6     | `uvicorn backend.api.main:app --reload`                                  |
| 7     | `cd frontend && npm run dev`                                             |
| 8     | Deploy + demo                                                            |

### File Structure (Complete)

```
grid-gg/
├── backend/
│   ├── __init__.py
│   ├── etl/
│   │   ├── __init__.py
│   │   ├── grid_client.py
│   │   ├── data_processor.py
│   │   ├── db_loader.py
│   │   ├── scenario_indexer.py
│   │   └── run_etl.py
│   ├── analytics/
│   │   ├── __init__.py
│   │   ├── insights.py
│   │   ├── macro.py
│   │   ├── hypotheticals.py
│   │   └── confidence.py
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── routes/
│   │   │   ├── tournaments.py
│   │   │   └── analysis.py
│   │   └── schemas.py
│   ├── db/
│   │   ├── __init__.py
│   │   ├── schema.sql
│   │   └── models.py
│   └── tests/
├── frontend/
│   ├── app/
│   ├── components/
│   └── lib/
├── data/
│   ├── lumina.db
│   └── events/
├── docs/
│   ├── project_brd.md
│   └── implementation_guide.md
├── requirements.txt
├── .env.example
└── .gitignore
```
