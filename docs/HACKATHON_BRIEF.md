# Lumina Assistant Coach

## Business Requirements Document

---

## Executive Summary

**Project:** Lumina Assistant Coach
**Competition:** Cloud9 x JetBrains Hackathon - Category 1: Comprehensive Assistant Coach
**Data Source:** GRID.gg APIs (VCT Americas tournaments, 2024-2025)
**Target Users:** Professional VALORANT coaches, analysts, and competitive players

**Value Proposition:** Automated, data-driven coaching insights that transform GRID's official tournament data into actionable recommendations using statistical analysis.

---

## Core Features

### 1. Personalized Player Insights

Identify recurring patterns that impact team performance.

**Output Example:**

```
DATA: Player "Oxy" dies first without KAST in 23 rounds → team loses 78%
INSIGHT: Opening duel deaths without value heavily impact round outcomes
RECOMMENDATION: Ensure teammate positioned for immediate trade
CONFIDENCE: High (n=23)
```

### 2. Automated Macro Review

Generate structured review agendas highlighting critical decision points.

**Sections Covered:**

- Pistol round outcomes and economy impact
- Force buy vs save decision analysis
- Site execution timing patterns
- Ultimate orb economy differential
- Critical moments (clutches, retakes)

### 3. Hypothetical Outcome Prediction

"What if" scenario analysis using historical data matching.

**Example:** "Should we have saved instead of attempting 3v5 retake?"

- Queries historical scenarios with similar game states
- Calculates expected value for each decision option
- Provides data-backed recommendation

---

## Target Users & Use Cases

**Primary Users:**

- Professional VALORANT coaches analyzing VCT matches
- Team analysts preparing review sessions
- Data-driven players seeking competitive improvement

**Key Use Cases:**

1. Post-match analysis identifying why key rounds were lost
2. Player development through pattern identification
3. Strategic decision evaluation (aggressive vs conservative plays)
4. Opponent preparation and scouting

---

## Analytics Methodology

**Approach:** Statistical and probabilistic methods (not ML)

**Rationale:**

- ~15k rounds is insufficient for deep learning
- Statistical methods are explainable and trustworthy
- Results are backed by real tournament outcomes
- Fast computation (<2s per query)

**Methods Used:**

- Conditional probability queries
- Similarity matching for scenario analysis
- Expected value calculations
- Confidence scoring based on sample size

---

## Data Source

**GRID.gg APIs:**

| API           | Purpose                          |
| ------------- | -------------------------------- |
| Central Data  | Tournament/team/player metadata  |
| Series State  | Post-match final states          |
| File Download | Complete event timelines (JSONL) |

**VCT Americas Tournaments (2024-2025):**

- Kickoff 2024, Stage 1 2024, Stage 2 2024
- Kickoff 2025, Stage 1 2025, Stage 2 2025

---

## Success Criteria

### Hackathon Judging Alignment

| Criterion        | How We Address It               |
| ---------------- | ------------------------------- |
| Functionality    | All 3 core features implemented |
| Data Utilization | Use all 3 GRID APIs             |
| Innovation       | Hypothetical prediction engine  |
| User Experience  | Professional UI, clear insights |
| Code Quality     | Clean architecture, documented  |

### Technical Requirements

- API response time: <2s for insights
- Confidence scoring on all outputs
- Minimum sample sizes for validity
- Professional VALORANT-themed UI

---

## Tech Stack Overview

| Component  | Technology                       |
| ---------- | -------------------------------- |
| Backend    | Python FastAPI                   |
| Database   | SQLite (dev) / PostgreSQL (prod) |
| Frontend   | Next.js 14 + TailwindCSS         |
| Deployment | Vercel + Railway                 |

---

## Deliverables

1. **GitHub Repository** - Source code with documentation
2. **Live Demo** - Public URL with VCT Americas data
3. **Video Demonstration** - 3-5 minute feature walkthrough

---

## Future Roadmap (Post-Hackathon)

- Real-time live match analysis
- VOD timestamp alignment
- Multi-region expansion
- ML models (when data volume justifies)
- Mobile companion app

---

_For detailed implementation instructions, see [implementation_guide.md](implementation_guide.md)_
