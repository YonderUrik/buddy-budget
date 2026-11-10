# Visual refresh to port in Phase 4R

Web `main` changes between `b31de19e` and `0.81.0` (`9a769fa5`) that are **visual only**: Phase 4e (functional
catch-up) deliberately left them out. Phase 4R ports them on both platforms together, from these PRs and decisions.

| Web PR | What changes | Decision / notes |
|---|---|---|
| #405 | Navy openings, condensed display titles, brand yellow for the main action and the active nav item | `2026-10-17-landing-navy-dopo-hermes.md` |
| #411 | Section titles in the display face across the app; simulator answers as one big figure (`SimulationResult`) | `2026-10-17-titoli-e-risultati-nei-simulatori.md` |
| #417 | taste-skill: no gradients, no resting shadows, no tiny capitals, filled cards | `2026-10-17-taste-skill.md` |
| #427 | Section headings without icons, no thin rules between rows, pill buttons and controls, no icons in section tabs | `2026-10-17-taste-skill-nell-app.md` |
| #413, #400 | Spacing and card surfaces touch-ups on Panoramica and Liquidità | — |
| #408 | One `PeriodSelector`: presets on one line with 44 px targets, «Personalizzato» as a calendar sheet with a day grid | `2026-10-17-selettore-del-periodo.md` |
| #397 | Language chooser **flags** next to the names (the list, preview and two rows are already ported: AUTH-060) | `2026-10-17-selettore-lingua.md` |

Notes for 4R:
- Tokens first: `design/tokens.json` must be re-exported from the web `globals.css` of `0.81.0` (fonts: Sofia Sans
  Extra Condensed for titles, Hanken Grotesk for everything else, no mono outside code).
- The Phase 4e screens (movement detail, «Primi passi» next-step block, focus picker, welcome toast) use current
  components; they inherit the refresh through the design system.
- Screenshots of both platforms go to `parity/phase4r/` with the same names as `parity/phase4e/`.

## Part 1 status (2026-10-20, both apps)

Done: tokens and fonts re-exported from `0.81.0` (brand navy/yellow colours, display titles, Hanken figures, sentence-case
labels, system mono, flat fills, floating-only shadows, capsule bottom bar metrics); design-system components (pill buttons
with `sun`, filled cards, icon-less `BBSection` in the display face, `BBSoftRow`, `SectionViewsHeading` + `BBSunIconButton`,
`PeriodSelector` with the calendar sheet and `CalendarRange` logic, `SimulationResult`, `BBFlag`, `SearchField`); screens:
shell (brand top bar on tab roots, floating capsule bottom bar, «Altro»), sign-in and onboarding (display titles, yellow
main button, language flags), Panoramica, Liquidità (Movimenti in the web's phone order with the month column at the end,
Analisi without cards, Conti, Abbonamenti, Categorizza card). Component gallery page 8 «4R · Sections · Period».

Left for part 2: every other screen hand-tuned against the web (Investimenti incl. register/registration actions, Debiti
rows and simulators with `SimulationResult`, Pensione headings with icons and the TFR gradient bar, Analitiche with the
month-grid `PeriodSelector`, Impostazioni groups as condensed titles, Aiuto, Importazioni, Categorie, movement detail);
the Liquidità hero chart with its period selector (TX-009, still deferred); the dashed «+ Conto» account tile.

## Part 2 status (2026-10-20, both apps)

Done, hand-tuned against web `0.81.0` at 402 pt (screens in `parity/phase4r-2/`):
- **Section headings everywhere**: Investimenti (6 tabs), Pensione (5 tabs, with a fund), Analitiche (Risposte / Obiettivi) and
  Categorie e regole (as a Liquidità view) use `SectionViewsHeading`; no tab strips or subtitles on the phone; yellow main
  actions (`BBSunIconButton`, «+ Aggiungi» pill in Debiti, «Estinzione anticipata» on a loan).
- **No rules between rows** in Investimenti, Debiti, Pensione, Analitiche, Obiettivi, Aiuto, Impostazioni, Importazioni;
  section headings without icon tiles (goals, pension scenarios, help, settings sections); Impostazioni groups as condensed
  display titles; pension exit-tax bar flat; pension, performance and security charts inside the margins with dates.
- **Simulators** answer with `SimulationResult` (debt «Più ogni mese», «Surroga», sale «Ti resta»); Analitiche data period
  is the shared `PeriodSelector` with the month-grid calendar; headline figure and years on one baseline.
- **Liquidità hero chart (TX-009…011)**: change line, `TrendChart` 260 and `1M 3M 1A Max`; dashed «+ Conto» tile; movement
  avatars fall back to the category (never an initial). Data: `GET /api/overview?period=` (`liquidita` class) for all accounts,
  paged `GET /api/transactions?accountId&from` for one account — no backend change needed.
- Categories as wrapping chips in soft group panels; security page header (badge + display title, «Segui» / «Registra»,
  `MoneyHero` price, facts without a card, one-line composition rows); goal detail `MoneyHero` + wrapping actions;
  Importazioni title icon and «Passo N di 3».
- Checked: Android Panoramica top renders (part-1 black capture was a capture timing issue) and the Movimenti account tiles
  placeholder is only the loading state (accounts arrive with the first refresh; the hero now loads in parallel).

Remaining differences (accepted, mobile adaptations): actions «Cambio tasso», «Correggi residuo», «Elimina» on a loan stay in
the «⋯» sheet; Regole keep the list + sheet editor (web shows an inline editor); security «Crea avviso» stays under the field;
the performance and security charts show dates but no y-axis labels; the web shows the brand top bar on pushed pages
(Pensione, Analitiche, Impostazioni…) where the apps keep the back bar.
