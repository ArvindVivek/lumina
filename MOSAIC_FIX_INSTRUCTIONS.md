# Mosaic Materialized Views Fix

## Problem Summary

Mosaic shows 0 for players and other analytics because the database functions use `WHERE series_id = ANY(p_series_ids)`, which returns no results when `p_series_ids` is an empty array `[]`. The Mosaic app calls these functions with empty arrays to mean "all series", but the SQL interprets empty arrays as "no matches".

## Root Cause

In the following functions:
- `mosaic.get_team_players_summary()`
- `mosaic.get_team_strategies_summary()`

The WHERE clause uses:
```sql
WHERE g.series_id = ANY(p_series_ids)
```

When `p_series_ids = []`, `ANY([])` returns no rows.

## Solution

Change the WHERE clause to:
```sql
WHERE (CARDINALITY(p_series_ids) = 0 OR g.series_id = ANY(p_series_ids))
```

This means: "If the array is empty, include all series; otherwise filter by the array".

## How to Apply the Fix

### Option 1: Supabase Dashboard (Recommended)

1. Go to [Supabase Dashboard SQL Editor](https://supabase.com/dashboard/project/fbloukfgdjvwzdgrcnzt/sql)
2. Click "New Query"
3. Copy and paste the entire contents of:
   `/Users/arvind/Documents/Hackathons/Cloud9 x JetBrains 2026/lumina/supabase/migrations/20260202000001_fix_mosaic_empty_series_arrays.sql`
4. Click "Run"

### Option 2: Using psql (if you have it installed)

```bash
psql "postgresql://postgres:Eaglestrike#123@db.fbloukfgdjvwzdgrcnzt.supabase.co:5432/postgres" -f supabase/migrations/20260202000001_fix_mosaic_empty_series_arrays.sql
```

### Option 3: Workaround (Temporary - without applying migration)

Modify the Mosaic app to always pass all series IDs instead of an empty array:

```typescript
// In app/lib/cache/report-cache.ts or wherever filters are used
const filters = {
  teamId: params.teamId,
  seriesIds: params.seriesIds?.length > 0
    ? params.seriesIds
    : await getAllSeriesIdsForTeam(params.teamId) // Fetch all series IDs
};
```

## Testing After Fix

Run this test script to verify the fix:

```bash
cd /Users/arvind/Documents/Hackathons/Cloud9\ x\ JetBrains\ 2026/lumina
npx tsx scripts/test-player-summary-fix.ts
```

Expected output:
- Test 1 (empty array): Should return players (currently returns 0)
- Test 2 (actual series): Should return players (already works)

## Additional Notes

### Materialized Views Status

The materialized views were successfully refreshed:
- ✅ `mosaic.mv_round_acs`
- ✅ `mosaic.mv_player_core_stats`
- ✅ `mosaic.mv_player_agent_pool`
- ✅ `mosaic.mv_team_map_stats`
- ✅ `mosaic.mv_team_compositions`

Refresh time: ~7 seconds (not timing out)

### Database Data Verified

- ✅ 196 series
- ✅ 500 games
- ✅ 10,357 rounds
- ✅ 103,570 player stats
- ✅ 107 players
- ✅ 12 teams
- ✅ 72,208 kill events

### Working Functions

These functions are working correctly:
- ✅ `get_team_strategies_summary()` - returns pistol patterns, economy patterns, site preferences
- ✅ `get_map_win_rates()` - returns per-map performance
- ✅ `refresh_all_mosaic_views()` - refreshes all views in ~7 seconds

### Functions Needing Fix

These functions return empty results with empty arrays:
- ❌ `get_team_players_summary()` - returns [] with empty array
- ⚠️ Any other functions that use `ANY(p_series_ids)` without the CARDINALITY check

## Migration File Location

```
/Users/arvind/Documents/Hackathons/Cloud9 x JetBrains 2026/lumina/supabase/migrations/20260202000001_fix_mosaic_empty_series_arrays.sql
```

## Next Steps After Fix

1. Apply the migration via Supabase Dashboard
2. Test that empty arrays work: `npx tsx scripts/test-player-summary-fix.ts`
3. Test the /reports page in Mosaic app
4. Verify real data shows up instead of 0s
5. Commit the migration file to git
6. Document the fix in the project README

## Files Created/Modified

- ✅ Created migration: `20260202000001_fix_mosaic_empty_series_arrays.sql`
- ✅ Created test scripts:
  - `scripts/fix-mosaic-views.ts`
  - `scripts/verify-view-data.ts`
  - `scripts/test-wrapper-functions.ts`
  - `scripts/test-player-summary-fix.ts`
  - `scripts/manual-fix-functions.ts`
