import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The match data is read from disk at runtime (lib/data/fixture.ts), so file tracing can't see
  // it; list it so every server function ships with it.
  outputFileTracingIncludes: {
    "/**": ["./lib/data/fixtures/matches.json"],
  },
  // The raw GRID logs (27 GB, gitignored) must never be traced or bundled.
  outputFileTracingExcludes: {
    "/**": ["./scripts/etl/**"],
  },
};

export default nextConfig;
