# Coding Conventions

**Analysis Date:** 2026-01-28

## Naming Patterns

**Files:**
- React components use PascalCase: `layout.tsx`, `page.tsx`
- Configuration files use kebab-case or camelCase: `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`
- CSS files use kebab-case with descriptive names: `globals.css`

**Functions:**
- React components (default exports): `RootLayout`, `Home`
- Constants use camelCase: `geistSans`, `geistMono`
- Type definitions: `Metadata`
- Configuration objects: camelCase with descriptive names: `eslintConfig`, `nextConfig`

**Variables:**
- Local variables and constants use camelCase: `geistSans`, `metadata`, `eslintConfig`
- React props use Readonly generic wrapper with camelCase keys: `Readonly<{ children: React.ReactNode }>`

**Types:**
- Imported from Next.js use PascalCase: `Metadata`, `NextConfig`
- React types use full namespace: `React.ReactNode`
- Type parameters wrapped in `type` keyword: `import type { Metadata } from "next"`

## Code Style

**Formatting:**
- No explicit formatter configured (no .prettierrc found)
- 2-space indentation observed in configuration files
- Trailing commas used in multi-line objects and function parameters
- Semicolons required at end of statements

**Linting:**
- ESLint with Next.js configuration: `eslint-config-next/core-web-vitals` and `eslint-config-next/typescript`
- Config file: `eslint.config.mjs` (flat config format, ESLint 9+)
- Rules based on Core Web Vitals best practices
- TypeScript strict mode enforced in `tsconfig.json`

## Import Organization

**Order:**
1. Framework/library imports: `import type { Metadata } from "next"`
2. Component imports: `import Image from "next/image"`
3. Local/relative imports: `import "./globals.css"`

**Path Aliases:**
- Base path alias configured: `@/*` maps to `./*` in `tsconfig.json`
- Not observed in current usage; recommended for future use

**Type Imports:**
- Types imported with explicit `type` keyword: `import type { Metadata }`
- Separates type-only imports from value imports for better tree-shaking

## Error Handling

**Patterns:**
- Not extensively demonstrated in current codebase (minimal logic)
- No try-catch blocks observed in existing code
- Errors expected to be handled at Next.js framework level for components

## Logging

**Framework:** No explicit logging framework installed
- Browser console available for client components
- Server-side logging would use standard Node.js console or external library

**Patterns:**
- No logging observed in current code
- Recommended: Use console for development, integrate external logging for production

## Comments

**When to Comment:**
- Minimal comments in current code
- Configuration comments provide context: `// Override default ignores of eslint-config-next.`
- Self-documenting code preferred through clear naming

**JSDoc/TSDoc:**
- Type definitions from Next.js include TSDoc annotations
- Not required for simple components but recommended for exported utilities
- Use for public API documentation

## Function Design

**Size:** Small, focused functions preferred
- `RootLayout`: 16 lines - handles layout with metadata export
- `Home`: 65 lines - includes JSX with styling
- Helper constants: `geistSans`, `geistMono` - initialized at module level

**Parameters:**
- React component parameters destructured with types: `{ children }: Readonly<{ children: React.ReactNode }>`
- Use `Readonly` wrapper for immutability
- Type annotations on all props required (TypeScript strict mode)

**Return Values:**
- React components return JSX.Element implicitly
- Metadata is exported as const: `export const metadata: Metadata = {...}`
- No explicit return type annotation needed for components (inferred from JSX)

## Module Design

**Exports:**
- Default exports for main route components: `export default function RootLayout()`
- Named exports for metadata: `export const metadata: Metadata`
- Barrel files: Not observed in current structure

**Next.js Special Files:**
- `layout.tsx`: Root layout with metadata, applies to all routes
- `page.tsx`: Route page component
- `globals.css`: Global styles imported in layout
- `favicon.ico`: Favicon declaration

## Type Safety

**Configuration:**
- TypeScript strict mode enabled: `"strict": true` in `tsconfig.json`
- All implicit any prevented: `noImplicitAny` implicitly true
- Module resolution: `bundler` mode for Next.js optimization
- JSX configured for React 17+: `"jsx": "react-jsx"`

**React Types:**
- Always use `React.ReactNode` for children type
- Import `Metadata` from `next` for layout metadata
- Props typed with interfaces or readonly objects
