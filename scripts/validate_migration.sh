#!/bin/bash
# Migration validation script

SQLITE_DB="/Users/arvind/Documents/ValVision/valvision-ml/grid-gg/data/valvision.db"
PG_CONN="postgresql://postgres:postgres@localhost:54322/postgres"
PSQL="/opt/homebrew/opt/libpq/bin/psql"

echo "=== Row Count Comparison ==="
echo ""

TABLES="tournaments teams players series games rounds player_round_stats kill_events spike_events orb_events ability_events kill_assists scenario_index"

ALL_MATCH=true

for table in $TABLES; do
  sqlite_count=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM $table;" 2>/dev/null)
  pg_count=$($PSQL "$PG_CONN" -t -c "SELECT COUNT(*) FROM $table;" 2>/dev/null | tr -d ' ')

  if [ "$sqlite_count" = "$pg_count" ]; then
    echo "  $table: $pg_count rows [OK]"
  else
    echo "  $table: MISMATCH - SQLite=$sqlite_count, PostgreSQL=$pg_count [FAIL]"
    ALL_MATCH=false
  fi
done

echo ""
echo "=== Sample Analytics Query (First Death Count by Player) ==="
echo ""

$PSQL "$PG_CONN" -c "
SELECT p.name, COUNT(*) as first_deaths
FROM player_round_stats prs
JOIN players p ON prs.player_id = p.id
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
WHERE table_name = 'player_round_stats' AND column_name = 'first_death';
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
WHERE table_name = 'tournaments' AND column_name = 'start_date';
" | tr -d ' ')

if [ "$ts_type" = "timestampwithtimezone" ]; then
  echo "  start_date column: timestamptz [OK]"
else
  echo "  start_date column: $ts_type [FAIL - expected timestamptz]"
  ALL_MATCH=false
fi

echo ""
if [ "$ALL_MATCH" = true ]; then
  echo "=== VALIDATION PASSED ==="
else
  echo "=== VALIDATION FAILED ==="
  exit 1
fi
