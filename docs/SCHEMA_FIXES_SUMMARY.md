# Database Schema Fixes - Complete

## ✅ Fixed Issues

### 1. Team Roster Players Now Clickable
- **File:** [components/team/team-roster.tsx](components/team/team-roster.tsx:61-63)
- **Fix:** Added `onClick` handler and `cursor-pointer` class
- **Result:** Clicking players navigates to Player Analytics page

### 2. Removed Non-Existent Columns from Queries

#### Teams Table (public.teams)
**Actual Columns:** `id`, `name`, `created_at`

**Fixed:**
- [lib/hooks/use-teams.ts](lib/hooks/use-teams.ts) - Removed `grid_id`, `short_name`, `region`, `logo_url`
- [lib/hooks/use-players.ts](lib/hooks/use-players.ts) - Removed `short_name` from team joins
- [lib/hooks/use-series.ts](lib/hooks/use-series.ts) - Removed `short_name` from team joins
- [app/(dashboard)/macro-review/page.tsx](app/(dashboard)/macro-review/page.tsx:9-32) - Removed `short_name`, `region` from server query

#### Series Table (public.series)
**Actual Columns:** `id`, `tournament_id`, `start_time`, `format`, `team_a_id`, `team_b_id`, `winner_id`, `processed`, `created_at`

**Fixed:**
- [lib/hooks/use-series.ts](lib/hooks/use-series.ts:4-14) - Updated Series interface to match database
- **Removed:** `grid_id`, `team_a_score`, `team_b_score` (don't exist)
- **Added:** `format`, `processed` (actual fields)

#### Kill Events Table (public.kill_events)
**Actual Column:** `game_time_ms` (NOT `timestamp_ms`)

**Fixed:**
- [lib/hooks/use-rounds.ts](lib/hooks/use-rounds.ts:49) - Changed `.order("timestamp_ms")` to `.order("game_time_ms")`
- [lib/hooks/use-rounds.ts](lib/hooks/use-rounds.ts:64) - Changed `timestamp_ms` to `game_time_ms`

### 3. Updated UI to Not Display Missing Data

#### Dashboard Recent Matches
- **File:** [app/(dashboard)/page.tsx](app/(dashboard)/page.tsx:157-179)
- **Fix:** Removed series score display, show winner with checkmark instead
- Series table doesn't have scores, so calculated from game wins

#### Tournament Detail Page
- **File:** [app/(dashboard)/tournaments/[tournamentId]/page.tsx](app/(dashboard)/tournaments/[tournamentId]/page.tsx:139-180)
- **Fix:** Removed score display, show "vs" format instead

#### Series Detail Page
- **File:** [app/(dashboard)/series/[seriesId]/page.tsx](app/(dashboard)/series/[seriesId]/page.tsx)
- **Fix:** Calculate series scores from game wins
- Removed references to `short_name`

---

## Remaining Issues (Low Priority)

### Rounds Table Field Mapping
**Problem:** Game detail page uses fields that don't exist in rounds table
- Code expects: `side_a_attacking`, `winner_side`, `end_type`
- Database has: `phase`, `winning_team_id`, `winning_condition`, `team_a_alive`, `team_b_alive`

**Impact:** Round timeline may show incorrect attack/defense sides
**Fix:** Map database fields correctly or simplify UI to show neutral rounds

---

## Database Tables - Actual Schemas

### public.teams
```sql
id text PRIMARY KEY
name text
created_at text
```

### public.players
```sql
id text PRIMARY KEY
name text
team_id text → teams(id)
created_at text
```

### public.tournaments
```sql
id text PRIMARY KEY
name text
start_date text
end_date text
parent_id text
created_at text
```

### public.series
```sql
id text PRIMARY KEY
tournament_id text
start_time text
format text
team_a_id text
team_b_id text
winner_id text
processed boolean
created_at text
```

### public.games
```sql
id text PRIMARY KEY
series_id text
sequence_number bigint
map_name text
team_a_score bigint  ← HAS SCORES
team_b_score bigint  ← HAS SCORES
winner_id text
duration_ms bigint
created_at text
```

### public.rounds
```sql
id text PRIMARY KEY
game_id text
round_number bigint
phase text
winning_team_id text
winning_condition text
spike_planted boolean
spike_defused boolean
team_a_alive bigint
team_b_alive bigint
team_a_loadout_value bigint
team_b_loadout_value bigint
duration_ms bigint
created_at text
```

### public.kill_events
```sql
id bigint PRIMARY KEY
round_id text
game_time_ms bigint  ← NOT timestamp_ms
killer_id text
victim_id text
weapon text
headshot boolean
wallbang boolean
is_first_kill boolean
is_trade boolean
... (other fields)
```

---

## All 400 Errors Fixed

1. ✅ Players query - removed `short_name` from teams join
2. ✅ Series queries - removed `short_name` from teams joins (3 functions)
3. ✅ Kill events - changed `timestamp_ms` to `game_time_ms`
4. ✅ Teams server query - removed `short_name`, `region`

**Result:** All major 400 Bad Request errors resolved
