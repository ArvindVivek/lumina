# Testing Patterns

**Analysis Date:** 2026-01-28

## Test Framework

**Status:** Not configured

**Findings:**
- No testing framework detected in `package.json`
- No test configuration files found (no `jest.config.js`, `vitest.config.ts`, etc.)
- No test files detected in codebase (no `*.test.ts`, `*.spec.ts` files)
- `@playwright/test` is listed in `package-lock.json` but NOT in `package.json` dependencies or devDependencies
- No test scripts defined in `package.json` (only `"dev"`, `"build"`, `"start"`, `"lint"`)

## Recommended Testing Setup

**Suggested Frameworks:**
- Unit/Integration: Vitest (Vue/React optimized, ESM native) or Jest
- E2E: Playwright or Cypress
- React Component Testing: Testing Library (@testing-library/react)

## Test File Organization

**Current Status:** No tests exist

**Recommended Pattern:**
- Co-locate tests with source: `app/page.test.tsx` next to `app/page.tsx`
- Utilities: `lib/utils.ts` paired with `lib/utils.test.ts`

**Location Convention:**
```
app/
├── page.tsx
├── page.test.tsx
├── layout.tsx
└── layout.test.tsx
```

## Test Structure Template

**Recommended Suite Pattern:**

```typescript
import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Home Page", () => {
  it("should render heading", () => {
    render(<Home />);
    expect(screen.getByRole("heading")).toBeInTheDocument();
  });

  it("should render links", () => {
    render(<Home />);
    const links = screen.getAllByRole("link");
    expect(links.length).toBeGreaterThan(0);
  });
});
```

**Suite Organization:**
- One `describe` block per component/module
- Descriptive test names using `it("should...")`
- Setup/teardown as needed before/after each test
- Arrange-Act-Assert pattern followed

## Mocking

**Current Status:** No mocking framework configured

**Recommended Framework:**
- Vitest has built-in mocking (similar to Jest)
- Mock Next.js Image: `next/image` for testing

**Pattern for Next.js Components:**

```typescript
// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props) => <img {...props} />,
}));

// Test with mocked image
import Home from "./page";
describe("Home", () => {
  it("renders image", () => {
    render(<Home />);
    expect(screen.getByAltText("Next.js logo")).toBeInTheDocument();
  });
});
```

**What to Mock:**
- External API calls
- Next.js specific features (`next/image`, `next/font`)
- File system operations
- Third-party library calls

**What NOT to Mock:**
- React components (test actual behavior)
- User interactions (test real DOM events)
- Business logic (test actual implementation)

## Fixtures and Test Data

**Current Status:** No fixtures defined

**Recommended Pattern:**

```typescript
// lib/test-utils.ts
import { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";

export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) {
  return render(ui, { ...options });
}

export const mockLayoutProps = {
  children: <div>Test Child</div>,
};
```

**Location:**
- `lib/test-utils.ts`: Shared testing utilities
- `__fixtures__/`: Test data fixtures if needed
- Co-located `*.fixture.ts` files for component-specific data

## Coverage

**Current Status:** Not enforced

**Recommended Setup:**
```bash
npm run test -- --coverage
```

**Suggested Targets:**
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

**Configuration in jest.config.js or vitest.config.ts:**
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "dist/"],
    },
  },
});
```

## Test Types

**Unit Tests:**
- Scope: Individual functions, components, utilities
- Approach: Fast, isolated, mock dependencies
- Example: Test `RootLayout` metadata export
- Expected location: `app/layout.test.tsx`

**Integration Tests:**
- Scope: Component composition, data flow between modules
- Approach: Test real interactions between components
- Example: Test page rendering with layout
- Expected location: `app/__tests__/integration.test.tsx`

**E2E Tests:**
- Framework: Playwright (package already in lock file)
- Scope: Full user workflows
- Example: Navigate home page, click links, verify navigation
- Expected location: `e2e/home.spec.ts`
- Playwright recommended configuration: `playwright.config.ts`

## Async Testing

**Pattern for Server Components:**

```typescript
// app/page.test.tsx
import Home from "./page";

describe("Home Page", async () => {
  it("should render server component", async () => {
    const { container } = render(await Home());
    expect(container.querySelector("main")).toBeInTheDocument();
  });
});
```

## Error Testing

**Pattern for Error Boundaries:**

```typescript
describe("Error Handling", () => {
  it("should catch errors in component", () => {
    const ThrowError = () => {
      throw new Error("Test error");
    };

    expect(() => render(<ThrowError />)).toThrow("Test error");
  });
});
```

## Getting Started with Testing

**Setup Steps:**
1. Install framework: `npm install -D vitest @vitest/ui`
2. Install testing library: `npm install -D @testing-library/react @testing-library/jest-dom`
3. Create `vitest.config.ts` configuration
4. Add test script to `package.json`: `"test": "vitest"`
5. Create first test file: `app/layout.test.tsx`

**Minimal vitest.config.ts:**
```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

**First Test Command:**
```bash
npm run test -- --watch
```
