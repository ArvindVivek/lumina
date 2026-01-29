# VALORANT ETL Scripts

Fetches VALORANT data from GRID.gg API into Supabase.

## Setup

```bash
cd scripts/etl
pnpm install
```

## Environment Variables

Create `.env` in this directory or use project root `.env.local`:

```bash
GRID_API_KEY=your_grid_api_key
SUPABASE_URL=http://127.0.0.1:54321  # or production URL
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Usage

```bash
# Fetch ALL VALORANT tournaments
pnpm etl

# Fetch specific tournament
pnpm etl -- --tournament="Kickoff 2025"

# Dry run (no database writes)
pnpm etl:dry-run
```

## Available Tournaments

| Tournament | ID |
|------------|-----|
| VCT Americas - Kickoff 2024 | 757371 |
| VCT Americas - Stage 1 2024 | 757481 |
| VCT Americas - Stage 2 2024 | 774782 |
| VCT Americas - Kickoff 2025 | 775516 |
| VCT Americas - Stage 1 2025 | 800675 |
| VCT Americas - Stage 2 2025 | 826660 |
| VALORANT Masters - Masters Madrid | 757614 |

## Database Schema

Data stored in `public` schema (shared with mosaic):

| Table | Description |
|-------|-------------|
| `grid_tournaments` | Tournament metadata |
| `grid_teams` | Team data |
| `grid_players` | Player data |
| `grid_series` | Match/series data |
| `grid_games` | Individual games/maps |

Lumina-specific computed data stays in `lumina` schema.
