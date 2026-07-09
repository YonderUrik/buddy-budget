import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.claude/worktrees/**",
    ],
    // Provide server-only context for tests to recognize server modules
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
    // Use react-server export condition so server-only resolves to empty.js
    conditions: ["react-server", "node"],
  },
});
