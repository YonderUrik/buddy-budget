# Performance: loading, layout shifts and data weight (2026-10-11)

- **Review** of interface performance (production build with demo data, slow 4G and 4x CPU): report in the thread «Review performance interfaccia».
- **Done**:
  - `app/(app)/loading.tsx`: skeleton on page change (the URL changes in 130-565 ms instead of 0.7-1.1 s).
  - Light barrel `components/domain/investments/light.ts`: the sidebar and the modules of other areas (Debiti, Liquidità, Abbonamenti) imported the full Investimenti barrel and dragged along all the charts; now JS per page drops from 600-690 KB to 280-540 KB (estimate from the manifest) and the first data call starts 1.5 s earlier on a slow network.
  - Liquidità: reserved heights (CLS 0.44 → 0.05) and a single request for transactions (list window) instead of two.
  - Net worth history: `compact=1` reduces rows older than 400 days to the last of each month per class (it is all `buildNetWorthSeries` uses beyond one year); 2-minute `staleTime`. Panoramica and Liquidità use it, Analitiche stays on the full history.
  - Charts: Recharts entry animation also turned off in the 9 files that had it, as in the other 10.
- **Postponed**: global `staleTime` of `QueryClient` (only 18 of the 55 files that modify data invalidate the queries), Debiti layout shift (0.15, the grid grows from 540 to 814 px after first paint, cause not isolated), server-side data prefetch, `LazyMotion` (about 30 KB gzip), Analitiche (TBT 2 s), page transition with `ViewTransition`.
- **Rule that emerged**: a component of a feature folder used by other areas or by the sidebar should not be exported only from the full barrel if this drags in charts; a light barrel is used.
- **To verify in production**: compression of JSON responses (they leave the Node server uncompressed).
