# App shell & navigation

Status: draft · Source: app/layout.tsx, app/(app)/layout.tsx, app/(app)/attention-shell.tsx, app/(app)/sidebar-insights-slot.tsx, app/(app)/page.tsx, app/(app)/error.tsx, app/(app)/loading.tsx, app/global-error.tsx, app/(app)/country-unavailable, app/(app)/style-guide, app/manifest.ts, proxy.ts, components/layout/*, components/theme-submenu.tsx, components/privacy-provider.tsx, components/domain/sidebar-insights/*, components/domain/sync/*, components/domain/whats-new/*, components/domain/start/demo-banner*.tsx, lib/account/home-pages.ts, lib/attention/*, lib/queries/attention.ts, lib/queries/sidebar.ts, lib/queries/sync-jobs.ts, lib/sidebar/*, lib/sync-jobs/*, lib/whats-new/*, lib/hooks/use-sidebar-preferences.ts, lib/localization/config.ts, lib/localization/planning-availability.ts, lib/localization/guard.ts, lib/features/catalog.ts, lib/app-version/*, lib/format.ts

## Purpose

Defines everything that surrounds every authenticated screen: the route gate (auth, deactivated account, legal acceptance, onboarding, country), the home redirect, primary navigation (sidebar on desktop, bottom bar + «Altro» menu on phone), the user menu (settings, help, hide amounts, theme, sign-out), global overlays mounted once for the whole app (sync "dark island", personal-import island, «Scrivici» sheet, demo-data banner), the sidebar "insights" modules (net worth, upcoming deadlines, FIRE goal, portfolio, watchlist), the «Novità» chip logic, the privacy mask, page-level loading/error states, and the **country gating model** used by every other spec file. It also contains the feature catalog → spec-file map.

## Entry points & navigation

- App launch → `/` → redirect to the user's chosen home page (see Home redirect).
- Primary sections (NAV_ITEMS, in this order): `Panoramica` (/panoramica), `Liquidità` (/liquidita), `Investimenti` (/investimenti), `Pensione` (/pensione), `Debiti` (/debiti), `Analitiche` (/analitiche). Each item is filtered by `isCountryPathAvailable(productCountry, href)` → for DE only Panoramica, Liquidità, Investimenti, Debiti remain.
- Secondary destinations reachable from shell: `Impostazioni` (/impostazioni, spec 15), `Aiuto e segnalazioni` (/aiuto, spec 16), «Scrivici» sheet (spec 16), `/categorizza` (from sync island, spec 05), deadline rows (`/debiti/finanziamenti?id=…`, `/liquidita/conti?rinnova=sidebar`), FIRE module (/analitiche), sidebar holdings/watchlist rows (`/investimenti/titoli/{instrumentId}`).
- Routes not in primary nav but present: `/categorizza`, `/importazioni`, `/conti/collega`, `/liquidita/{conti,analisi,categorie,regole,abbonamenti}`, `/investimenti/{operazioni,performance,diversificazione,proventi,tasse,titoli,rendiconti}`, `/analitiche/{obiettivi,crescita,costi,prelievi,rischio,simulazione}` — owned by their area specs.
- Dev-only: `/style-guide` (design-token/component gallery) — **excluded from mobile**.

## Screens

### Route gate (proxy.ts) — order of evaluation

Applies to every request (pages and `/api/*`), except static assets/manifest/icons.

1. `/login` while already signed in → redirect to `safeRedirectPath(?redirect)` (only same-origin relative paths; `/`, `/login*`, `/onboarding*` → default after-login path).
2. Public prefixes pass without session: `/login`, `/api/auth`, `/api/health`, `/api/cron`, `/api/metrics`, `/api/email`, `/disiscrizione` (email unsubscribe), `/_next`, `/favicon.ico`.
3. No session → API: `401`; page: redirect to `/login?redirect=<pathname>`.
4. Account deactivated (`deletionScheduledAt` set) → only `/account-disattivato` page and `POST /api/user/reactivate` are allowed; other APIs `403`, other pages redirect to `/account-disattivato`. Visiting `/account-disattivato` when not deactivated → `/`.
5. Onboarding completed but legal documents outdated (`needsLegalAcceptance(legalAcceptedVersion)`) → only `/accetta-termini` and APIs `/api/user/legal-acceptance`, `/api/user/export`, `/api/user/account` allowed; other APIs `403`; pages redirect to `/accetta-termini`. Visiting `/accetta-termini` when not needed → `/`.
6. Onboarding not completed → every non-API page redirects to `/onboarding`. Onboarding completed + `/onboarding` → `/`.
7. Country policy: if `!isCountryPathAvailable(productCountry, pathname)` → API `403 {code:"country_feature_unavailable", error:"Questa funzione non è ancora disponibile per la Germania."}` (localized); page → redirect `/country-unavailable`.

Details of login, onboarding, legal acceptance and deactivated account screens are in 01-auth-onboarding.

### Country gating model (central reference for all specs)

- Product country ∈ {IT, DE}, independent of language (IT → it|en; DE → en|de). Unknown stored values resolve to IT / it; DE with unsupported language falls back to en.
- `isCountryPathAvailable(country, path)`:
  - IT: everything available.
  - DE: `/pensione` (switch `pension`=false) and `/analitiche` (switch `retirement`=false) unavailable, including all subpaths (`/analitiche/obiettivi`, …). `/investimenti/tasse` (`tax`=true) and `/investimenti/proventi` (`income`=true) are available but render the dedicated German PlanningScreen (spec 13). `/api/financial-planning` allowed for DE.
  - DE blocked API prefixes: `/api/pension`, `/api/analytics`, `/api/goals`, `/api/sidebar/fire`, `/api/investments/tax-carryforwards` → `403 country_feature_unavailable` (also enforced in handlers via `withCountryGuard`).
- Planning switches (`isPlanningAvailable`): DE = {tax: true, income: true, pension: false, retirement: false, simulations: false}; any other country → false for the dedicated screens.
- Legacy engine flags (`countryFeatures(country)` from financial-country): IT = {taxes, pension, retirement, incomeForecasts, inflation all true}; DE = all false except `inflation`. In the shell, `features.retirement` gates the FIRE sidebar module and its settings toggle.
- Consumers of the route policy in the shell: sidebar items, bottom bar, «Altro» menu sections, «Novità» entries (entry hidden if its href path is unavailable), proxy, API guard.

### Country unavailable screen (/country-unavailable)

- Shown when a DE user deep-links/bookmarks a blocked page.
- Title `Questa funzione non è ancora disponibile per la Germania.`; body `Per la Germania, tasse, pensione, previsioni dei dividendi e pianificazione del pensionamento non sono ancora disponibili. I dati esistenti vengono conservati.`; link `Panoramica` → /panoramica.

### Home redirect (/)

- Redirects to `resolveHomePage(user.homePage)`. Allowed options (chosen in Impostazioni, spec 15): `Panoramica` (/panoramica, default), `Liquidità` (/liquidita), `Conti` (/liquidita/conti), `Analisi dei movimenti` (/liquidita/analisi), `Investimenti` (/investimenti).
- Legacy saved values are mapped: `/conti` → /liquidita/conti, `/movimenti` → /liquidita, `/movimenti/analisi` → /liquidita/analisi. Any other/invalid value → /panoramica.

### Shell layout by width (web reference)

- Phone (<768): top bar + content + (default) bottom bar; or, if the user disabled the bottom bar, top bar with hamburger opening a left drawer containing the expanded sidebar.
- Tablet (768–1023): sidebar forced icon-only (does not overwrite desktop preference).
- Desktop (≥1024): sidebar expanded (240) or collapsed icon-only (64), toggled by `Comprimi` / `Espandi sidebar`; persisted per device (localStorage `buddybudget:sidebar:collapsed`).
- A single scroll container for content; horizontal overflow never scrolls the page.

### Sidebar (desktop / drawer)

- Header: logo mark + `BuddyBudget` (logo only when collapsed).
- Nav list (country-filtered NAV_ITEMS). Active item = pending tapped item, else route prefix match (`pathname === href || startsWith(href + "/")`). A single animated "pill" marks the active item.
- Items with `comingSoon` render disabled with badge `Presto` (currently none).
- Badge on `Liquidità`: count of transactions still in the fallback category «Da categorizzare» (`uncategorizedCount` from `GET /api/transactions/attention`); shown only when > 0; label capped at `99+`; accessibility label `{n} da decidere`. Collapsed sidebar shows a dot instead of the number.
- Insights slot under the nav (see Sidebar insights).
- Footer: `Scrivici` button (opens quick-report sheet, source `pulsante`; spec 16) → user card (avatar image or initials from name; name or `Utente` placeholder; email) opening the user menu → collapse toggle (desktop only) → version label.
- User menu: name/email header; `Impostazioni` → /impostazioni; `Aiuto e segnalazioni` → `/aiuto?da=<current path>` (no `da` when already in /aiuto); checkbox `Nascondi gli importi`; submenu `Tema` with radio `Chiaro` / `Scuro` / `Sistema` (current choice shown at right); `Esci` (destructive colour).
- `Esci`: signs out, then hard-reloads to `/login` so no cached data survives for the next user of the device. No confirmation.

### Version label

- Compact `v{version} · {shortSha7}` (only `v{version}` when collapsed or commit unknown). Details (tooltip/a11y): `Versione {v}` / `Commit {sha}` / `Build {date short, time short}`.

### Mobile top bar

- Left: hamburger `Apri menu di navigazione` (only when bottom bar disabled; otherwise empty spacer). Centre: logo + `BuddyBudget`. Right: speech-bubble icon (a11y `Scrivici: segnala un problema, una domanda o un'idea`) opening the «Scrivici» sheet.

### Bottom navigation bar (phone, default ON)

- Tabs, in order: `Panoramica`, `Liquidità`, `Investimenti`, `Debiti` (only those available for the country), then `Altro`.
- No badge on the Liquidità tab since web #451 (the «Da decidere» count lives in Movimenti and Categorizza).
- `Altro` is shown as active when the current route is not under any of the primary tabs.
- Active indicator moves immediately on tap (pending nav) before the destination loads.
- Toggle "bottom bar vs hamburger drawer" is a per-device preference in Impostazioni (localStorage `bb:mobile:bottom-nav`, default true; spec 15).

### «Altro» menu (full-screen, phone)

- Header `Altro` with close × (`Chiudi il menu`); closes with ×, Esc, or system Back (Back must not leave the app). Navigating from it replaces the history entry.
- Content top→bottom:
  1. Account row: avatar/initials, name (fallback `Il tuo account`), email (fallback `Profilo e impostazioni`) → /impostazioni.
  2. `Altre sezioni`: NAV items not in the bottom bar and available for the country (IT: `Pensione` with hint `Fondi, rendimento e a quanto arriverai`; `Analitiche` with hint `Quando arrivi al traguardo e cosa cambia con le tue ipotesi`), with badge if any. Section hidden if empty (DE).
  3. `Assistenza`: `Impostazioni` (`Aspetto, notifiche, privacy e dati`), `Aiuto e segnalazioni` (`Domande, problemi e idee`) → /aiuto.
  4. Switch `Nascondi gli importi` (`Utile quando qualcuno guarda lo schermo`).
  5. `Il tuo quadro`: collapsible row `Patrimonio, scadenze e obiettivo` (`Tocca per aprire il riepilogo` / `Tocca per chiudere`); when opened shows the sidebar insights modules expanded. **No data is loaded until opened.**
  6. `Esci` (destructive), legal links `Privacy`, `Termini`, `Cookie` (external landing URLs `https://buddybudget.io/{privacy|termini|cookie}`), version label.
- Theme is not in «Altro» (lives in Impostazioni).

### Sidebar insights modules

Each module is toggled per device in Impostazioni (localStorage `bb:sidebar:module:{oggi|portafoglio|watchlist|scadenze|fire}`, default ON); a disabled module makes no request. Render order: `Oggi` (net worth) → `Prossime scadenze` → `Obiettivo FIRE` → `Portafoglio` → `Watchlist`. Each section is collapsible (collapsed shows a one-line summary). Collapsed sidebar shows only the portfolio day-change chip (`{±x,x%}` + `oggi`, links /investimenti); deadlines and FIRE hidden when collapsed. All amounts honour the privacy mask (`••••`).

- Data: `GET /api/sidebar/summary` (stale 5 min) feeds Oggi/Portafoglio/Watchlist; `GET /api/sidebar/deadlines` (stale 10 min); `GET /api/sidebar/fire` (stale 60 min, only if `features.retirement`; DE → 403). No retries; errors render nothing (navigation must never be disturbed). Loading = skeleton placeholders.
- Eye toggle (`Mostra gli importi` / `Nascondi gli importi`) in the first visible summary section.
- **Oggi**: net worth total (integer currency) + `Patrimonio netto · {±amount} in 30 giorni` (change omitted if null). If the user excluded pension from net worth (preference, spec 02/15) pension total and its month change are subtracted.
- **Portafoglio**: total value, day-change chip, `{±total gain}` and ` · {x%} in totale`; top 3 holdings (ticker label, name, value, day change %, sparkline, alert marker if triggered price alerts); if more than 3: `Mostra tutti ({n}) →` → /investimenti.
- **Watchlist** (default collapsed): summary `{n} titolo|titoli`, badge `{n} avviso|avvisi` when price alerts triggered; up to 4 rows (last close with 2 decimals in instrument currency), `Mostra tutti ({n}) →`.
- **Prossime scadenze**: up to 4 items merged and sorted by date: debt instalments (label = debt name, amount, → `/debiti/finanziamenti?id={debtId}`) and bank-connection renewals (label `Rinnova {institution}`, no amount, → `/liquidita/conti?rinnova=sidebar` which auto-opens renewal). A renewal appears when the connection is `expiring` (consent ends within 7 days; date = expiry) or `expired`/`error` (date = today, overdue). Overdue items in red with badge `{n} scaduta|scadute`. Summary when collapsed: next date `{d} {mon}`. Hidden if empty.
- **Obiettivo FIRE** (IT only): progress bar to FIRE number (`{x%} del numero FIRE`, capped 100%), then `Obiettivo raggiunto` or `Mancano {amount}{ · tra N anni | tra 1 anno | tra meno di un anno}`; if annual retirement spend unknown: `Indica la spesa annua in pensione in Analitiche per stimare il tuo numero FIRE.` Tap → /analitiche.

### Attention (movements needing a decision)

- `GET /api/transactions/attention` → `{newCount, uncategorizedCount, totalCount, newTransactionIds[≤200]}`; stale 60 s; no retry. "New" = imported automatically (source auto) after the user's last visit to movements; "uncategorized" = in fallback category.
- The shell no longer uses it (web #451 removed the Liquidità badge). Overview card and movements use the rest (specs 02, 03); movements screens call `POST /api/transactions/attention/seen` on open.
- Helper copy: `{n} nuove · {m} da categorizzare` (`1 nuova`), parts at zero omitted.
- Note: GoCardless consent-expiry reminders surface in the shell only via «Prossime scadenze»; banners/renew flows live in 04-accounts-bank-sync.

### Background job indicator ("dark island")

- Mounted once, bottom of screen (centred on phone, above the bottom bar and safe area; right on desktop), stacking one island per sync job plus the personal-import islands (PersonalImportIsland, detail in 14-imports).
- `GET /api/sync-jobs` returns non-dismissed jobs (`503` if store unavailable). Polled every 1 s **only while at least one job is running**; otherwise fetched on mount/focus.
- Job: kind `initial-import` | `manual-sync`; status `running|done|failed`; `interrupted` when no heartbeat for 60 s; jobs expire after 24 h. Per-account phases: queued, balance, fetching, saving, done, limited, expired, error.
- Collapsed pill: progress ring (running) / red alert icon (failed or interrupted) / green check (done) + title: `Sincronizzazione in corso · {n} conto|conti`, `Sincronizzazione completata`, `Sincronizzazione non riuscita`, `Sincronizzazione interrotta`. Tapping toggles details. When a job finishes, the island auto-expands to show the outcome.
- Per-account rows: account name, text and progress bar:
  - queued `In attesa`; balance `Aggiorno il saldo…`; fetching `Scarico i movimenti dalla banca…` (indeterminate bar); saving `Importati {p} di {t} movimento|movimenti` (determinate);
  - done: sync summary (e.g. `Nessuna nuova transazione trovata. Saldo aggiornato.` or `{n} … . Saldo aggiornato.`), full green bar;
  - limited `La banca ha temporaneamente esaurito le chiamate disponibili. Riprova più tardi.`; expired `Sessione con la banca scaduta. Riconnetti il conto per sincronizzare.`; error already-running `Sincronizzazione già in corso per questo conto.`; error `Sincronizzazione non riuscita. Riprova più tardi.` or, if interrupted, `Sincronizzazione interrotta. I movimenti già salvati restano, il prossimo sync riprende da lì.`
- Finished job actions: × `Chiudi riepilogo` → `POST /api/sync-jobs/{id}/dismiss`; `Segnala questo problema` if any error (area `sync_banca`, spec 16); `Categorizza` → /categorizza if any uncategorized movements were imported. Running jobs cannot be dismissed.
- On job finish, invalidate accounts, connection status, net-worth snapshots and all categorization-dependent data (attention, movements, Categorizza).

### Demo-data banner

- Shown at the top of every app screen while demo data is active (`GET /api/start` → `demoActive`). Copy: **`Dati d'esempio.`** `Quello che vedi è inventato. Azzera per aggiungere i tuoi conti e movimenti.` Button `Azzera e inizia` (`Azzero…` while pending) → `DELETE /api/start/demo`; error shown inline. No confirmation. (Primi passi checklist and starting demo data: spec 02.)

### «Novità» (what's new)

- Curated list (`lib/whats-new/entries.ts`): id, date, title, summary, href, CTA. Current entries: `Obiettivi di risparmio` (2026-10-15, → `/analitiche/obiettivi?nuovo=1&da=novita`, CTA `Crea un obiettivo`), `Categorizza con l'AI` (2026-10-11, → /categorizza, CTA `Apri Categorizza`).
- Selection: most recent entry not dismissed, not older than 45 days, released after the user's sign-up (a feature that existed when the user arrived is not news; web #444), and whose href path is available for the user's country; at most one shown.
- Rendered as a chip next to the date in Panoramica's header (placement: spec 02): `Novità: {title}`; tap opens popover (bottom sheet on phone) with title, summary, `Non mostrare più` (dismiss, remembered per device in localStorage `bb:whats-new-dismissed`) and CTA button.

### «Dall'ultima visita» (web #457)

- When a returning user opens the app (any screen), one toast says what happened while they were away and what waits for them, with one action. Shown at most once per visit, on any device (the server remembers it).
- Visits: the open app sends a heartbeat `POST /api/visits` on open, when it comes back to the foreground and every 5 minutes while in the foreground; more than 30 minutes without a heartbeat starts a new visit (`{newVisit: true}` → read the summary again).
- `GET /api/welcome` → `{summary: null | {since, happened[], waiting[]}}`; `happened`: `movements` (movements added while away), `price_alerts`, `price_rises` (subscriptions); `waiting`: `to_decide` (movements without category), `subscriptions` (to confirm), `import_review` (`jobId` of the most recent import with rows to check). Counts only.
- Toast (10 s): one line per group, joined with the language's list format and a non-breaking space between count and words — `Mentre eri via: {12 movimenti nuovi, 1 avviso di prezzo scattato e 2 abbonamenti costano di più}` and `Da sistemare: {7 movimenti senza categoria, …}`. Words: `movimento nuovo`/`movimenti nuovi`, `avviso di prezzo scattato`/`avvisi di prezzo scattati`, `abbonamento costa di più`/`abbonamenti costano di più`, `movimento senza categoria`/`movimenti senza categoria`, `abbonamento da confermare`/`abbonamenti da confermare`, `import da controllare`. Action of the first waiting item — `Decidi` (→ Categorizza), `Controlla` (→ Abbonamenti), `Apri` (→ Importazioni, that job) — or, with nothing waiting, `Vedi` on the first thing that happened (movements → Liquidità, price alerts → Investimenti · Titoli seguiti, price rises → Abbonamenti).
- After showing it the app sends `PATCH /api/welcome {shown: true}` (best effort).

### Privacy mask («Nascondi gli importi»)

- Server-persisted user preference `hideAmounts` (initial value read with the session so first render is correct). Toggle points: user menu checkbox, «Altro» switch, eye in sidebar insights, and Impostazioni (spec 15).
- Toggle is optimistic; saved with `PATCH /api/user/settings {hideAmounts}`; on failure it reverts.
- When on: every amount of the user's money renders `••••` — currency amounts, but also (web #448) the figures written without a currency: quantities held, prices paid, fees of investment operations and positions, amounts read from an import file and the Liquidità «Hai {x} su {n} conti» sentence; every chart of the user's money is blurred (also hand-drawn ones). Fixed sample values (the language preview of 15-settings) are not masked. The whole content re-renders without refetching.

### Theme

- `Chiaro` / `Scuro` / `Sistema` (default `Sistema` = follow OS). Per-device (not server-persisted). Status-bar colours: light `#f7f7f8`, dark `#111113`.

### Section transitions & pending navigation

- When switching top-level section (first path segment) content fades/slides in (200 ms); never on first open; tabs within a section don't animate; disabled under reduce-motion.
- Nav indicators move immediately to the tapped item while the next screen loads.

### Loading & error states (all app screens)

- Route loading: skeleton (title bar, subtitle, large card, two columns) with a11y `Caricamento in corso`.
- Screen render error: title `Questa pagina non si è caricata`, body `Qualcosa è andato storto da parte nostra. I tuoi dati non sono stati toccati: riprova, e se succede ancora segnalacelo.`, optional `Codice errore: {digest}`, buttons `Riprova` and `Segnala questo problema` (area `caricamento`). The error is reported once to `POST /api/client-errors` (spec 16). Navigation shell remains visible.
- Whole-app crash: title `BuddyBudget non si è caricato`, body `Qualcosa è andato storto da parte nostra. I tuoi dati non sono stati toccati: ricarica la pagina, e se succede ancora scrivici a support@buddybudget.io.`, `Riprova`, no report link.
- Toasts (global Toaster) for transient feedback; error toasts may carry action `Segnala` (spec 16).

### PWA

- Web manifest: name/short_name `BuddyBudget`, standalone, start `/`, icons 192/512 (any + maskable), white theme/background; no service worker (online-only). `pwa_installed` analytics event. Not applicable to native apps except icon/brand assets.

### Style guide (/style-guide)

- Internal design gallery (colour tokens, components, theme toggle). Dev-only; **not part of the mobile apps**.

### Feature catalog (lib/features/catalog.ts) → spec file map

Single source of truth for landing/login "In arrivo". `appPath` entries are checked against NAV_ITEMS. Status: `live`, `new` (badge "Nuovo"), `soon` (badge "Presto").

| id | area | name | status | appPath | spec file |
|---|---|---|---|---|---|
| csv-personali-ai | Liquidità | CSV personali con AI | new | — | 14-imports |
| primi-passi-e-dati-d-esempio | Account | Primi passi e dati d'esempio | new | — | 02-overview (banner: 00) |
| collegamento-alla-banca | Liquidità | Collegamento alla banca | live | — | 04-accounts-bank-sync |
| conti-manuali | Liquidità | Conti manuali | live | — | 04-accounts-bank-sync |
| categorizza-con-ai | Liquidità | Categorizza con l'AI | new | — | 05-categories-categorization |
| categorie-pronte | Liquidità | Categorie pronte da scegliere | new | — | 05-categories-categorization (selection at signup: 01) |
| categorizzazione-automatica | Liquidità | Categorizzazione automatica | new | — | 05-categories-categorization |
| quattro-gruppi-di-spesa | Liquidità | Quattro gruppi di spesa | live | — | 05-categories-categorization |
| trasferimenti-tra-conti | Liquidità | Trasferimenti tra i tuoi conti | new | — | 03-transactions (category: 05) |
| dividi-e-escludi | Liquidità | Dividi e escludi | live | — | 03-transactions |
| budget-per-categoria | Liquidità | Budget per categoria | live | — | 03-transactions |
| analisi-e-cash-flow | Liquidità | Analisi e cash flow | live | /liquidita | 03-transactions |
| abbonamenti | Liquidità | Abbonamenti | new | — | 06-subscriptions |
| etf-azioni-btp-fondi-e-crypto | Investimenti | ETF, azioni, BTP, fondi e crypto | live | /investimenti | 07-investments |
| operazioni-e-import-csv | Investimenti | Operazioni e import CSV | live | — | 07-investments |
| rendimenti-veri | Investimenti | Rendimenti veri | live | — | 07-investments |
| confronto-con-un-indice | Investimenti | Confronto con un indice | live | — | 07-investments |
| rischio | Investimenti | Rischio | live | — | 07-investments |
| diversificazione | Investimenti | Diversificazione | live | — | 07-investments |
| allocazione-obiettivo | Investimenti | Allocazione obiettivo | live | — | 07-investments |
| proventi | Investimenti | Dividendi | live | — | 07-investments (DE: 13-planning-de) |
| pianificazione-germania | Investimenti | Pianificazione finanziaria Germania | new | — | 13-planning-de |
| tasse-italiane | Investimenti | Tasse italiane | live | — | 07-investments |
| simulatore-prima-di-vendere | Investimenti | Simulatore «Prima di vendere» | live | — | 07-investments |
| titoli-watchlist-e-avvisi | Investimenti | Titoli, watchlist e avvisi | live | — | 08-securities-watchlist |
| indicatori-fondamentali | Investimenti | Indicatori fondamentali | new | — | 08-securities-watchlist |
| finanziamenti-nuovi-o-in-corso | Debiti | Finanziamenti nuovi o in corso | live | /debiti | 10-debts |
| calcolatore-della-variabile-mancante | Debiti | Calcolatore della variabile mancante | live | — | 10-debts |
| estinzione-anticipata | Debiti | Estinzione anticipata | live | — | 10-debts |
| simulatore-dei-debiti | Debiti | Simulatore dei debiti | new | — | 10-debts |
| patrimonio-netto-nel-tempo | Patrimonio | Patrimonio netto nel tempo | live | /panoramica | 02-overview |
| pensione | Patrimonio | Pensione | new | /pensione | 09-pension |
| analitiche | Patrimonio | Analitiche | new | /analitiche | 11-analytics |
| obiettivi-di-risparmio | Patrimonio | Obiettivi di risparmio | new | — | 12-goals |
| tuoi-dati-tuo-controllo | Account | Tuoi dati, tuo controllo | live | — | 15-settings |
| email-riepilogo-e-avvisi | Account | Email di riepilogo e avvisi | new | — | 15-settings (choice at onboarding: 01) |
| piu-lingue-e-valute | Account | Più lingue e valute | new | — | 15-settings (gating model: 00) |
| notifiche-push | Account | Notifiche push | soon | — | not implemented (see Open questions) |

## Requirements

#### Route gate & home

- **SHELL-001** The app shall require an authenticated session for every screen except login and public pages; an unauthenticated request shall show the login screen and, after login, return to the originally requested screen if it is a safe in-app path. _API: any → `401`_
- **SHELL-002** The app shall, for a deactivated account (`deletionScheduledAt` set), show only the "account deactivated" screen, and the backend shall answer `403` to every API except `POST /api/user/reactivate`.
- **SHELL-003** The app shall, when the user has completed onboarding but has not accepted the current legal version, show only the legal-acceptance screen; only `/api/user/legal-acceptance`, `/api/user/export`, `/api/user/account` are usable meanwhile.
- **SHELL-004** The app shall route a user who has not completed onboarding to onboarding for every screen, and never show onboarding to a user who completed it.
- **SHELL-005** The app shall open on the user's chosen home page, one of Panoramica (default), Liquidità, Conti, Analisi dei movimenti, Investimenti; legacy values `/conti`, `/movimenti`, `/movimenti/analisi` shall map to `/liquidita/conti`, `/liquidita`, `/liquidita/analisi`; any other value shall fall back to Panoramica.

#### Country gating

- **SHELL-006** The app shall resolve the product country as DE only when stored as `DE`, otherwise IT, and the language as the stored one if supported for that country, else `it` (IT) / `en` (DE).
- **SHELL-007** The app shall apply one route policy `isCountryPathAvailable(country, path)` to navigation entries, «Novità» entries, deep links and API calls; for IT every path is available.
- **SHELL-008** For DE, the app shall hide Pensione and Analitiche (and every subpath, incl. `/analitiche/obiettivi`) from all navigation surfaces.
- **SHELL-009** For DE, `/investimenti/tasse` and `/investimenti/proventi` shall open the dedicated German planning screen (13-planning-de) instead of the Italian one.
- **SHELL-010** A deep link to an unavailable path shall show the "country unavailable" screen with title `Questa funzione non è ancora disponibile per la Germania.`, the explanatory body and a link to Panoramica.
- **SHELL-011** The backend shall answer `403 {code:"country_feature_unavailable"}` for DE on `/api/pension*`, `/api/analytics*`, `/api/goals*`, `/api/sidebar/fire`, `/api/investments/tax-carryforwards*`; the app shall treat this code as "feature unavailable" (show the country-unavailable screen, not a generic error).

#### Navigation

- **SHELL-012** The app shall show primary sections in order Panoramica, Liquidità, Investimenti, Pensione, Debiti, Analitiche, filtered by country.
- **SHELL-013** On phone, the app shall show by default a bottom bar with Panoramica, Liquidità, Investimenti, Debiti (country-filtered) and a final `Altro` tab.
- **SHELL-014** The `Altro` tab shall appear selected whenever the current screen is not under one of the bottom-bar sections.
- **SHELL-015** The active-section indicator shall move to the tapped section immediately, before the destination finishes loading.
- ~~**SHELL-016**~~ Removed by web #451: the Liquidità entry shows no «Da categorizzare» badge.
- ~~**SHELL-017**~~ Removed with SHELL-016 (the attention count is read by Movimenti and Categorizza only, 03/05).
- **SHELL-018** The `Altro` screen shall list, in order: account row (→ Impostazioni), `Altre sezioni` (country-available sections not in the bottom bar, with hints), `Assistenza` (Impostazioni, Aiuto e segnalazioni), the `Nascondi gli importi` switch, the collapsible `Il tuo quadro` summary, `Esci`, legal links Privacy/Termini/Cookie and the version label.
- **SHELL-019** The `Altre sezioni` group shall be omitted when it would be empty.
- **SHELL-020** The `Il tuo quadro` summary in `Altro` shall be collapsed by default and shall not request any data until expanded.
- **SHELL-021** Closing `Altro` (close button, system Back/swipe-back) shall return to the previous screen without leaving the app; navigating from `Altro` shall replace it in the back stack.
- **SHELL-022** A user preference (per device, default ON) shall switch phone navigation between bottom bar and a hamburger-opened drawer containing the full sidebar (see 15-settings).
- **SHELL-023** The top bar on phone shall show the brand in the centre and a «Scrivici» button that opens the quick-report sheet with source `pulsante` (16-help-support).
- **SHELL-024** The user menu shall offer `Impostazioni`, `Aiuto e segnalazioni` (passing the current screen path as context `da`), `Nascondi gli importi`, `Tema` (Chiaro/Scuro/Sistema) and `Esci`.
- **SHELL-025** `Esci` shall sign out, clear all in-memory/cached user data and return to the login screen, without a confirmation step.
- **SHELL-026** The app shall show the build version as `v{version} · {7-char commit}` with details `Versione`, `Commit`, `Build {date time}` available on request (native: app version + build number).
- **SHELL-027** Switching top-level section shall play a short fade/slide-in of the content (never on first open, not between tabs of the same section, disabled with reduced motion).

#### Sidebar insights (summary modules)

- **SHELL-028** The app shall offer five summary modules — Patrimonio netto (`Oggi`), Prossime scadenze, Obiettivo FIRE, Portafoglio, Watchlist — each enabled per device (default ON); disabled modules shall make no network request.
- **SHELL-029** Modules shall render in order Oggi, Prossime scadenze, Obiettivo FIRE, Portafoglio, Watchlist; each collapsible with a one-line summary when collapsed; Watchlist collapsed by default.
- **SHELL-030** Oggi shall show the net-worth total and its change over ~30 days (`{±amount} in 30 giorni`, omitted if unknown), excluding pension when the user excluded pension from net worth. _API: `GET /api/sidebar/summary`_
- **SHELL-031** Portafoglio shall show total value, day change %, total gain and gain %, the top 3 holdings (label, name, value, day change, sparkline, alert marker) and `Mostra tutti ({n}) →` when there are more. _API: `GET /api/sidebar/summary`_
- **SHELL-032** Watchlist shall show `{n} titolo|titoli`, a triggered-alerts badge, up to 4 instruments with last close (2 decimals, instrument currency) and `Mostra tutti ({n}) →` when there are more.
- **SHELL-033** Tapping a holding or watchlist row shall open the security page `/investimenti/titoli/{instrumentId}` (08-securities-watchlist).
- **SHELL-034** Prossime scadenze shall list up to 4 items sorted by date: debt instalments (name, amount → debt detail) and bank renewals `Rinnova {bank}` (→ accounts with the renewal flow auto-opened). _API: `GET /api/sidebar/deadlines`_
- **SHELL-035** A bank renewal item shall appear when consent expires within 7 days (dated at expiry) or is expired/errored (dated today and marked overdue); overdue items shall be highlighted and counted in a `{n} scaduta|scadute` badge.
- **SHELL-036** Obiettivo FIRE (only when `features.retirement`, i.e. IT) shall show progress to the FIRE number (capped 100%), remaining amount and years (`tra N anni`, `tra 1 anno`, `tra meno di un anno`) or `Obiettivo raggiunto`; without annual retirement spend it shall show the invitation copy; tap opens Analitiche. _API: `GET /api/sidebar/fire`_
- **SHELL-037** Summary, deadlines and FIRE data shall be considered fresh for 5, 10 and 60 minutes respectively, never retried, and on error the module shall render nothing.
- **SHELL-038** Each module shall show a skeleton while loading and nothing when it has no content.

#### Background jobs (sync island)

- **SHELL-039** The app shall show a persistent floating indicator, above bottom navigation, with one entry per non-dismissed bank-sync job and per personal-import job (14-imports). _API: `GET /api/sync-jobs`_
- **SHELL-040** The app shall poll sync jobs every 1 s only while at least one job is running.
- **SHELL-041** Each job entry shall show a progress ring while running, a success or failure icon when finished, and the title `Sincronizzazione in corso · {n} conto|conti` / `Sincronizzazione completata` / `Sincronizzazione non riuscita` / `Sincronizzazione interrotta`.
- **SHELL-042** Tapping a job entry shall expand/collapse per-account details; a job that finishes shall auto-expand.
- **SHELL-043** Each account row shall show the phase text and progress (`In attesa`, `Aggiorno il saldo…`, `Scarico i movimenti dalla banca…`, `Importati {p} di {t} movimenti`, the sync summary, or the specific error message for limited/expired/already-running/error/interrupted).
- **SHELL-044** A job with no heartbeat for 60 s shall be shown as interrupted.
- **SHELL-045** Finished jobs shall be dismissable (`Chiudi riepilogo`); running jobs shall not. _API: `POST /api/sync-jobs/{id}/dismiss`_
- **SHELL-046** A finished job with errors shall offer `Segnala questo problema` with area `sync_banca`; a finished job that imported uncategorized movements shall offer `Categorizza` → Categorizza screen.
- **SHELL-047** When a job finishes the app shall refresh accounts, bank-connection status, net-worth snapshots, attention counts and categorization-dependent data.

#### Banners, Novità, privacy, theme

- **SHELL-048** While demo data is active, every app screen shall show the banner `Dati d'esempio.` with `Azzera e inizia`, which clears demo data (button reads `Azzero…` while pending; error shown inline). _API: `GET /api/start`, `DELETE /api/start/demo`_
- **SHELL-049** (changed by web #444) The app shall show at most one «Novità» entry: the most recent not dismissed on this device, not older than 45 days, released after the user's sign-up, and available in the user's country. (Placement: 02-overview.) _API: `GET /api/whats-new`_
- **SHELL-050** Opening a «Novità» entry shall show title, summary, `Non mostrare più` (dismisses permanently on this device) and the CTA navigating to the entry's destination.
- **SHELL-051** `Nascondi gli importi` shall be a server-persisted preference applied from the first rendered frame; toggling it shall update optimistically and revert on save failure. _API: `PATCH /api/user/settings {hideAmounts}`_
- **SHELL-052** (changed by web #448) While amounts are hidden, every amount of the user's money shall render as `••••` — including quantities, prices and fees of investment operations and positions, amounts in import previews and hand-composed sentences — and every chart of the user's money shall be visually obscured, without refetching data.
- **SHELL-053** The app shall support themes Chiaro, Scuro and Sistema (default), stored per device.

#### «Dall'ultima visita»
- **SHELL-058** (web #457) The app shall send a visit heartbeat on open, on return to the foreground and every 5 minutes in the foreground, re-reading the summary when it starts a new visit. _API: `POST /api/visits`_
- **SHELL-059** (web #457) When the summary is not null, the app shall show one toast (10 s) with the `Mentre eri via: …` and `Da sistemare: …` lines and the action of the first waiting item (or `Vedi`), then mark it shown. _API: `GET /api/welcome`, `PATCH /api/welcome`_
- **SHELL-060** (web #444) When a «Primi passi» step becomes done while the user is outside Panoramica, the app shall show a toast with the step's done text (e.g. `Conto aggiunto`), `Prossimo passo: {0}` and the next step's action; when it was the last step, `Primi passi completati` with `Vai alla Panoramica`. Each step is announced once per device; nothing is announced the first time the device sees the steps, while sample data is active, or after the checklist was hidden. _API: `GET /api/start`_

#### Loading & errors

- **SHELL-054** Each screen shall show a skeleton placeholder while its data loads, keeping navigation visible.
- **SHELL-055** A screen that fails to render shall show `Questa pagina non si è caricata` with explanatory body, error code if available, `Riprova` and `Segnala questo problema` (area `caricamento`), keeping the navigation shell visible. _API: `POST /api/client-errors`_
- **SHELL-056** The app shall treat a `401` from any API as session expiry and return to login; a `403` without `country_feature_unavailable` during legal/deactivation gating shall route to the corresponding gate screen.
- **SHELL-057** The developer style guide (/style-guide) shall not be included in the mobile apps.

## Mobile adaptation notes

- **Proposal — needs product sign-off:** Use the bottom tab bar (Panoramica, Liquidità, Investimenti, Debiti, Altro) as the only phone navigation on both platforms; drop the hamburger drawer variant and its setting (SHELL-022) on native, or keep it hidden behind the same Impostazioni toggle only if parity with web is mandatory.
- **Proposal — needs product sign-off:** Implement «Altro» as the root of a fifth tab's navigation stack (iOS NavigationStack / Compose NavHost), not a modal; Back from a pushed section returns to «Altro».
- **Proposal — needs product sign-off:** Desktop-only features (collapsed/expanded sidebar, hover tooltips on version and holdings, tablet icon-only rail) are not replicated on phones; on tablets use iOS sidebar / Compose NavigationRail with the same items and badges.
- **Proposal — needs product sign-off:** Replace the per-device localStorage preferences (sidebar modules, bottom bar, theme, collapsed sidebar, «Novità» dismissals) with platform key-value storage (UserDefaults / DataStore) using the same keys and defaults; do not sync them to the server (same as web).
- **Proposal — needs product sign-off:** Sync island: render as a floating capsule above the tab bar with the same states; replace 1 s HTTP polling with polling only while app is foregrounded and a job is running; on finish fire a local haptic. Don't use iOS Live Activities / Android foreground notifications in v1.
- **Proposal — needs product sign-off:** Session handling: web uses cookie-based Better Auth session checked by the proxy; native apps should use a bearer/session token with the same gate order (SHELL-001…004) evaluated from a `GET` session/me endpoint at launch and on every `401`/`403`.
- **Proposal — needs product sign-off:** "Sign out" must also wipe the TanStack-equivalent caches, any persisted query cache and keychain/keystore tokens.
- **Proposal — needs product sign-off:** Version label shows `v{marketing version} ({build number})` in «Altro» and Impostazioni; the web commit hash is not applicable.
- **Proposal — needs product sign-off:** Legal links open in an in-app browser (SFSafariViewController / Custom Tabs).
- **Proposal — needs product sign-off:** Privacy mask on native also hides amounts in the app switcher snapshot (blur overlay when backgrounded) when enabled.

## Open questions

1. Country gating is enforced by a web proxy; native apps call APIs directly — all blocked APIs return `403 country_feature_unavailable` (good), but page-level redirects must be replicated client-side from `isCountryPathAvailable`; should the server expose the policy (e.g. a `GET /api/me/capabilities`) so mobile doesn't hard-code it?
2. There is no "me/session bootstrap" API documented for gate state (`onboardingCompleted`, `legalAcceptedVersion`, `deletionScheduledAt`, `homePage`, `hideAmounts`, `productCountry`, `language`); web reads them from the server session. Mobile needs one endpoint returning all of these.
3. Catalog lists `notifiche-push` as `soon`: no backend exists for push tokens; is push in scope for mobile v1?
4. Sidebar summary/deadlines/FIRE fail silently and the FIRE query is disabled client-side for DE; on mobile ensure the module is hidden for DE rather than surfacing a 403.
5. «Novità» entries are hard-coded in the web bundle; mobile would need either a duplicated list or a server endpoint — and the dismissed state is per device (not synced).
6. Sidebar module and bottom-bar preferences are per device (localStorage); a user with web + mobile will see different module sets — acceptable?
7. Country-unavailable copy only mentions Germany; fine today (only DE has restrictions) but will need generalising if more countries are added.
8. The sync island relies on 1 s polling of a Redis-backed store with 24 h TTL; background/terminated mobile apps will miss "finished" transitions (handled by "newly finished job" detection on next fetch — confirm acceptable).
9. Badge semantics: only `uncategorizedCount` is shown even though attention also returns `newCount`/`totalCount`; mobile should not use `totalCount` for the badge.
10. Umami analytics events (e.g. `bottom_nav_clicked`, `more_menu_clicked`, `theme_changed`, `amounts_hidden_toggled`, `sidebar_module_clicked`, `whats_new_*`) — should mobile emit the same event names for parity?
