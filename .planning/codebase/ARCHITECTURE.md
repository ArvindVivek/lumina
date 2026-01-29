# Architecture

**Analysis Date:** 2026-01-28

## Pattern Overview

**Overall:** Next.js App Router (Vercel's modern server-first architecture)

**Key Characteristics:**
- Server Components by default with Client Component opt-in via `'use client'`
- File-system based routing in `app/` directory
- React 19 with JSX for component composition
- TypeScript strict mode enabled
- Single Layout Root with nested page components
- CSS-in-JS via Tailwind CSS v4 with PostCSS integration

## Layers

**Presentation/View Layer:**
- Purpose: Render UI components and manage visual presentation
- Location: `app/` directory
- Contains: React Server Components (`.tsx` files), layout definitions, page templates
- Depends on: React, Next.js runtime, Tailwind CSS classes
- Used by: Browser client directly

**Layout System:**
- Purpose: Define root HTML structure, metadata, font loading, global styling
- Location: `app/layout.tsx`
- Contains: RootLayout component, font initialization (Geist Sans/Mono), metadata export, global CSS imports
- Depends on: Next.js Metadata API, next/font/google
- Used by: All pages within the application

**Page Components:**
- Purpose: Define route-specific content and UI
- Location: `app/page.tsx` (home page), additional routes as `[route]/page.tsx`
- Contains: Default exported components, inline Tailwind classes, Next/Image optimizations
- Depends on: React, Next.js components (Image, Link)
- Used by: App Router for URL mapping

**Styling Layer:**
- Purpose: Style application with utility-first CSS
- Location: `app/globals.css`
- Contains: Tailwind directives, CSS custom properties (--background, --foreground), dark mode media queries
- Depends on: Tailwind CSS v4, PostCSS processor
- Used by: All React components

## Data Flow

**Page Render Flow:**

1. User requests `/` route
2. Next.js App Router matches `app/page.tsx`
3. RootLayout (`app/layout.tsx`) wraps page component
4. Layout loads fonts (Geist) and applies metadata
5. Layout imports `globals.css` with Tailwind styles and CSS variables
6. Page component renders with inline Tailwind classes
7. Server renders to HTML, sends to client
8. Client hydrates with React 19

**Styling Application:**

1. PostCSS processes `app/globals.css` with `@import "tailwindcss"` directive
2. Tailwind generates utility classes based on codebase scan
3. CSS variables (--background, --foreground) set in :root
4. Dark mode triggered via `@media (prefers-color-scheme: dark)`
5. Component classes reference CSS variables and Tailwind utilities
6. Final CSS bundled and sent to client

**State Management:**

- Currently not implemented (no state management library detected)
- All components are Server Components by default (stateless)
- Client interactivity requires explicit `'use client'` boundary declaration
- Component state would use React hooks (useState, useReducer) if Client Components added

## Key Abstractions

**RootLayout:**
- Purpose: Single wrapper for entire application
- Examples: `app/layout.tsx`
- Pattern: Server Component exporting named `metadata` and default component

**Pages:**
- Purpose: Route endpoint components
- Examples: `app/page.tsx`
- Pattern: Default export Server Components; file-system routing (page.tsx = route)

**Styling Model:**
- Purpose: Utility-first CSS via Tailwind
- Examples: className strings like `"flex min-h-screen items-center justify-center"`
- Pattern: Inline utility classes, no CSS modules or styled-components

## Entry Points

**Application Root:**
- Location: `app/layout.tsx`
- Triggers: Every page request (wraps all routes)
- Responsibilities: Load fonts, set metadata, import global styles, render HTML shell

**Home Page:**
- Location: `app/page.tsx`
- Triggers: GET request to `/`
- Responsibilities: Render landing page with example content, links, and Next.js imagery

**Static Assets:**
- Location: `public/` directory
- Triggers: Direct URL requests (e.g., `/next.svg`)
- Responsibilities: Serve static images and favicon

## Error Handling

**Strategy:** Not explicitly implemented; relies on Next.js defaults

**Patterns:**
- Global error handling delegated to Next.js framework
- No custom error boundaries detected
- No error pages (error.tsx) created
- Development mode shows Next.js error overlay

## Cross-Cutting Concerns

**Logging:** Not implemented (no logging library detected)

**Validation:** Not applicable (no form inputs or API routes in current codebase)

**Authentication:** Not implemented

**Environment Configuration:** Not detected (no .env files, no config module)

---

*Architecture analysis: 2026-01-28*
