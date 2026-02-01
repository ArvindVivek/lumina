# Lumina Design System
**VALORANT Assistant Coach — Tactical Analytics Interface**

---

## Intent

**Who:** Professional VALORANT coaches analyzing VCT Americas tournament data. They're at their desk, reviewing match footage, looking for tactical weaknesses. Time-pressured, data-focused, need answers fast.

**What:** Identify why rounds are lost. Compare player performance. Analyze team tactics. Query scenarios (force buy vs eco, save vs retake, clutch situations). Get data-backed recommendations in <2 seconds.

**Feel:** **Tactical Operations Center** — Cold, precise, serious. Think Bloomberg Terminal meets VALORANT spectator mode. Information density over decoration. Military tactical displays, not gaming entertainment. Every pixel serves analysis.

---

## Direction

**Precision & Density**

Maximum tactical insight per screen. Coaches don't want breathing room — they want data. Scannable hierarchy through typography and color, not whitespace. Tables over cards. Charts over illustrations. Compact over spacious.

---

## Foundation

**Cool Tactical Slate**

Colors pulled from VALORANT's tactical map overlays and competitive match UIs:

```
Background:     #0A0E14  (deeper slate — command center darkness)
Surface:        #151B23  (tactical display panel)
Surface-hover:  #1C232D  (active panel state)
Border:         #242B36  (subtle panel separation)
```

**Why:** Military operations center aesthetic. Dark enough to reduce eye strain during long analysis sessions. Slate tones (not pure black) provide subtle depth without decoration.

---

## Colors — Tactical Meaning

Each color has **specific tactical meaning** in VALORANT:

```css
/* Status Colors — Match Outcomes */
--tactical-win:     #22C55E  (Green — rounds won, strengths, positive trends)
--tactical-loss:    #EF4444  (Red — rounds lost, deaths, weaknesses)
--tactical-warning: #F59E0B  (Amber — economy issues, medium priority)
--tactical-info:    #06B6D4  (Cyan — neutral data, shields, abilities)

/* VALORANT Brand */
--valorant-red:     #FF4655  (Primary actions, spike planted, danger)
--valorant-accent:  #0FC9A8  (Secondary actions, ultimate ready)

/* Data Visualization */
--chart-attack:     #EF4444  (Attacking side performance)
--chart-defense:    #3B82F6  (Defending side performance)
--chart-neutral:    #64748B  (Neutral rounds, overtime)

/* Text Hierarchy */
--text-primary:     #F1F5F9  (Primary content — stats, names)
--text-secondary:   #94A3B8  (Secondary content — labels, metadata)
--text-tertiary:    #64748B  (Tertiary content — timestamps, footnotes)
--text-muted:       #475569  (Disabled states, placeholders)
```

**Usage rules:**
- Red = Always bad (deaths, losses, risks). Never decorative.
- Green = Always good (wins, strengths). Never decorative.
- Amber = Always warning (economy problems, medium confidence).
- Cyan = Neutral information (shields, abilities, data callouts).

---

## Typography

**System UI + Tabular Numbers**

```css
--font-primary: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif
--font-mono: ui-monospace, "SF Mono", "Consolas", monospace

/* Size Scale (tight for density) */
--text-xs:   0.6875rem  (11px — table metadata, timestamps)
--text-sm:   0.75rem    (12px — table cells, labels)
--text-base: 0.875rem   (14px — body content, default)
--text-lg:   1rem       (16px — section headings)
--text-xl:   1.25rem    (20px — page titles)
--text-2xl:  1.75rem    (28px — hero stats)

/* Weight Scale */
--font-normal:  400  (Body text)
--font-medium:  500  (Labels, emphasis)
--font-semibold: 600  (Headings, important stats)
--font-bold:     700  (Hero numbers, critical data)

/* Line Height (compact for tables) */
--leading-none:   1     (Hero stats)
--leading-tight:  1.25  (Table rows, metrics)
--leading-normal: 1.5   (Body text)

/* Letter Spacing */
--tracking-tight:  -0.01em  (Large numbers)
--tracking-normal:  0       (Default)
--tracking-wide:    0.025em (Uppercase labels)
```

**Rules:**
- **Always use tabular numbers** for stats (prevents alignment jitter)
- Uppercase labels with wide tracking for section headers (military tactical style)
- Mono font for precise numeric data (times, percentages, IDs)
- Tight line-height (1.25) for table density

---

## Spacing

**Tight 2px Base Unit**

```css
--space-0:  0px
--space-1:  2px   (Icon-text gaps, tight cell padding)
--space-2:  4px   (Cell padding, button padding-y)
--space-3:  6px   (Small gaps, compact spacing)
--space-4:  8px   (Default gaps, button padding-x)
--space-5:  10px  (Section gaps)
--space-6:  12px  (Card padding)
--space-8:  16px  (Panel padding)
--space-10: 20px  (Large section spacing)
--space-12: 24px  (Page margins)
```

