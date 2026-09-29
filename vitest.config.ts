import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "components/**/*.test.ts", "app/**/*.test.ts"],
  },
  resolve: {
    // fileURLToPath, not URL.pathname: the path has a space ("Kitchen Labs").
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
});
