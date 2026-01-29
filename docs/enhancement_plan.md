# Lumina Enhancement Plan

Based on analysis of advanced esports analytics (C9 vs NRG VCT analysis), this document outlines enhancements to match and exceed that level of insight.

## Gap Analysis: Current vs Target

### What We Have ✅

| Feature                                   | Status     |
| ----------------------------------------- | ---------- |
| Basic round stats (kills, deaths, FK, FD) | ✅ Working |
| Trade detection (within 5s)               | ✅ Working |
| Clutch detection (1vN)                    | ✅ Working |
| Economy phase classification              | ✅ Working |
| Pistol round analysis                     | ✅ Working |
| Multi-kill tracking                       | ✅ Working |

### What We're Missing ❌

| Feature                                     | Priority | Impact                 |
| ------------------------------------------- | -------- | ---------------------- |
| **Time-to-first-contact** per round         | HIGH     | Anti-strat detection   |
| **FB conversion rate** (won FB → won round) | HIGH     | Core metric            |
| **Untraded death tracking** (per round)     | HIGH     | Trade discipline       |
| **Round-by-round breakdown**                | HIGH     | VOD review             |
| **Per-player opening duel stats**           | HIGH     | Individual analysis    |
| **Attack/Defense side tracking**            | MEDIUM   | Side-specific patterns |
| **Plant timing** (time remaining at plant)  | MEDIUM   | Execution analysis     |
| **Post-plant win rate**                     | MEDIUM   | Situational strength   |
| **LLM-powered natural language output**     | MEDIUM   | User experience        |
| **Loss streak detection**                   | LOW      | Momentum analysis      |

---

## Enhancement 1: Timing Data Improvements

### Current Issue

- `kill_events.game_time_ms` has data (21,162 of 24,780 non-zero)
- `spike_events.game_time_ms` is always 0
- No round-level time-to-first-contact

### Solution

Add computed fields during ETL:

```sql
-- New columns for rounds table
ALTER TABLE rounds ADD COLUMN time_to_first_kill_ms INTEGER;
ALTER TABLE rounds ADD COLUMN time_to_plant_ms INTEGER;
ALTER TABLE rounds ADD COLUMN round_duration_ms INTEGER;

-- New columns for player_round_stats
ALTER TABLE player_round_stats ADD COLUMN time_of_death_ms INTEGER;
ALTER TABLE player_round_stats ADD COLUMN time_of_first_kill_ms INTEGER;
```

---

## Enhancement 2: Advanced Metrics

### 2.1 First Blood Conversion

Track: "Won first blood but lost round" - key anti-strat signal.

```python
# Add to macro.py
async def analyze_fb_conversion(self, series_id, team_focus):
    """Track first blood conversion rate"""
    # Query rounds where team got FB
    # Calculate: FB won → round won %
    # Flag rounds where FB won but round lost
```

### 2.2 Untraded Death Analysis

Track untraded deaths per round (not just per player aggregate).

```python
# New insight type
async def analyze_trade_discipline(self, series_id, team_focus):
    """Track untraded deaths and trade rate per round"""
    # Query: deaths where traded = FALSE
    # Group by round
    # Calculate team-level trade rate
```

### 2.3 Opening Duel Matrix

Per-player opening duel results (FK/FD by player).

```python
# New insight type
async def get_opening_duel_matrix(self, series_id, team_focus):
    """Get FB/FD stats per player"""
    # Already have first_kill, first_death per round
    # Aggregate to player level with map/side breakdown
```

---

## Enhancement 3: Anti-Strat Detection

### Signals to Detect

1. **Repeated early deaths** - Same player dying first at similar timings
2. **Time-to-contact shifting** - Getting slower (being read)
3. **Low FB conversion** - Winning duels but losing rounds
4. **Clustered deaths** - Deaths happening in same area/timing

```python
class AntiStratDetector:
    async def detect_timing_patterns(self, series_id, player_id):
        """Detect if opponent is reading player's timing"""
        # Get all opening deaths for player
        # Check if death times are clustering
        # Flag if deaths getting faster (opponent anticipating)

    async def detect_positional_reads(self, series_id, team_id):
        """Detect if entries are being shut down consistently"""
        # Track entry player death locations
        # Flag repeated deaths in same spots
```

---

## Enhancement 4: Round-by-Round Breakdown

### New Module: `backend/analytics/round_breakdown.py`

```python
class RoundBreakdown:
    async def get_full_breakdown(self, series_id, team_focus=None):
        """Generate complete round-by-round analysis"""
        return {
            "maps": [
                {
                    "map_name": "Haven",
                    "rounds": [
                        {
                            "round_number": 1,
                            "side": "Attack",
                            "first_blood": {"player": "OXY", "time_ms": 30000, "won": True},
                            "result": "Won",
                            "final_score": "5-1",
                            "untraded_deaths": 0,
                            "plant_time_ms": 45000,
                            "key_event": "OXY 4K"
                        },
                        # ... more rounds
                    ]
                }
            ]
        }
```

---

## Enhancement 5: LLM Integration

### Architecture

