#!/bin/bash
# Lumina Migration Validation Script
# Note: Original migration used SQLite source (now archived)
# This script validates PostgreSQL data in the lumina schema

PG_CONN="postgresql://postgres:postgres@localhost:54322/postgres"
PSQL="/opt/homebrew/opt/libpq/bin/psql"
SCHEMA="lumina"

echo "=== Row Count Validation (lumina schema) ==="
echo ""

TABLES="tournaments teams players series games rounds player_round_stats kill_events spike_events orb_events ability_events kill_assists scenario_index"

for table in $TABLES; do
  pg_count=$($PSQL "$PG_CONN" -t -c "SELECT COUNT(*) FROM ${SCHEMA}.${table};" 2>/dev/null | tr -d ' ')
  echo "  ${SCHEMA}.${table}: $pg_count rows"
done

echo ""
echo "=== Sample Analytics Query (First Death Count by Player) ==="
echo ""

$PSQL "$PG_CONN" -c "
SELECT p.name, COUNT(*) as first_deaths
FROM ${SCHEMA}.player_round_stats prs
JOIN ${SCHEMA}.players p ON prs.player_id = p.id
WHERE prs.first_death = TRUE
GROUP BY p.id, p.name
ORDER BY first_deaths DESC
LIMIT 5;
"

echo ""
echo "=== Type Verification ==="
echo ""

# Check boolean type
bool_type=$($PSQL "$PG_CONN" -t -c "
SELECT data_type FROM information_schema.columns
WHERE table_schema = '${SCHEMA}' AND table_name = 'player_round_stats' AND column_name = 'first_death';
" | tr -d ' ')

if [ "$bool_type" = "boolean" ]; then
  echo "  first_death column: boolean [OK]"
else
  echo "  first_death column: $bool_type [FAIL - expected boolean]"
  ALL_MATCH=false
fi

# Check timestamp type
ts_type=$($PSQL "$PG_CONN" -t -c "
SELECT data_type FROM information_schema.columns
WHERE table_schema = '${SCHEMA}' AND table_name = 'tournaments' AND column_name = 'start_date';
" | tr -d ' ')

if [ "$ts_type" = "timestampwithtimezone" ]; then
  echo "  start_date column: timestamptz [OK]"
else
  echo "  start_date column: $ts_type [FAIL - expected timestamptz]"
  ALL_MATCH=false
fi

echo ""
echo "=== Index Verification ==="
echo ""

# Count optimized indexes
index_count=$($PSQL "$PG_CONN" -t -c "SELECT count(*) FROM pg_indexes WHERE schemaname = '${SCHEMA}';" | tr -d ' ')

if [ "$index_count" -ge 45 ]; then
  echo "  Total indexes: $index_count [OK - expected 45+]"
else
  echo "  Total indexes: $index_count [FAIL - expected 45+]"
  ALL_MATCH=false
fi

# Check partial index for first_death exists
partial_idx=$($PSQL "$PG_CONN" -t -c "SELECT indexname FROM pg_indexes WHERE schemaname = '${SCHEMA}' AND indexname = 'idx_prs_first_death_partial';" | tr -d ' ')
if [ "$partial_idx" = "idx_prs_first_death_partial" ]; then
  echo "  Partial index (first_death): exists [OK]"
else
  echo "  Partial index (first_death): missing [FAIL]"
  ALL_MATCH=false
fi

# Check scenario index exists
scenario_idx=$($PSQL "$PG_CONN" -t -c "SELECT indexname FROM pg_indexes WHERE schemaname = '${SCHEMA}' AND indexname = 'idx_scenario_state_full';" | tr -d ' ')
if [ "$scenario_idx" = "idx_scenario_state_full" ]; then
  echo "  Scenario index: exists [OK]"
else
  echo "  Scenario index: missing [FAIL]"
  ALL_MATCH=false
fi

echo ""
echo "=== Query Performance Verification ==="
echo ""

# Test first death query uses index (check for Index Scan in plan)
first_death_plan=$($PSQL "$PG_CONN" -t -c "
EXPLAIN SELECT p.name, COUNT(*) as first_deaths
FROM ${SCHEMA}.player_round_stats prs
JOIN ${SCHEMA}.players p ON prs.player_id = p.id
WHERE prs.first_death = TRUE
GROUP BY p.id, p.name
LIMIT 5;
" 2>/dev/null)

if echo "$first_death_plan" | grep -q "Index"; then
  echo "  First death query: uses Index Scan [OK]"
else
  echo "  First death query: no index usage [FAIL]"
  ALL_MATCH=false
fi

# Test scenario query uses index only scan
scenario_plan=$($PSQL "$PG_CONN" -t -c "
EXPLAIN SELECT round_id, map_name, attacker_won
FROM ${SCHEMA}.scenario_index
WHERE attacker_alive = 2 AND defender_alive = 3 AND spike_planted = TRUE
LIMIT 10;
" 2>/dev/null)

if echo "$scenario_plan" | grep -q "Index"; then
  echo "  Scenario query: uses Index Scan [OK]"
else
  echo "  Scenario query: no index usage [FAIL]"
  ALL_MATCH=false
fi

# Test first death query execution time (should be under 100ms)
first_death_time=$($PSQL "$PG_CONN" -t -c "
EXPLAIN ANALYZE SELECT p.name, COUNT(*) as first_deaths
FROM ${SCHEMA}.player_round_stats prs
JOIN ${SCHEMA}.players p ON prs.player_id = p.id
WHERE prs.first_death = TRUE
GROUP BY p.id, p.name
LIMIT 5;
" 2>/dev/null | grep "Execution Time" | sed 's/.*Execution Time: \([0-9.]*\) ms/\1/')

if [ -n "$first_death_time" ]; then
  # Compare as integers (bash doesn't do float comparison easily)
  time_int=$(echo "$first_death_time" | cut -d. -f1)
  if [ "$time_int" -lt 100 ]; then
    echo "  First death query time: ${first_death_time}ms [OK - under 100ms]"
  else
    echo "  First death query time: ${first_death_time}ms [WARN - over 100ms target]"
  fi
fi

echo ""
if [ "$ALL_MATCH" = true ]; then
  echo "=== VALIDATION PASSED ==="
else
  echo "=== VALIDATION FAILED ==="
  exit 1
fi