**Rules:**
- Default gap between elements: 4px (space-2)
- Default padding inside containers: 8px (space-4)
- Never exceed 24px spacing unless for page-level margins
- Use space-1 (2px) for ultra-compact tables

---

## Radius

**Minimal — Sharp Tactical**

```css
--radius-none: 0px    (Tables, data grids)
--radius-sm:   2px    (Buttons, badges)
--radius-md:   4px    (Cards, panels)
--radius-lg:   6px    (Modals, dropdowns)
```

**Rules:**
- Tables have no border-radius (0px) — sharp edges for data
- Interactive elements (buttons) have minimal radius (2-4px)
- Never use rounded-full except for avatars

---

## Depth

**Minimal Borders — No Shadows**

```css
--border-subtle: 1px solid #242B36  (Default panel separation)
--border-focus:  1px solid #0FC9A8  (Focus states)
--border-error:  1px solid #EF4444  (Validation errors)
```

**Rules:**
- No box-shadows (except focus rings)
- No glow effects (not a gaming entertainment UI)
- No gradients (except data visualizations)
- Depth through borders and subtle background changes only

---

## Component Patterns

### 1. **Dense Stat Table**

For player comparisons, team rankings, match histories.

```
┌─────────────────────────────────────────────────┐
│ PLAYER PERFORMANCE          ↓ ACS  K/D   HS%   │
├─────────────────────────────────────────────────┤
│ TenZ          Jett          287   1.34  28.4%  │
│ zekken        Raze          276   1.28  24.1%  │
│ Sacy          Sova          198   0.98  19.7%  │
└─────────────────────────────────────────────────┘
```

**Specs:**
- Height: 32px per row (tight)
- Padding: 8px horizontal, 4px vertical
- Font: 12px tabular numbers
- Border: 1px subtle between rows
- Hover: Surface-hover background
- Sort: Arrows in header, active column highlighted

### 2. **Round Timeline**

Horizontal visualization of round outcomes with drill-down.

```
┌──────────────────────────────────────────────────────┐
│ MATCH TIMELINE — Sentinels vs 100T                   │
├──────────────────────────────────────────────────────┤
│ HALF 1  ■■■□■■□■■■■□□  (9-3)                        │
│ HALF 2  □□■■□□□□□□□□□  (2-11)                       │
│                                                      │
│ Round 14: ☠ First Death @ 0:42  [+]                 │
└──────────────────────────────────────────────────────┘
```

**Specs:**
- Box per round: 16px × 16px
- Green fill = won, Red fill = lost, Gray outline = not played
- Gap between boxes: 2px
- Clickable to drill into round details
- Shows half separation clearly

### 3. **Compact Metric**

Single stat with context, not bloated card.

```
┌────────────────────┐
│ PISTOL WIN RATE    │
│ 58.3%       +12.3% │
│ 14/24 rounds       │
└────────────────────┘
```

**Specs:**
- Height: 64px (compact)
- Padding: 12px
- Label: 11px uppercase tracking-wide
- Value: 20px bold tabular
- Context: 12px muted text
- No icons (wastes space)

### 4. **Tactical Filters Sidebar**

Compact filter panel for date, team, map, player selection.

```
┌─────────────────┐
│ FILTERS         │
├─────────────────┤
│ □ Tournament    │
│   ☑ VCT Stage 1 │
│   ☐ VCT Stage 2 │
│                 │
│ □ Map           │
│   ☑ Ascent      │
│   ☐ Bind        │
│                 │
│ [Apply]         │
└─────────────────┘
```

**Specs:**
- Width: 200px fixed
- Padding: 12px
- Checkbox size: 14px
- Gap between options: 4px
- Collapse sections with arrow icon

### 5. **Button**

Tactical action buttons, minimal style.

```
Primary:   [ANALYZE]  (Valorant accent, 8px×4px padding)
Secondary: [Cancel]   (Border only, 8px×4px padding)
Danger:    [Delete]   (Red border, 8px×4px padding)
```

**Specs:**
- Height: 28px (compact)
- Padding: 8px horizontal, 4px vertical
- Font: 12px medium uppercase
- Radius: 2px
- No shadows, no animations (except hover opacity 0.8)

### 6. **Badge**

Status indicators for live matches, confidence levels, priorities.

```
[LIVE]  [HIGH]  [MEDIUM]  [LOW]
```

**Specs:**
- Height: 18px
- Padding: 4px horizontal
- Font: 10px bold uppercase
- Radius: 2px
- Colors: Semantic (red=loss/low, amber=medium, green=win/high)

