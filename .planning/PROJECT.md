# Lumina Assistant Coach

## What This Is

A data-driven coaching tool for professional VALORANT that transforms GRID.gg official VCT Americas tournament data into actionable insights. Built for the Cloud9 x JetBrains Hackathon (Category 1: Comprehensive Assistant Coach). Migration of existing Python/SQLite implementation to Vercel + Supabase stack.

## Core Value

Coaches can identify exactly why rounds are lost and get data-backed recommendations to fix tactical issues — all in under 2 seconds per query.

## Requirements

### Validated

(Prior research/prototype informed these patterns)

- ✓ GRID.gg API integration (Central Data, Series State, File Download) — patterns established
- ✓ ETL pipeline for VCT Americas tournaments (2024-2025) — data ingested
- ✓ Database schema with 13 tables, 65 optimized indexes — migrated to PostgreSQL
- ✓ Player insights: first death impact, trading efficiency, opening duels, clutch performance, agent performance — query patterns validated
- ✓ Macro review: pistol analysis, economy management, execution timing, critical moments — patterns ready
- ✓ Hypothetical analyzer: save vs retake, force vs eco scenario analysis — patterns ready

### Active

- [ ] Migrate database from SQLite to Supabase PostgreSQL
- [ ] Migrate backend logic from Python FastAPI to Supabase Edge Functions (Deno/TypeScript)
- [ ] Integrate Next.js frontend with Supabase client
- [ ] Implement VALORANT-themed UI (dark theme, red accents)
- [ ] Add LLM-powered natural language output for insights
- [ ] Implement round-by-round breakdown view
- [ ] Add anti-strat detection (timing patterns, positional reads)
- [ ] Deploy to Vercel + Supabase
- [ ] Create demo video (3-5 minutes)

### Out of Scope

- Real-time live match analysis — requires streaming infrastructure, defer post-hackathon
- VOD timestamp alignment — complex integration, defer post-hackathon
- Multi-region expansion — VCT Americas only for hackathon
- ML models — ~15k rounds insufficient, statistical methods preferred
- Mobile app — web-first for hackathon

## Context

**Infrastructure:**
- Supabase instance: `c9-jetbrains-hackathon` (shared with synapse, mosaic, thrifty projects)
- Lumina schema: `lumina.*` tables isolated from other projects
- 170K+ rows of VCT Americas data migrated
- 65 PostgreSQL indexes optimized for analytics queries

**Data Source:**
GRID.gg APIs provide official VCT Americas tournament data:
- Central Data API: Tournament/team/player metadata
- Series State API: Post-match final states
- File Download API: Complete event timelines (JSONL)

**Tournaments:** VCT Americas Kickoff 2024, Stage 1 2024, Stage 2 2024, Kickoff 2025, Stage 1 2025, Stage 2 2025

**Analytics Methodology:**
Statistical and probabilistic methods (not ML):
- Conditional probability queries
- Similarity matching for scenario analysis
- Expected value calculations
- Confidence scoring based on sample size

## Constraints

- **Tech Stack**: Next.js + Supabase PostgreSQL + Vercel — hackathon requirement for modern stack
- **No Edge Functions**: All backend logic in Vercel API routes (not Supabase Edge Functions)
- **Data Source**: GRID.gg APIs only — official VCT Americas data
- **Performance**: API response time <2s — coaching insights must be fast
- **Timeline**: Hackathon deadline — all 8 phases must be complete
- **Sample Size**: ~15k rounds — statistical methods preferred over ML

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Vercel API routes over Supabase Edge Functions | Single deployment target (Vercel), simpler architecture, all code in one repo | ✓ Decided |
| PostgreSQL over SQLite | Supabase provides managed PostgreSQL, scales better, has Row Level Security | ✓ Done |
| Statistical methods over ML | Sample size (~15k rounds) insufficient for deep learning, statistical methods are explainable | ✓ Good |
| TypeScript for backend | Consistent language across frontend/backend, works in Vercel API routes | ✓ Decided |

## Architecture

**Backend:**
- Vercel API routes in `app/api/` directory
- Direct PostgreSQL connections via `@supabase/supabase-js` client
- All analytics logic runs server-side in Vercel functions

**Multi-Schema Setup:**
This project shares a Supabase instance with other hackathon projects:
- `lumina` schema: VALORANT Assistant Coach (this project)
- `synapse` schema: (sibling hackathon project)
- `mosaic` schema: (sibling hackathon project)
- `thrifty` schema: (sibling hackathon project)

---
*Last updated: 2026-01-29 after multi-schema refactor*
