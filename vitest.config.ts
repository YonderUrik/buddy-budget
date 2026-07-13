import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      "**/node_modules/**",
      "**/.claude/worktrees/**",
    ],
    // I test di integrazione girano contro lo stesso Postgres reale (nessun mock/rollback per test):
    // file paralleli possono farsi vedere a vicenda righe transitorie (es. bank_account_links non ancora
    // ripulite), rendendo flaky le assertion globali come findDueLinks(). Un file alla volta evita la race.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
});