```
User Query → Analytics Engine → Raw Data → LLM → Natural Language Response
```

### Implementation: `backend/analytics/llm_analyst.py`

```python
import openai
from backend.analytics.macro import MacroReviewGenerator
from backend.analytics.insights import PlayerInsightGenerator

class LLMAnalyst:
    def __init__(self, db, api_key=None):
        self.db = db
        self.macro = MacroReviewGenerator(db)
        self.insights = PlayerInsightGenerator(db)
        self.client = openai.OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))

    async def analyze(self, query: str, series_id: str = None, player_id: str = None):
        """Generate natural language analysis from data"""

        # 1. Gather relevant data based on query
        context = await self._gather_context(query, series_id, player_id)

        # 2. Build prompt with data
        prompt = self._build_prompt(query, context)

        # 3. Generate response
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": ANALYST_SYSTEM_PROMPT},
                {"role": "user", "content": prompt}
            ]
        )

        return {
            "analysis": response.choices[0].message.content,
            "data_sources": context["sources"],
            "confidence": context["confidence"]
        }

ANALYST_SYSTEM_PROMPT = """You are a professional VALORANT esports analyst.
You analyze match data to provide actionable coaching insights.

Guidelines:
- Be specific and tactical, not generic
- Reference actual round numbers and player names
- Identify patterns and anti-strat signals
- Provide actionable fixes, not just observations
- Use data to support every claim

Format your response as:
SUMMARY (2-3 bullets)
KEY METRICS (table)
ANTI-STRAT SIGNALS (if any)
FORCED MISTAKES (specific rounds)
ACTION PLAN (tactical fixes)
"""
```

---

## Enhancement 6: Schema Updates

### New Tables

```sql
-- Round-level aggregates for faster queries
CREATE TABLE IF NOT EXISTS round_stats_agg (
    round_id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL,
    team_a_fb_won BOOLEAN,
    team_a_kills INTEGER,
    team_a_deaths INTEGER,
    team_a_untraded_deaths INTEGER,
    team_b_fb_won BOOLEAN,
    team_b_kills INTEGER,
    team_b_deaths INTEGER,
    team_b_untraded_deaths INTEGER,
    time_to_first_kill_ms INTEGER,
    time_to_plant_ms INTEGER,
    post_plant_winner TEXT,
    FOREIGN KEY (round_id) REFERENCES rounds(id),
    FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Player game aggregates
CREATE TABLE IF NOT EXISTS player_game_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    team_id TEXT NOT NULL,
    kills INTEGER DEFAULT 0,
    deaths INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    first_kills INTEGER DEFAULT 0,
    first_deaths INTEGER DEFAULT 0,
    traded_deaths INTEGER DEFAULT 0,
    untraded_deaths INTEGER DEFAULT 0,
    clutch_attempts INTEGER DEFAULT 0,
    clutch_wins INTEGER DEFAULT 0,
    multi_kills_2k INTEGER DEFAULT 0,
    multi_kills_3k INTEGER DEFAULT 0,
    multi_kills_4k INTEGER DEFAULT 0,
    aces INTEGER DEFAULT 0,
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (player_id) REFERENCES players(id),
    UNIQUE(game_id, player_id)
);
```

---

## Implementation Priority

### Phase 4 Enhancements ✅ COMPLETE

1. ✅ Basic macro review (done)
2. ✅ FB conversion tracking (`macro.py:analyze_fb_conversion`)
3. ✅ Untraded death per-round tracking (`macro.py:analyze_trade_discipline`)
4. ✅ Opening duel matrix (`macro.py:analyze_opening_duels`)
5. ✅ Round-by-round breakdown (`round_breakdown.py`)
6. ✅ LLM integration (`llm_analyst.py`)

### Phase 5 Enhancements

1. Hypothetical analyzer (as planned)
2. Add anti-strat detection module

### Phase 6 Enhancements

1. ✅ LLM integration for natural language (moved to Phase 4)
2. Round-by-round breakdown API endpoint
3. Player analysis API endpoint

### Phase 7 Enhancements

1. Frontend for all new features
2. Interactive round timeline

---

## Output Format Comparison

### Current Output

```
[PISTOL ROUNDS]
  Record: 3-7 (30%)
  → Pistol rounds need work (3/10).
```

### Target Output

```
PISTOL ROUNDS
Round 1 (Attack): Won
  - First Blood: OXY @ 30s → Converted
  - Final: 5-1 elimination
Round 13 (Defense): Lost
  - First Blood: Lost to mada @ 32s
  - Final: 2-5, 4 untraded deaths

PATTERN: Won 3/10 pistols, but FB conversion 76.9%
INSIGHT: Losing pistols isn't FB issue - it's post-FB structure collapse
```

---

## Success Metrics

After enhancements, we should be able to answer:

1. "Why did C9 lose to NRG?" → Specific tactical failures
2. "Who needs to improve?" → Individual FB/trade metrics
3. "What rounds to review?" → Prioritized VOD list
4. "What's the fix?" → Specific tactical adjustments

All with natural language output powered by LLM.
