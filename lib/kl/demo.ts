// KL Web 1.0.3, from kitchenlabs-kit/web/kl-web/lib/demo.ts. Kit-owned: change it in the kit, then run scripts/sync-web-kit.sh.
// Demo mode: the whole app clickable on sample data, with nothing real reachable.
// One switch (NEXT_PUBLIC_DEMO_MODE=1), read here only. Guide: docs/web/demo-mode.md.
// The on-screen notice is <DemoBanner /> in components/kl/DemoBanner.tsx.

/** True when a raw env value turns demo mode on ("1" or "true"). */
export function demoModeFrom(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

/** True in the demo deployment. Literal member expression so Next inlines it in the browser. */
export const isDemo = demoModeFrom(process.env.NEXT_PUBLIC_DEMO_MODE);

export const DEMO_NOTICE = "Demo with sample data. Nothing here is real.";

/**
 * Picks the data layer once, so screens never check isDemo themselves:
 * `export const data = chooseDataLayer(live, demo);` in lib/data/index.ts.
 */
export function chooseDataLayer<T>(live: T, demo: T, demoMode = isDemo): T {
  return demoMode ? demo : live;
}

/**
 * Loads fixtures lazily, so live builds don't ship the sample data in the main bundle:
 * `const trips = await loadFixture(() => import("./fixtures/trips"));`
 * Returns a deep copy, so in-memory "writes" in one screen can't leak into the fixture itself.
 */
export async function loadFixture<T>(loader: () => Promise<{ default: T }> | { default: T }): Promise<T> {
  const mod = await loader();
  return structuredClone(mod.default);
}

/** Fixture dates relative to today, so a demo never looks stale: `daysAgo(3)`. */
export function daysAgo(days: number, now: Date = new Date()): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

/** The opposite of daysAgo, for upcoming things: `daysFromNow(2)`. */
export function daysFromNow(days: number, now: Date = new Date()): Date {
  return daysAgo(-days, now);
}

/**
 * First line of anything that moves money, sends a message or writes somewhere real:
 * throws before any network call in demo mode.
 */
export function assertNotDemo(action: string, demoMode = isDemo): void {
  if (demoMode) throw new Error(`${action} is turned off in the demo. Nothing was sent.`);
}

/** Pretends to take a moment, so loading states show in the demo like they would live. */
export function demoDelay(ms = 350): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
