# Pension (Pensione — Italian supplementary pension funds & TFR)
Status: draft · Source: `app/(app)/pensione/layout.tsx`, `app/(app)/pensione/{page,andamento,scenari,proiezione,dati}/page.tsx`, `components/domain/pension/**`, `lib/pension/**`, `lib/validation/pension.ts`, `lib/queries/pension.ts`, `app/api/pension/**`

## Purpose
Let Italian users track one or more supplementary pension funds (fondo negoziale, PIP, fondo aperto) by periodically entering two numbers from the fund's client area — net contributions and market value ("fotografie"/snapshots). From those the app computes time-weighted annual return, gain on contributions, what the user would net if withdrawing today (with Italian exit-tax rules), comparison with leaving the TFR in the company, a 25-year projection, and a year-by-year breakdown. Pension funds are added to net worth as class "Previdenza" (see 02-overview).

**Country gating:** IT only. For product country DE, the proxy redirects `/pensione` (and subpaths) to `/country-unavailable` because switch `pension: false` in `planning-availability.ts`; the layout's German `PlanningScreen` branch (section `pension`) is unreachable until the switch changes (see 13-planning-de); all `/api/pension/**` endpoints return `403 {code:"country_feature_unavailable"}` for DE, and the nav entry is hidden.

## Entry points & navigation
- Main navigation item `Pensione` (`/pensione`), IT only.
- Section heading `Pensione`, subtitle `Il tuo fondo pensione: quanto rende, quanto ti resterebbe e dove arriverà`.
- Five tabs (shown only once a fund exists); on phone the title opens a sheet listing views with descriptions:
  | Tab | Route | Phone description |
  |---|---|---|
  | `Panoramica` | `/pensione` | `Il fondo in sintesi` |
  | `Andamento` | `/pensione/andamento` | `Contributi e valore nel tempo` |
  | `Scenari` | `/pensione/scenari` | `Cosa cambia con ipotesi diverse` |
  | `Proiezione` | `/pensione/proiezione` | `Quanto potresti avere alla pensione` |
  | `I tuoi dati` | `/pensione/dati` | `Fondo, fotografie e importazioni` |
- Fund selector (segmented control, label `Fondo`) above the tabs when the user has >1 fund; selection is in-memory (not persisted; defaults to first fund).
- Footer disclaimer on every tab: `Stime a scopo informativo, non consulenza finanziaria o fiscale: regole e aliquote vanno verificate con un professionista.`
- One data request (`GET /api/pension`) feeds all tabs.

## Screens

> **Phone layout (Phase 4R, web 0.81.0).** With a fund the heading is the current tab («Panoramica ⌄», views sheet; no
> subtitle, no tab strip), fund chips under it when there are several; without a fund, title «Pensione» + subtitle.
> Section titles without icons, no rules between the «Dove stai andando» insights, charts inside the page margins, the
> exit-tax bar flat (red share then green share at 70 %, no gradient).

### 0. Section states
- Loading: two skeleton blocks.
- Error: `Impossibile caricare i dati della pensione.` + retry.
- No fund (empty state): card `Aggiungi il tuo fondo pensione` — `Ti basta inserire, ogni tanto, i due numeri che vedi nell'area clienti del fondo: contributi netti e controvalore. Da lì calcoliamo rendimento, quanto ti resterebbe prelevando oggi, il confronto col TFR in azienda e dove arriverai.` with the Add-fund form inline.
- Fund without snapshots (Panoramica/Andamento/Scenari/Proiezione): card `Mancano i valori del fondo` — `Inserisci contributi netti e controvalore dalla scheda I tuoi dati: al resto pensiamo noi.` (link to `/pensione/dati`).

