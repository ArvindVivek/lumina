# Lumina design

KL Web (`components/kl`, `styles/kl-tokens.css`) with Lumina's rose accent. Light and dark, following
the system setting, with a toggle.

## Palette (for `kitchenlabs-kit/brand/lumina/palette.json`)

```json
{
  "app": "lumina",
  "displayName": "Lumina",
  "appearance": "adaptive",
  "accent": "#E11D48",
  "accentStrong": "#BE123C",
  "accentDeep": "#881337",
  "accentSoft": "#FBDFE5",
  "accentSoftDark": "#421B2F",
  "onAccent": "#FFFFFF",
  "accentText": "#C61A3F",
  "accentTextDark": "#EB6280",
  "secondary": null,
  "gradient": ["#F43F5E", "#881337"],
  "night": null
}
```

Derived with the script in `kitchenlabs-kit/docs/brand/palettes.md`. Measured: accentText 5.27:1 on
`#F2F4F9`, 4.64:1 on accentSoft; accentTextDark 5.45:1 on `#151A28`, 4.61:1 on accentSoftDark; white
on accentStrong 6.29:1. Closest suite accent (CIEDE2000): Chiquitos `#B8332A` at 11.0.

## Colour roles

| Colour | Means |
|---|---|
| Accent (rose) | The team or thing you're focused on: the active nav item, "your" side in a match, the primary button |
| Success green | A win (winning team badge, won map, won round count) |
| Danger red | A loss or a must-watch round |
| Warning amber | Something to watch: AI fallback notice, small samples |
| Attack orange / defense blue (`--attack*`, `--defense*` in `app/globals.css`) | Which side a team played in a round |
| Ink on surface-2 | Neutral team badges (no team colours: those belong to the teams) |

All text pairs are measured in `lib/tokens.test.ts`.

## Motion

| Moment | Motion |
|---|---|
| Buttons | KL press: 2px into the edge, 75 ms |
| Cards and rows on hover | Background to surface-2, 75 ms |
| Round row open | Chevron rotates, 150 ms |
| Jump to a round from the strip | Smooth scroll |

Reduced motion is honoured by the kit (CSS rule and `MotionConfig`).

## Layout

- Wide screens: fixed 256px sidebar, content up to 1152px.
- Phones: top bar with menu; tables scroll inside their card; the page never scrolls sideways (e2e
  checks every route).
- "Ask the coach" floats bottom-right; the footer has bottom padding so it never hides a link.
