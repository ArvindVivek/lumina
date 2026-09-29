# Lumina: operating manual

VALORANT pro-match analytics + AI coach. Next.js 16.3 (App Router), React 19, Tailwind 4, KL Web
1.0.2 (vendored in `components/kl`, `lib/kl`, `styles/kl-tokens.css`). Public showcase at
https://lumina-ten-amber.vercel.app (Vercel project `lumina`, repo ArvindVivek/lumina, deploys from
`main`). Web release standard: `kitchenlabs-kit/docs/standards/web-release-standard.md`.

## Status (2026-09-29)

- Released on bundled fixtures; every page and all API routes work without a database.
- AI: org key set on Vercel but **out of credits**; production serves written fallbacks. Live AI
  check pending (see `docs/AI.md`).

## Commands

- `npm run gate`: kit check, typecheck, `eslint --max-warnings=0`, vitest, build, leak check.
- `npm run build && npm run e2e`: Playwright on `next start` (port 3561), phone + desktop, server
  `TZ=UTC`, browser `America/Los_Angeles`, `OPENAI_API_KEY` blank (fallbacks only).
- `npm run fixtures`: rebuild `lib/data/fixtures/matches.json` from `scripts/etl/data/events`
  (27 GB of raw GRID logs, gitignored, local only). Streams each file; ~1 minute. Run through
  `kitchenlabs-kit/scripts/kl-slot.sh`.
- `npm run screenshots`: marketing capture (`docs/marketing/capture.json`, against production).
- Heavy commands go through `kl-slot.sh`.

## Map

- `lib/data/fixture.ts` reads the fixture with fs (not `import`: tsc would type a 2 MB literal);
  `next.config.ts` traces it into every function. `lib/data/db.ts` builds the indexes;
  `lib/data/queries.ts` has the browse queries.
- `lib/analytics/*-queries.ts` replace the old Postgres RPCs, same row shapes; `*-insights.ts` add
  the plain-English readings (shared by API routes and pages); `benchmarks.ts` holds the
  pro-typical ranges they compare against.
- `lib/llm/`: `coach.ts` (the one AI call shape), `facts.ts` (compact facts + written fallbacks),
  `chat-facts.ts`, `limits.ts` (20/visitor/hour, 300/instance/day), `entity-resolver.ts`.
- Browse pages are server components, statically generated from the fixture. Interactive bits:
  `components/game/*`, `components/scenario-lab.tsx`, `components/layout/chat-panel.tsx`.

## Gotchas (with causes)

- **Fixture semantics differ from the old ETL on purpose.** The old `event-processor.ts` stored 5v5
  alive counts for every round (GRID's round-end state has no `alive` flag), read loadouts at round
  end, compared a per-player average to team thresholds (almost every round "eco"), stored 0 ms for
  every kill (events have no `gameTime`), and marked trades by checking whether the killer had
  died earlier. `build-fixtures.mjs` documents each fix. Revives aren't in `kill_events`, so replayed
  alive counts can be one low after a Sage resurrection.
- **Sides come from `rounds.team_a_side`**, never from "round ≤ 12". The old code's guess was wrong in
  overtime and whenever team A defended first.
- **GRID has no damage and no spike site.** Don't show ADR or A/B sites; the ACS-style numbers are
  not computed.
- **Team logos are banned** (they belong to the teams). Use `TeamBadge` codes. No agent or map art.
- **Dates render in UTC** (`components/lumina/format.ts`) so server and browser agree (React #418).
- **Insight thresholds** were made up for fake hackathon data ("70% traded is excellent"), which
  called every real pro below average. They now use sample quartiles in `benchmarks.ts`; rebuild
  them if the fixture changes.
- **Don't poll the live site** to wait for a deploy (Vercel bot mitigation): `vercel inspect --wait`.
- Commit author for Vercel: `Arvind Vivekanandan <18371231+ArvindVivek@users.noreply.github.com>`.

## Vercel env

`OPENAI_API_KEY` (server-only, production + preview). Dead, safe for the owner to delete:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`DATABASE_URL`, `GRID_API_KEY`.