### 1. Add fund form (2 steps, progress `Passi del nuovo fondo`)
- Step 1 `Come si chiama il fondo?` — `Nome del fondo` (placeholder `es. Piano pensione Moneyfarm`, required, max 80).
- Step 2 `Quando hai aderito?` — `Conta la prima adesione in assoluto a una forma pensionistica, anche in un'altra azienda: decide l'aliquota in uscita.` — `Data di prima adesione` (date, max = today, required).
- Buttons `Continua` / `Indietro` / `Aggiungi il fondo` (`Salvataggio…`). Errors shown with report affordance. Max 10 funds per user.

### 2. Panoramica (`/pensione`)
- **Hero**: `{nome fondo} · aggiornato al {data lunga}`; market value (big); `+/−{importo} di guadagno|di perdita sui contributi versati`; value-vs-contributions line chart (full width; from the 2nd snapshot, otherwise `Il grafico compare dalla seconda fotografia del fondo.`); measures `Versato`, `Sui contributi` (gain %), `Rendimento annuo` (+ ` (stima)` when early history is missing) with info hint `Rendimento annuo che tiene conto di quando hai versato: un euro versato il mese scorso non ha avuto il tempo di rendere. Se manca lo storico dei primi anni è una stima.`
- **`Dove stai andando`**: three tappable insights, each with `Vedi i dettagli`:
  - `Fondo o TFR in azienda` — fund annual return `contro` company TFR rate (green if fund ≥ TFR) + caption (`Il fondo rende più della rivalutazione del TFR lasciato in azienda.` / `Il TFR in azienda si rivaluta più di quanto ha reso il fondo finora.`) → Scenari.
  - `Se prelevassi oggi` — net range low–high at retirement reason, caption `Netto stimato alla pensione, tasse comprese.` → Scenari.
  - `Tra 25 anni` — base-scenario projection (2% real, current quarterly contribution), caption `Scenario base, in euro di oggi: già al netto dell'inflazione.` → Proiezione.

### 3. Andamento (`/pensione/andamento`)
- `Andamento del fondo` — `I contributi versati e il controvalore del fondo, fotografia dopo fotografia.` Line chart: `Controvalore`, `Contributi netti`, tooltip per snapshot.
- `Anno per anno` — stacked bar per calendar year: `Versato`, `Rendimento` (positive) / `Perdita` (negative, below zero); current year marked `*` (`* anno in corso, non annualizzato.`); list of yearly % return (`n.d.` when not computable); `Anno migliore` / `Anno peggiore` (only with >1 year).

### 4. Scenari (`/pensione/scenari`)
- **`Se prelevassi oggi`** — `Quanto ti resterebbe al netto delle tasse, in tre ipotesi. È una stima, non consulenza fiscale.` Three rows: `Alla pensione` (`Fino al 50-60% in capitale, il resto in rendita`), `Spese sanitarie straordinarie` (`Anticipazione per terapie e interventi`), `Altri motivi` (`Riscatto fuori dai casi previsti dalla legge`); each shows net low–high, a bar split into `Netto sicuro` / `Netto possibile` / `Tasse`, the applicable rate, and when simulating the delta `+/−{importo} rispetto a oggi`. Hint explains the range (tax on contributions only vs on whole value).
- **`Fondo o TFR in azienda?`** — `Gli stessi versamenti, in due posti diversi.` Two bars `Nel fondo` vs `In azienda, rivalutato` with annual rates; conclusion sentence (`Finora il fondo ha reso … in più…` or `Finora il TFR in azienda avrebbe reso … in più…`) mentioning revaluation 1.5% + 75% of inflation and assumed inflation 2%.
- **`Quando l'aliquota scende`** (only if adhesion date set) — `Sui contributi dal 2007 l'imposta in uscita è il 15%, ridotta di 0,30 punti per ogni anno oltre il quindicesimo di partecipazione, fino al 9%. Conta dalla prima adesione.` Timeline with marks `Adesione` (year), `Inizia a scendere` (year 15), `Minimo` (year 35), a "today" tick, and a draggable chip (also keyboard arrows/PageUp/PageDown) to simulate years of participation. While simulated: `Simulazione: dopo {n} anni di adesione (nel {anno}) l'aliquota sarebbe {x}%, e alla pensione ti resterebbero almeno {importo} (+/−… rispetto a oggi).` and button `Torna a oggi`; the withdrawal card above re-computes and is labelled `Simulazione dell'aliquota in corso…`. Idle hint: `Trascina l'aliquota lungo la linea (o usa le frecce) per vedere cosa cambierebbe nelle stime. Resta solo su questa pagina: non viene salvato nulla.`

