# Lumina

VALORANT match analytics and an AI coach, built for the Cloud9 × JetBrains 2026 hackathon and
rebuilt by Kitchen Labs as a free showcase. Live: https://lumina-ten-amber.vercel.app

Lumina explains professional matches round by round: who wins the opening duels, how teams spend,
which rounds are worth rewatching, and what the numbers say about a player or a team. An AI coach
answers questions from the same numbers.

## What's inside

- **Browse:** tournaments, series, maps (every round with its kill feed), teams and players.
- **Match report:** one team's side of a series: per-map first kills, trades and planted rounds,
  opening duels, patterns and the rounds to rewatch, plus an on-demand AI review.
- **Player insights / Team review:** a player's or team's numbers across the sample, compared with
  what's typical in pro play (`lib/analytics/benchmarks.ts`).
- **Scenario lab:** save or retake, force or save, clutch odds, matched against real rounds.
- **Ask the coach:** a chat on every page (`/api/chat`), OpenAI `gpt-5.4-mini`, with a numbers-only
  fallback.

## Data

The hackathon's Supabase database was deleted. Lumina now reads one bundled file,
`lib/data/fixtures/matches.json` (2.3 MB): 32 VCT Americas playoff series (Stage 1 2024, Stage 1
2025, Stage 2 2025), 86 maps, 1,879 rounds, rebuilt from GRID's event logs by
`scripts/fixtures/build-fixtures.mjs`. All analytics are in-memory TypeScript
(`lib/data`, `lib/analytics`) with unit tests. See `/debug` ("About the data") in the app.

## Develop

```bash
npm install
npm run dev          # http://localhost:3561
npm run gate         # kit check, typecheck, lint (0 warnings), unit tests, build, leak check
npm run build && npm run e2e   # Playwright on the production build, phone + desktop
```

`.env.local` needs only `OPENAI_API_KEY` (server-side). Without it the AI features answer with
their written fallbacks.

## Docs

`CLAUDE.md` (operating manual), `docs/AI.md`, `docs/DESIGN.md`, `docs/CREDITS.md`,
`docs/PRIVACY.md`, `docs/SUPPORT.md`, `docs/marketing/`.

Lumina was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games.
Riot Games does not endorse or sponsor this project.

MIT licence (see `LICENSE`). © 2026 Kitchen Labs.
