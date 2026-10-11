import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text"],
      thresholds: { lines: 98, functions: 100, branches: 90, statements: 98 },
    },
  },
});