### 5. Proiezione (`/pensione/proiezione`)
- `Proiezione a pensione` — `In euro di oggi, quindi già al netto dell'inflazione. Una stima, non una promessa.`
- Three scenario figures `Prudente` (0% real), `Base` (2%), `Ottimistico` (4%): final value and `tra {n} anni, di cui {importo} di rendimento`.
- Chart: base line, dashed prudent/optimistic with band; x axis years (`{n}a`), tooltip `Tra {n} anni`.
- Sliders: `Anni alla pensione` 1–45 (default 25); `Versamento ogni trimestre` 0–3000 step 20 (default = recent quarterly contribution estimated from snapshots, rounded to 20).
- Sentence `Verserai ancora {importo}: il resto del valore finale è rendimento. …`

### 6. I tuoi dati (`/pensione/dati`)
- **`Aggiorna i valori del fondo`** — description explains that the contribution is derived from the difference and that a snapshot with the same date replaces the existing one. Form: `Data` (default today, max today), `Contributi netti` (placeholder `es. 10.880`), `Controvalore` (placeholder `es. 11.420`), both ≥0 numbers (comma decimal accepted); `Aggiungi` (`Salvo…`). Clears amounts on success; error inline.
- Link `Hai già uno storico? Importa da file CSV o Excel` → Import dialog.
- Snapshot list (newest first, 6 visible, `Mostra tutte ({n})` / `Mostra meno`): `Data`, `Versamento` (delta of contributions vs previous snapshot, `—` if none/≤0), `Contributi netti`, `Controvalore`, delete icon (`Elimina la fotografia del {data}`) — **deletes immediately, no confirmation**.
- **`Dati del fondo`** — `Nome del fondo` (max 80), `Prima adesione a una forma pensionistica` (date ≤ today; helper text); `Salva le modifiche` enabled only when changed and valid; link `Elimina questo fondo` → confirm `Eliminare questo fondo?` / `Verranno cancellate anche tutte le sue fotografie e sparirà dal patrimonio netto. L'operazione non si può annullare.` (`Annulla` / `Elimina`); after deletion the next fund is selected (or empty state).
- **`Hai un altro fondo?`** (when <10 funds) — `Puoi tracciarne più di uno (per esempio un fondo negoziale e un PIP): il patrimonio netto li somma.` + Add-fund form; the new fund becomes selected.

### 7. Import snapshots dialog (`Importa le fotografie` — `Da un file CSV o Excel, nel fondo «{nome}».`)
Three steps `File` → `Colonne` → `Riepilogo`.
- **File**: `Scegli il file` — one row per snapshot with date, net contributions, value; the file is parsed on the device and only confirmed rows are sent. Accepts `.csv`, `.txt`, `.xlsx` (picker or drag&drop). `Scarica il modello` downloads a template. Alternative `Oppure incolla le righe` (`Anche copiate da Excel`, placeholder `Data;Contributi netti;Controvalore\n31/03/2026;10880,00;11250,40`) + `Leggi`.
- **Colonne**: file name (or `Testo incollato`); one select per field (date, net contributions, value; `Nessuna colonna` option, example value shown); `Formato delle date` (day/month order); `Separatore dei decimali` `Punto (1,234.56)` | `Virgola (1.234,56)`. Preview: `{ok} fotografie lette su {n} righe, {k} scartate.` with a table (`Riga`, `Data`, `Contributi netti`, `Controvalore`) and per-row problems (`Riga {n}: {motivo}`). Missing mapping: `Indica quale colonna contiene: …`. `Avanti` disabled while fields are missing or no valid rows.
- **Riepilogo**: `Cosa cambia` counts `da aggiungere`, `da aggiornare`, `già presenti`; note that same-date snapshots replace values and identical ones are skipped (re-importing the same file creates no duplicates); table `Verranno aggiornate` (with `Controvalore prima`); blocking errors `Finché ci sono errori non si importa nulla` + `Correggi il file e ricaricalo.` Primary button `Importa {n} fotografie` / `Niente di nuovo da importare` / `Importo…`. Done state: `{a} aggiunte, {b} aggiornate` or `Niente da cambiare`, `{n} erano già presenti e sono state saltate.`, button `Chiudi`. Max 1000 rows.

