import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Standard di osservabilità: nel codice dell'app si logga col logger strutturato (lib/observability),
  // mai con console.* (testo libero, nessun controllo sui dati personali). Eccezione: gli script CLI in
  // lib/db/, che parlano a un umano al terminale e non girano dentro l'app.
  {
    files: ["app/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "proxy.ts", "instrumentation.ts"],
    ignores: ["lib/db/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: { "no-console": "error" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Worktree locali di Claude Code: contengono build .next generate, non codice sorgente.
    ".claude/**",
    // La landing è un progetto a parte (landing/package.json) con la sua configurazione.
    "landing/**",
  ]),
]);

export default eslintConfig;
