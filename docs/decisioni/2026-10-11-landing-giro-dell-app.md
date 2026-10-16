# 2026-10-11 — Landing: app tour with full screens

After PR #311 Daniele found the screenshots unreadable (only a portion was visible), the «Tutte le 49 funzioni» ("All 49 features") catalog useless on the home and the inner pages still in the old style.

- The five «prima / ora» ("before / now") sections and the «Nel dettaglio» ("In detail") technical sheet become **a single tabbed section** (`components/tour.tsx`, copy in `TOUR` of `content/sheet.ts`): per area the old sheet, what the app does, **the full screen** at full width and the details. `ShotCrop` and `ToolShot` (crops without sidebar) are deleted: `AppShot` is always used.
- The table catalog leaves the home; `/funzioni` remains, linked at the end of the tour.
- Supported sources with **flags** (flag-icons, MIT, `public/flags/ATTRIBUTION.md`) and icons; the Italian rules show their icon.
- Labels like «Spese!A1» become normal headings: they looked like code.
- Inner pages: header on the sheet grid, final call to action in a light card and light footer instead of the navy band, pill selectors as in the app, radii from the tokens.
- Umami event `tour_tab_selected` instead of `detail_tab_selected`. Removed the Lombard credit screenshots (feature removed).

Catalog trimmed from 49 to 34 entries (Daniele's request): removed the entries that were interface details (readable names, search and notes, similarity proposals, accounts per bank, refresh, renewal notice, one-tap category, to fix, single cash, instalments and corrections, summary in the bar, hide amounts, sign-in, help, installable). The features remain in the app; the catalog lists only those that matter on their own.

Section index below the opening removed (Daniele: «non allineato, non c'entra», "not aligned, doesn't belong"): the top bar already has the links and the app tour has its tabs. Among the brokers the «E tutti gli altri» ("And all the others") card says that any CSV can be imported, because the logos alone suggested a closed list.
