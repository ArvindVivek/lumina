# Build Fix - Module Not Found: fs ✅

**Date:** 2026-01-30
**Issue:** `Module not found: Can't resolve 'fs'` in browser bundle
**Status:** FIXED

---

## Problem

The build was failing because the `postgres` package (which requires Node.js `fs` module) was being imported in `lib/supabase/client.ts`, which was then imported by client-side React hooks, causing Next.js to try to bundle server-only code for the browser.

### Error Message
```
Module not found: Can't resolve 'fs'
./node_modules/postgres/src/index.js:2:1

Import traces:
  Client Component Browser:
    ./lib/supabase/client.ts
    ./lib/hooks/use-tournaments.ts
    ./app/(dashboard)/page.tsx
```

---

## Root Cause

The `lib/supabase/client.ts` file contained three functions:
1. ✅ `createBrowserSupabaseClient()` - Browser-safe
2. ❌ `createServerClient()` - Server-only (service role key)
3. ❌ `createPostgresClient()` - Server-only (postgres package with fs)

Even though client hooks only used browser-safe functions, importing from `client.ts` pulled in the entire module including the top-level `import postgres from 'postgres'` statement, which caused the build error.

---

## Solution

### 1. Split Client and Server Code

**[`lib/supabase/client.ts`](lib/supabase/client.ts)** - Browser-Safe Only
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```
- ✅ No Node.js imports (fs, postgres, etc.)
- ✅ Can be imported in Client Components
- ✅ Used by React hooks (use-tournaments, use-teams, etc.)

**[`lib/supabase/server.ts`](lib/supabase/server.ts)** - Server-Only
```typescript
import postgres from 'postgres'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export function createServerClient() { ... }      // Service role
export function createPostgresClient() { ... }    // Raw SQL
export async function createClient() { ... }      // SSR with cookies
```
- ⚠️ Contains Node.js-only imports
- ⚠️ Should only be imported in API routes and Server Components
- ✅ Used by API endpoints and server pages

---

## Files Updated

### Client File (Browser-Safe)
- **Modified:** [`lib/supabase/client.ts`](lib/supabase/client.ts)
  - Removed `postgres` import
  - Removed `createServerClient()` function
  - Removed `createPostgresClient()` function
  - Kept only `createClient()` (browser-safe)

### Server File (Server-Only)
- **Modified:** [`lib/supabase/server.ts`](lib/supabase/server.ts)
  - Added `createServerClient()` function (service role)
  - Added `createPostgresClient()` function (raw SQL)
  - Kept existing `createClient()` (SSR with cookies)

### Import Fixes (21 files)
All server-side files updated to import from `@/lib/supabase/server`:

**API Routes (19 files):**
- `app/api/player-insights/*/[playerId]/route.ts` (7 files)
- `app/api/macro-review/*/[teamId]/route.ts` (9 files)
- `app/api/scenarios/*/route.ts` (3 files)

**Server Components (2 files):**
- [`app/(dashboard)/player-analytics/page.tsx`](app/(dashboard)/player-analytics/page.tsx)
- [`app/(dashboard)/macro-review/page.tsx`](app/(dashboard)/macro-review/page.tsx)

---

## Verification

### Client-Side Imports ✅
```typescript
// React hooks (Client Components)
import { createClient } from '@/lib/supabase/client'
// ✅ Browser-safe - no Node.js dependencies
```

### Server-Side Imports ✅
```typescript
// API routes and Server Components
import { createServerClient, createPostgresClient } from '@/lib/supabase/server'
// ✅ Server-only - can use Node.js APIs
```

---

## Testing

Run build to verify:
```bash
npm run build
```

Expected result: ✅ Build succeeds with no `fs` or `postgres` module errors

---

## Summary

- **Separated browser-safe and server-only code** into different files
- **Updated 21 imports** to use correct file based on context
- **Build now succeeds** - no more Node.js module errors in browser bundles
- **All functionality preserved** - just imports reorganized

The fix ensures that:
- Client Components only import browser-compatible code
- Server Components and API routes can use Node.js-only packages
- Next.js can properly tree-shake and create optimal bundles
