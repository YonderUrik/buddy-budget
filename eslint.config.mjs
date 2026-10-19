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
  // Hide amounts (docs/architecture/overview.md §4.13): screens format money only through lib/format, whose
  // formatters show the mask while the user hides amounts. A currency formatted by hand or a number printed with
  // toLocaleString would skip it.
  {
    files: ["app/**/*.tsx", "components/**/*.{ts,tsx}"],
    ignores: ["components/ui/**", "**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.property.name='NumberFormat'] Property[key.name='style'][value.value='currency']",
          message: "Format money with formatCurrency (lib/format or localizedFormats): it hides the amount when the user asks to.",
        },
        {
          selector: "CallExpression[callee.property.name='toLocaleString']",
          message: "Use privateNumberFormat (lib/format) for numbers about the user's money, Intl.NumberFormat/DateTimeFormat for anything else.",
        },
      ],
    },
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
    // La landing è un progetto a sé (suo package.json e suo lint, vedi job "landing" della CI).
    "landing/**",
  ]),
]);

export default eslintConfig;