## Requirements

#### Access & data
- **PEN-001** The app shall show the Pension section only when the product country is IT and send DE users to the country-unavailable screen. _API: `GET /api/pension` (403 for DE)_
- **PEN-002** The app shall load all funds and snapshots in one request and derive every tab from it. _API: `GET /api/pension`_
- **PEN-003** The app shall show a fund selector when the user has more than one fund and recompute all tabs for the selected fund.
- **PEN-004** The app shall show the informational disclaimer at the bottom of every Pension tab.

#### Funds
- **PEN-005** The app shall show an empty state with the add-fund form when the user has no fund.
- **PEN-006** The app shall create a fund in two steps requiring a name (1–80 chars) and a first-adhesion date not later than today. _API: `POST /api/pension/funds`_
- **PEN-007** The app shall limit the user to 10 funds and hide the add-another-fund section at the limit.
- **PEN-008** The app shall let the user edit a fund's name and first-adhesion date, enabling save only when values changed and are valid. _API: `PATCH /api/pension/funds/{id}`_
- **PEN-009** The app shall delete a fund with all its snapshots only after an explicit irreversible-action confirmation, then select another fund. _API: `DELETE /api/pension/funds/{id}`_

#### Snapshots
- **PEN-010** The app shall let the user add a snapshot with date (≤ today), net contributions (≥0) and market value (≥0), replacing an existing snapshot with the same date. _API: `POST /api/pension/funds/{id}/snapshots`_
- **PEN-011** The app shall list snapshots newest first with the derived contribution delta versus the previous snapshot, showing 6 by default and allowing expansion.
- **PEN-012** The app shall delete a single snapshot. _API: `DELETE /api/pension/funds/{id}/snapshots/{snapshotId}`_
- **PEN-013** The app shall show a "missing values" prompt linking to `I tuoi dati` on analysis tabs when the selected fund has no snapshots.

#### Import
- **PEN-014** The app shall import snapshots from a CSV/TXT/XLSX file or pasted text, parsing it on the device.
- **PEN-015** The app shall auto-detect and let the user correct the column mapping (date, net contributions, value), date order and decimal separator, with a live preview of valid and discarded rows.
- **PEN-016** The app shall summarise new, updated and unchanged snapshots before importing and block the import while any row has errors.
- **PEN-017** The app shall send only the confirmed rows (max 1000) and report how many were added, updated and skipped. _API: `POST /api/pension/funds/{id}/snapshots/import`_
- **PEN-018** The app shall provide a downloadable template for the import file. _Mobile: shared through the system share sheet (save to Files / Drive), UTF-8 with BOM like the web download._

#### Overview & trend
- **PEN-019** The app shall show the fund's current value, last update date, gain/loss on net contributions (amount and %), net contributions and time-weighted annual return flagged `(stima)` when history is incomplete.
- **PEN-020** The app shall chart market value and net contributions over snapshots from the second snapshot onward.
- **PEN-021** The app shall show three insights (fund vs company TFR return, net range if withdrawing today, 25-year base projection) each navigating to its detailed tab.
- **PEN-022** The app shall show, per calendar year, contributions and gain/loss as stacked bars, the yearly % return (current year marked partial) and the best and worst year.