---

## Animation

**Minimal — Only for Feedback**

```css
/* Hover States */
--transition-fast: 100ms ease-out  (Hover opacity, background change)

/* Focus States */
--transition-normal: 200ms ease-out  (Focus rings)

/* Layout Shifts */
--transition-slow: 300ms ease-out  (Sidebar collapse, panel expand)
```

**Rules:**
- No entrance animations (wastes time)
- No decorative animations (this is work, not entertainment)
- Only animate user feedback: hover, focus, loading states
- No spring physics, no bounce, no elastic easing

---

## Layout Patterns

### Dashboard Layout

```
┌────┬──────────────────────────────────────────┐
│    │  PAGE TITLE                              │
│ S  ├──────────────────────────────────────────┤
│ I  │  [Metric] [Metric] [Metric] [Metric]    │
│ D  ├──────────────────────────────────────────┤
│ E  │  ┌────────────────┐  ┌──────────────┐   │
│ B  │  │ Recent Matches │  │ Top Players  │   │
│ A  │  │                │  │              │   │
│ R  │  └────────────────┘  └──────────────┘   │
└────┴──────────────────────────────────────────┘
```

**Specs:**
- Sidebar: 200px (collapsed: 60px)
- Content padding: 24px
- Two-column grid for data panels (not card grids)
- Metrics in single row at top (4 metrics max)

### Analysis Page Layout

```
┌────┬──────────────────┬───────────────────────┐
│    │  FILTERS         │  DATA TABLE           │
│ S  │  □ Tournament    │  ┌──────────────────┐ │
│ I  │  □ Team          │  │ Player  ACS  K/D │ │
│ D  │  □ Map           │  ├──────────────────┤ │
│ E  │  [Apply]         │  │ ...  data rows   │ │
│ B  │                  │  └──────────────────┘ │
│ A  │  INSIGHTS        │                       │
│ R  │  ■ High priority │  VISUALIZATION        │
│    │  ■ Medium        │  [Round Timeline]     │
└────┴──────────────────┴───────────────────────┘
```

**Specs:**
- Sidebar: 200px (filters + insights)
- Main content: Flex-grow
- Table: Full width, scrollable
- Visualization: Below table, full width

---

## Signature Element

**Round Timeline Drill-Down**

The unique component that makes this interface distinctly VALORANT coaching:

A horizontal timeline showing all rounds in a match as colored boxes. Click any round to expand and see:
- Round outcome (win/loss)
- First death event with timestamp
- Economy state (full buy, eco, force)
- Site execution (A/B/mid)
- Kill sequence with player names

This transforms abstract stats into tactical narrative.

---

## Anti-Patterns

**Never do these:**

❌ Card grids with lots of padding (wastes space)
❌ Decorative illustrations or icons (not a marketing site)
❌ Glow effects or shadows (not gaming entertainment)
❌ Large hero images (coaches want data, not pictures)
❌ Entrance animations (delays time-to-insight)
❌ Rounded corners everywhere (looks playful, not tactical)
❌ Pastel colors (need high contrast for clarity)
❌ Generic "users" language (speak to coaches specifically)

**Always do these:**

✅ Dense stat tables (maximize info per screen)
✅ Tabular numbers (alignment matters)
✅ Semantic color (red=bad, green=good, always)
✅ Compact spacing (2/4/6/8px base)
✅ Sharp hierarchy (size + weight + color)
✅ Tactical language (sites, rounds, executions, not "matches" or "games")
✅ Fast load times (coaches are impatient)
✅ Keyboard shortcuts (power users)

---

## Implementation Notes

**Tech Stack:**
- Next.js 15 + React 19
- Tailwind CSS 4 (configured with custom tactical theme)
- Framer Motion (minimal, only for feedback)
- Radix UI (unstyled primitives, full control)
- Recharts (for data visualization)

**File Structure:**
```
components/
├── tables/
│   ├── stat-table.tsx       (Dense data table)
│   ├── sortable-header.tsx  (Table column header with sort)
│   └── table-cell.tsx       (Tactical table cell)
├── timeline/
│   ├── round-timeline.tsx   (Signature component)
│   └── round-detail.tsx     (Drill-down panel)
├── metrics/
│   ├── compact-metric.tsx   (Single stat display)
│   └── metric-row.tsx       (Row of 4 metrics)
├── filters/
│   ├── filter-sidebar.tsx   (Collapsible filters)
│   └── filter-section.tsx   (Single filter group)
└── ui/
    ├── button.tsx           (Tactical button)
    ├── badge.tsx            (Status badge)
    └── input.tsx            (Form input)
```

---

**Last updated:** 2026-01-30
**Version:** 1.0 — Tactical Overhaul
