# Technology Stack

**Analysis Date:** 2026-01-28

## Languages

**Primary:**
- TypeScript 5.x - Used throughout the application for type-safe development
- JavaScript (ES2017+) - Target compilation and build output

**Secondary:**
- CSS 3 - Styling with Tailwind CSS
- JSX/TSX - React component markup

## Runtime

**Environment:**
- Node.js 23.x (tested with v23.6.1)

**Package Manager:**
- npm 11.7.0
- Lockfile: `package-lock.json` (present)

## Frameworks

**Core:**
- Next.js 16.1.6 - React framework for production-grade applications with Server Components and App Router
- React 19.2.3 - JavaScript library for building user interfaces
- React DOM 19.2.3 - React rendering engine for web applications

**Styling:**
- Tailwind CSS 4.x - Utility-first CSS framework via PostCSS
- @tailwindcss/postcss 4.x - PostCSS plugin for Tailwind CSS integration

**Build/Dev:**
- TypeScript 5.x - Language and type checking
- ESLint 9.x - JavaScript linting and code quality
- eslint-config-next 16.1.6 - Next.js-specific ESLint configuration
- PostCSS - CSS transformation and compilation

## Key Dependencies

**Critical:**
- next 16.1.6 - Full-stack React framework with built-in routing, optimization, and Server Components
- react 19.2.3 - UI library foundation
- react-dom 19.2.3 - DOM rendering for React
- tailwindcss 4.x - CSS utility framework for styling
- @tailwindcss/postcss 4.x - PostCSS integration for Tailwind

**Type Definitions:**
- @types/node 20.x - Node.js type definitions
- @types/react 19.x - React type definitions
- @types/react-dom 19.x - React DOM type definitions

**Fonts:**
- next/font/google - Google Fonts optimization (Geist, Geist Mono included)

## Configuration

**Environment:**
- No `.env` or `.env.local` files configured
- No external API keys or secrets currently required
- Application runs with default configuration

**Build:**
- `tsconfig.json` - TypeScript compilation configuration with strict mode enabled
  - Target: ES2017
  - Module: esnext
  - JSX: react-jsx
  - Path aliases: `@/*` maps to project root
- `next.config.ts` - Next.js configuration (currently empty/default)
- `postcss.config.mjs` - PostCSS configuration with Tailwind CSS plugin
- `eslint.config.mjs` - ESLint flat config with Next.js core-web-vitals and TypeScript rules

## Platform Requirements

**Development:**
- Node.js 20+ (tested with 23.6.1)
- npm or equivalent package manager
- Unix-like terminal (macOS, Linux) or Windows with WSL

**Production:**
- Vercel Platform (recommended, per README)
- Node.js 18+ for self-hosting
- Standard web server (nginx, Apache) for reverse proxy

---

*Stack analysis: 2026-01-28*
