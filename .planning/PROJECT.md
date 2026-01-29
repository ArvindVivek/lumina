# Lumina Assistant Coach

## What This Is

A data-driven coaching tool for professional VALORANT that transforms GRID.gg official VCT Americas tournament data into actionable insights. Built for the Cloud9 x JetBrains Hackathon (Category 1: Comprehensive Assistant Coach). Migration of existing Python/SQLite implementation to Vercel + Supabase stack.

## Core Value

Coaches can identify exactly why rounds are lost and get data-backed recommendations to fix tactical issues — all in under 2 seconds per query.

## Requirements

### Validated

(Reference implementation exists in `/Users/arvind/Documents/ValVision/valvision-ml/grid-gg`)

- ✓ GRID.gg API integration (Central Data, Series State, File Download) — existing
- ✓ ETL pipeline for VCT Americas tournaments (2024-2025) — existing
- ✓ Database schema with 11 tables, 27 custom indexes — existing (SQLite)
- ✓ Player insights: first death impact, trading efficiency, opening duels, clutch performance, agent performance — existing
- ✓ Macro review: pistol analysis, economy management, execution timing, critical moments — existing
- ✓ Hypothetical analyzer: save vs retake, force vs eco scenario analysis — existing
- ✓ FastAPI backend with REST endpoints — existing
- ✓ Basic frontend structure — existing

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

**Existing Implementation:**
Reference codebase at `/Users/arvind/Documents/ValVision/valvision-ml/grid-gg` contains:
- Python FastAPI backend with analytics modules (insights.py, macro.py, hypotheticals.py)
- SQLite database with VCT Americas data (~3,620 rounds, ~36,200 player stats)
- Basic Next.js frontend
- ETL pipeline for GRID.gg data ingestion

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

- **Tech Stack**: Next.js + Supabase (Edge Functions + PostgreSQL) + Vercel — hackathon requirement for modern stack
- **Data Source**: GRID.gg APIs only — official VCT Americas data
- **Performance**: API response time <2s — coaching insights must be fast
- **Timeline**: Hackathon deadline — all 8 phases must be complete
- **Sample Size**: ~15k rounds — statistical methods preferred over ML

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Edge Functions over Next.js API Routes | Edge functions run closer to database, better for analytics queries | — Pending |
| PostgreSQL over SQLite | Supabase provides managed PostgreSQL, scales better, has Row Level Security | — Pending |
| Statistical methods over ML | Sample size (~15k rounds) insufficient for deep learning, statistical methods are explainable | ✓ Good |
| TypeScript for backend | Consistent language across frontend/backend, Supabase Edge Functions use Deno | — Pending |

---
*Last updated: 2026-01-28 after initialization*