#### Scenarios
- **PEN-023** The app shall estimate the net amount and exit-tax rate for withdrawal at retirement, for extraordinary medical expenses and for other reasons, each as a low–high range.
- **PEN-024** The app shall compare the fund's value with the same contributions left as company TFR revalued at 1.5% + 75% of an assumed 2% inflation, showing both values, rates and the difference.
- **PEN-025** The app shall show the exit-tax timeline from first adhesion (15% flat until year 15, −0.30 pt/year down to 9% at year 35) and let the user drag a marker to simulate years of participation, updating the withdrawal estimates and showing the difference versus today.
- **PEN-026** The app shall offer `Torna a oggi` to reset the tax simulation, and never persist the simulation.

#### Projection
- **PEN-027** The app shall project the fund in today's euros under prudent (0%), base (2%) and optimistic (4%) real returns, with years to retirement (1–45, default 25) and quarterly contribution (0–3000, step 20, default from recent snapshots) adjustable by sliders.
- **PEN-028** The app shall show for each scenario the final value and the portion that is return, and the total still to be contributed.

## Mobile adaptation notes
- **Proposal — needs product sign-off:** Tabs use the shared section pattern: the section title opens a bottom sheet listing the 5 views with their descriptions (as web phone); the fund selector becomes a horizontally scrollable chip row under the title.
- **Proposal — needs product sign-off:** Chart tooltips (hover) become press-and-hold scrubbing: a vertical cursor follows the finger and the values appear in a fixed header above the chart; release restores the default header.
- **Proposal — needs product sign-off:** Info hints (`InfoHint`) open a small bottom sheet on tap.
- **Proposal — needs product sign-off:** The draggable exit-tax chip becomes a native slider (0–35+ years, step 1) with accessibility increment/decrement actions replacing keyboard arrows; haptic tick at milestones (15, 35).
- **Proposal — needs product sign-off:** Snapshot list rows become cards (date + value prominent, contributions and delta secondary); deletion by swipe with a confirmation-free undo snackbar (5 s).
- **Proposal — needs product sign-off:** Import uses the system document picker (CSV/TXT/XLSX from Files/Drive) or paste; parsing runs on the device as on web (XLSX parsing library needed on both platforms). Drag&drop is dropped. `Scarica il modello` opens the system share sheet with the template file.
- **Proposal — needs product sign-off:** Mapping step uses one picker per field and shows preview rows as cards rather than a table.

## Open questions
1. Fund selection is not persisted on web (resets to first fund on reload); should mobile remember the last selected fund per device?
2. Snapshot deletion has no confirmation on web; accept undo snackbar on mobile?
3. Snapshot amount parsing on web replaces only the first `,` and ignores thousand separators (`10.880` is read as 10.88!). The placeholder `es. 10.880` suggests thousands; this is a probable bug — mobile needs locale-aware parsing; confirm intended behaviour.
4. All calculations (time-weighted return, exit tax, TFR comparison, projection, yearly breakdown) run client-side in `lib/calc` / `lib/pension`; mobile needs either identical ports or a new server endpoint returning computed figures.
5. Assumed inflation (2%) and projection rates are constants not editable by the user (CLAUDE.md lists "inflazione modificabile" as deferred) — confirm.
6. CLAUDE.md lists Pensione as "implementata sul branch … senza PR"; the code is in this checkout and exposed for IT — confirm it is released in production before scoping mobile v1.
7. Many sentences are concatenated from fragments (`tra` + n + `anni, di cui` …) and several labels (`Adesione`, `Minimo`, `Nuova/Aggiorna/Già presente`) bypass `t()` — need proper localisation keys.
8. Tax rules are flagged "da validare" in CLAUDE.md; legal/disclaimer copy must be reviewed before mobile release.
