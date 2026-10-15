# Update to main — October 11, 2026

Integrated base: `8150dfb` (single scroll and mobile overflow fix).

We keep PanelSection, the desktop 3/5 + 2/5 layout, the risk scale, the open heatmap and main's standard dialogs. We do not restore the broker comparison removed from main. On mobile the returns stay in two columns, popovers become bottom sheets and benchmarks use the full-screen form dialog.

Chrome check on the real app and isolated demo database:
- desktop 1440×726, light/dark;
- mobile 390×844: document width 390 px, no overflow; popup 390 px wide and anchored to the bottom;
- saving MSCI World from the suggestions and subsequent price update;
- chart preview at August 28 and drag July 24–September 21;
- period reset, consistency of the risk dates and heatmap.

The images are fictitious data. The demo seed was aligned with the fields introduced by main; the integration suite runs separately on a fresh database.

Checks: TypeScript and ESLint on the modified files pass. Full suite on a fresh DB: 2043 tests passed, one fails in `lib/observability/logger.test.ts:66`, identical to main: it looks for the string `mario` in the stack and finds the local path `/Users/mario/`. The targeted performance, risk and range tests pass (83).
