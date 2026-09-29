# Credits and third-party material

## Riot Games (VALORANT)

Lumina is a free, non-commercial fan project made under Riot Games' ["Legal Jibber Jabber"
policy](https://www.riotgames.com/en/legal) for fan content. The policy lets fans make free
projects that use Riot's games and game assets, as long as the project is free to use, isn't
presented as official, and carries Riot's notice. Every page's footer shows the required text:

> Lumina was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot
> Games. Riot Games does not endorse or sponsor this project.

What Lumina uses from VALORANT, and why that's allowed:

| Used | How | Why it's allowed |
|---|---|---|
| The names VALORANT, agent names, map names, ability names | Plain text in tables, filters and AI answers | Covered by the fan-content policy; names only, no official artwork |
| Riot logos, agent portraits, map art | **Not used.** The hackathon build shipped agent PNGs and map images in `public/valorant/`; they were removed in the web release | Avoids any look of an official product |

## Teams and players

| Used | How | Why |
|---|---|---|
| Team names, player handles | Text, from the match feed | Public competitive results |
| Team logos | **Not used.** The hackathon build shipped team logo PNGs/SVGs (`public/valorant/teams/`), which belong to the teams, not Riot, and aren't covered by the fan policy. Replaced with text badges (C9, SEN, 100T) in `components/lumina/team-badge.tsx` | Logos are the teams' trademarks |
| Player photos | Never used | |

## Match data

Round-by-round data for 32 VCT Americas playoff series (2024-2025), from GRID's esports data feed,
downloaded during the Cloud9 × JetBrains 2026 hackathon, which provided the data access. Lumina
bundles a 2 MB summary (`lib/data/fixtures/matches.json`), built by
`scripts/fixtures/build-fixtures.mjs`; the raw logs are not published.

## Fonts and icons

| Asset | Licence |
|---|---|
| Fredoka, Nunito (Google Fonts, via `next/font`) | SIL Open Font License 1.1 |
| Lucide icons (`lucide-react`) | ISC |
| App icon (`assets/icon-source.svg`, `app/icon.svg`) | Drawn for Lumina by Kitchen Labs |

## AI

The AI coach uses OpenAI's API (see `docs/AI.md`).
