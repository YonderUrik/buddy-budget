# Imports (personal CSV / Excel)

Status: draft · Source: app/(app)/importazioni/page.tsx, components/domain/personal-import/*, lib/personal-import/*, lib/imports/*, lib/queries/personal-imports.ts, app/api/personal-imports/route.ts, app/api/personal-imports/[id]/route.ts, app/(app)/layout.tsx (island), docs/decisioni/2026-10-11-import-file-ricevuto.md, 2026-10-11-importazioni-dettaglio-e-lista.md, 2026-10-15-import-csv-righe-da-controllare.md, 2026-10-15-metadati-formati-fallback-import.md, 2026-10-16-correzione-import-ai.md

## Purpose

Import an account statement or broker report from a bank/broker that BuddyBudget does not support natively. The user uploads a CSV or Excel (.xlsx) file; an AI model (via OpenRouter, zero data retention) derives a private, reusable **format** (parser) for that source; the job runs in the background; recognised rows become cash movements (Liquidità) and/or investment operations (Investimenti). Rows the AI could not understand are shown for review («Righe da controllare»), and an already imported result can be corrected with a new AI analysis compared side-by-side before replacing.

Scope boundary: native broker imports (IBKR, DEGIRO, Fineco, Trade Republic, Bitpanda…) are in **07-investments**. They link here when the native parser fails and an **AI fallback** job is created (`brokerFallback`), and «Gestisci importazioni» in Investimenti lists personal-import jobs alongside broker imports and owns their **deletion** (cross-reference 07-investments). `/importazioni` itself lists only personal-import jobs (including AI-fallback jobs started from the broker wizard).

## Entry points & navigation

- Route `/importazioni` (optionally `?job={id}` to open a job's report). Header: BackLink `‹ Liquidità` → `/liquidita`, icon + title `Importa da CSV o Excel`, intro `Per le banche e i broker che BuddyBudget non supporta ancora. L'AI riconosce le colonne e il formato resta tuo: lo riusi ai file successivi senza altre analisi.`
- Reached from: Liquidità header "Importa" action and link `Importa da CSV o Excel →`; empty states in Movimenti/Conti (`Importa un file`); «Nuovo conto» dialog choice (import path); «Primi passi» checklist step; Investimenti import wizard (`Crea il tuo formato`, `Segui l'analisi` for AI fallback jobs); Investimenti import history (`Apri`); global import island (`Dettaglio`); result emails (link `/importazioni?job={id}`).
- Global **import island** is mounted once in the app layout and visible on every app page.
- No country gating found (IT and DE). No feature switch other than server configuration (`PERSONAL_CSV_ENCRYPTION_KEY` missing → 503 `Importazione personalizzata non ancora configurata`).

## Screens

> **Phone layout (Phase 4R, web 0.81.0).** Title with the `file-spreadsheet` icon (28, `--muted-foreground`) and the
> explanation in body-large; the upload form shows «Passo N di 3» over the segmented bar; on the first step «Continua» is
> full width.

### Page layout (`/importazioni`)

Vertical stack, top to bottom:
1. **Report area** (one of, for the "report job"):
   - Correction screen, if the user started a correction on this job or the job is a correction not yet imported;
   - «Righe da controllare» review, if status `review_failed`;
   - «File ricevuto» receipt, for any other status.
   The report job is: the file just uploaded; else the job selected via `?job=` / island / list; else, with no selection, the first active job (`queued | processing | ready`). Nothing is shown when there is none.
2. **Upload form** (anchor `nuovo-import`), hidden while a just-uploaded receipt is shown, while correcting, or while a correction job is open.
3. **«Le tue importazioni»** list (anchor `le-tue-importazioni`).

Job statuses and labels: `queued` «In attesa di analisi», `processing` «Stiamo analizzando il CSV», `ready` «Salvataggio in corso», `imported` «Importato», `review_failed` «Righe da controllare», `failed` «Analisi non riuscita», `expired` «File scaduto», `correction_ready` «Correzione da confermare».

Data: `GET /api/personal-imports` → `{formats:[{id,name}], jobs:[{id, formatId, status, correctionOf, estimatedAt, expiresAt, createdAt, error, notifiedAt, results:{cash, investments, skipped}|null}]}` (newest first). Polled every 3 s **only while** at least one job is running (`queued|processing|ready`).

### Upload form (3 steps)

Step progress `Passi dell'importazione`; buttons `Indietro` (not on step 1) and primary `Continua` / last step `Importa il file` (`Carico il file…`). The primary button is disabled until the current step is complete; under it `Per continuare: {missing}.` lists what is missing (`scrivi da dove arriva il file`, `scegli il file`, `dai il consenso all'analisi`).

1. **`Da dove arriva il file?`**
   - If the user already has formats: description `Scegli un formato che hai già creato, oppure descrivine uno nuovo.` and select `Formato` with `Nuova banca o broker` (default) + each saved format name.
   - If no formats: description `Il nome della tua banca o del tuo broker: serve a riconoscere il formato la prossima volta.`
   - New format: required field `Nome della banca o del broker` (placeholder `Es. Banca Sella`, max 80 chars).
   - Existing format: checkbox `Rileggi il formato con l'AI (se il file è cambiato o il risultato precedente non era giusto)` (= `regenerate`, default off; reset when the format changes).
2. **`Carica il file`** — `CSV o Excel (.xlsx), fino a 25 MB e 50.000 righe.`
   - Drop zone / picker `Scegli un file` / `oppure trascinalo qui`; accepted `.csv, .txt, .xlsx` (CSV/XLSX MIME). While reading: `Leggo il file…` / `Un attimo`.
   - `.xlsx` is converted to CSV text on the client (first sheet: headers + rows); Excel larger than the XLSX limit → `Il file Excel pesa {0}: il massimo è {1}. Esporta il foglio in CSV e riprova.`
   - `.xls` → `I file .xls (Excel antico) non si leggono. In Excel scegli «Salva con nome» e poi «Cartella di lavoro di Excel (.xlsx)» o «CSV».`
   - CSV over 25 MB → `Il file pesa {0}: il massimo è {1}.`; unreadable → `Non riesco a leggere questo file.`. Errors shown with a «Segnala questo problema» report link (area `import_movimenti`).
   - Chosen file shown as a row: name, size `· pronto`, remove button `Rimuovi {name}`.
3. **`Ultimo passo: il consenso`** — `Per capire le colonne di un formato nuovo, il file viene letto da un modello AI.`
   - Required checkbox `Acconsento all'analisi AI del file, anche automaticamente se il formato salvato non riesce a leggerlo.`
   - Disclosure `Cosa succede ai tuoi dati`: `Il file originale completo è inviato a OpenRouter e al modello configurato, con fornitori senza conservazione dei dati. Può contenere descrizioni, dati finanziari ed eventuali dati personali presenti nel file.` / `File e anteprima sono cifrati e restano disponibili per 7 giorni; il file originale viene eliminato al termine dell'analisi. Il formato che ne ricaviamo è privato. Pagamenti e investimenti si salvano da soli al termine dei controlli.`

Submit → `POST /api/personal-imports` with JSON `{name (format name or typed name), csv, formatId?, regenerate, consent:true, consentVersion:"openrouter-raw-zdr-v3"}` → 202 `{id}`. On success the form resets (file, consent, regenerate cleared), the list is refreshed and the **receipt** replaces the form for that job. Errors shown below the button with report link.

Server validation: `csv` 1 byte–25 MB, `name` 1–80 chars trimmed, `consent` must be `true`, `consentVersion` must equal `openrouter-raw-zdr-v3`; body > ~50 MB → 413 `File troppo grande`; invalid → 400 `Nome, CSV e consenso sono obbligatori`; empty file `Il file è vuoto`; > 50.000 lines `Il file supera 50000 righe`; unknown `formatId` `Formato non disponibile`; rate limit `Limite raggiunto: massimo 2 analisi in corso e 10 caricamenti al giorno` (per rolling 24 h). Requests must come from the app origin (403 otherwise).

Background processing (server, informative): new job gets `estimatedAt = now + 1 h`, `expiresAt = now + 7 days`; the file is stored encrypted. A saved parser for the chosen format is reused (no AI call) unless `regenerate`; if a saved parser fails execution/coverage/determinism checks it is replaced automatically by a new AI analysis (consent covers this). Up to 3 attempts, retry delay growing per attempt. Outcome per row: `cash` (movement or transfer/giroconto), `investment` (acquisto/vendita/dividendo/cedola), `ignore`, `error` (with reason). If any row is `error` → `review_failed` with message from `describeRowErrors`; else → `ready`, which is **saved automatically** (no user confirmation) and becomes `imported`. Already-imported rows (same record key) are skipped without duplicates. Cash rows go to an auto-created account `{format name} · CSV` and investment rows to an auto-created portfolio `{format name} · CSV` (reused on later imports of the same format). Rules and automatic categorisation run on new movements after saving (see 05-categories-categorization); transfers get the transfers category. Jobs past `expiresAt` that are not imported become `expired` and their encrypted file/preview are deleted.

### «File ricevuto» receipt

- Title by state: `File ricevuto` (in progress), `Importazione completata` (imported), `Niente di nuovo da importare` (imported, every movement of the file was already there — info icon, neutral colour; web #461), `Non siamo riusciti a importare il file` (failed / review_failed / expired). Focus moves to the title on open.
- Status line: `L'abbiamo aggiunto alla lista delle tue importazioni e lo stiamo elaborando.` / imported: by overlap of `results.rows` (movements in the file) and `results.alreadyPresent` (web #461) — nothing new `Il movimento del file c'era già: non abbiamo aggiunto niente.` (1 row) or `Tutti i {0} movimenti del file c'erano già: non abbiamo aggiunto niente.`, some already there `{0} su {1} movimenti importati: gli altri c'erano già.`, otherwise (none, or an older job without counts) `I dati sono già nel tuo conto.` / job error or `Puoi riprovare con un altro file, oppure aprire il dettaglio dalla lista.`; on failure a «Segnala questo problema» link with the error attached.
- File row: name; `source · size · {n} righe` (size and row count only right after upload — not stored server-side; for jobs opened later the name is `Importazione del {d MMMM}` and source is the format name).
- Four stages with done / in progress (spinner + shimmer) / waiting icons: `File ricevuto`, `Analisi del formato`, `Controlli e salvataggio`, `Importato`. Stage = 1 for queued/processing, 2 for ready, all done for imported. Indeterminate progress bar while in progress.
- In progress: `Puoi chiudere questa pagina: ti scriviamo un'email appena abbiamo finito.` + `Stima: entro il {d MMMM, HH:mm}. È una stima, non una scadenza garantita.`
- Imported with results (not when nothing was new): `{n} movimenti aggiunti a Liquidità.`, `{n} operazioni aggiunte a Investimenti.`, if skipped > 0 `{0} righe non riconosciute sono state saltate, come hai scelto: non entrano nei conti.` (singular variant), if `bankCategorized` > 0 `{0} movimenti hanno già la categoria scritta dalla banca nel file: puoi cambiarla quando vuoi.` / `1 movimento ha già la categoria scritta dalla banca nel file: puoi cambiarla quando vuoi.` (web #456), and — only for older jobs without the counts — `Le righe già presenti sono state saltate, senza doppioni.`
- Actions: `Vai a Liquidità` (if cash > 0), `Vai alle operazioni` (if investments > 0; primary if no cash), ~~`Il risultato è sbagliato`~~ (not on web `main`, see Correction), `Vedi le tue importazioni` (scrolls to list), `Carica un altro file` (clears selection, shows the form).

### «Righe da controllare» review (status `review_failed`)

- Loads the encrypted preview `GET /api/personal-imports/{id}` → `{headers, currency, records:[{key, line, source[], outcome, rate}]}` (parser never sent). While loading title `Controllo le righe…` / `Un attimo: leggo l'esito dell'analisi.`; 404 `Anteprima non disponibile` when expired.
- Title: `{n} righe da controllare` / `1 riga da controllare` when there are error rows; otherwise (blocked by final financial checks, e.g. sales without purchases, currency changed) `Non siamo riusciti a importare il file` with the job error.
- Summary: `Su {total} righe lette, {ready} sono pronte e {errors} non le ho capite. Non ho salvato nulla: scegli tu cosa fare.` + report link. File row with `{n} righe lette`.
- **`Cosa puoi fare`** (all disabled while an action runs):
  - `Importa le {n} righe riconosciute` / `Importa la riga riconosciuta` — only when there are error rows and ≥ 1 importable row. Confirmation `Importare saltando {n} righe?` / `Salvo le {0} righe riconosciute e salto le altre {1}: non entrano nei conti. Potrai correggerle nel file e ricaricarlo più avanti, senza doppioni. Il formato resta salvato per i prossimi file.` → `Annulla` / `Importa e salta` → `POST /api/personal-imports/{id} {action:"import_skipping_errors"}`. Skipped rows get no receipt (re-uploading them corrected imports them as new). The generated parser becomes the format's parser.
  - `Rianalizza con l'AI` (primary when the skip option is absent; `Rianalizzo…`) — confirmation `Rianalizzare il file con l'AI?` / `Il file viene letto di nuovo dal modello AI, come al primo caricamento, per ricavare un formato migliore. Non devi ricaricarlo e non salvo nulla finché i controlli non passano. Utile se le righe segnalate ti sembrano giuste.` → `Rianalizza` → `POST /api/personal-imports/{id} {action:"reanalyze", consent:true, consentVersion}` → 202 new job; the old job is removed from the list and the new job's receipt is shown. Unavailable (expired, correction job, multi-column preview) → `Rianalisi non disponibile: carica di nuovo il file`.
  - `Carica un file corretto` — clears selection and scrolls to the upload form.
  - Action errors shown with report link.
- **`Cosa non va`**: error reasons grouped (most frequent first, ties by first appearance), each `reason` + `{n} righe`, listing up to 5 rows `Riga {line}` + original text (monospace; `(nascosta)` when «Nascondi importi» is on; `(riga vuota)`), then `Mostra tutte le {n} righe`. Note: `Il numero è la riga del file originale (l'intestazione è la riga 1). Apri il file, cerca la riga e confronta con il motivo.`
- **`Tutte le righe`**: `{0} righe lette: {1} movimenti, {2} operazioni, {3} escluse. Non salvo nulla finché non scegli.`; tabs `Da importare · n`, `Escluse · n` (only if > 0), `Errori · n` (only if > 0); default tab Errori if any, else Da importare. Rows: short date, title (description / instrument name / error reason), subtitle (`Movimento`/`Giroconto · riga n`, or `Acquisto|Vendita|Dividendo|Cedola · qty × price CUR · riga n`, or `Riga n`), amount. Tapping a row expands original columns (`header: value`, or `Colonna {n}`) and FX rate `Cambio verso {CUR}: {rate}`. 25 rows per page, `Mostra altre` and `1–{shown} di {total}`. With «Nascondi importi» on, the whole list is replaced by `Disattiva «Nascondi gli importi» per consultare il dettaglio.`; empty tab `Nessuna riga in questa scheda.`
- Help disclosure `Perché succede e come correggere` with three bullets (AI may err on unusual rows → Rianalizza; check date/amount format consistency; import the others and add/reload skipped ones later).

### Correction («Il risultato è sbagliato») — out of scope

**Not on the web `main`** (decision 0004). The inventory read web commit `433ae49c` «review and replace incorrect AI imports», which lives only on the unmerged web branch `codex/import-result-correction`; web `main` has no corrections (`correctionOf`/`feedback`, `replace_import`, `discard_correction`, `?correction=1`, status `correction_ready`). IMP-049…054 are out of scope until the web merges it; the apps keep the code behind a switch that is off. The text below documents that branch.


Available for `imported` personal imports and AI-fallback broker imports. Originals stay unchanged until the replacement is confirmed.

- **Start** (job `imported`): title `Il risultato è sbagliato`, `I movimenti originali restano invariati fino alla conferma della sostituzione.`; required textarea `Che cosa è sbagliato?` (max 2000); required file `Ricarica il file originale CSV o Excel` (`.csv,.xlsx,.txt,.tsv`, same client reading rules as upload); note `Il file precedente è stato eliminato dopo l’importazione. L’AI analizzerà il file completo insieme alla tua segnalazione tramite OpenRouter, senza conservazione presso il fornitore.`; required checkbox `Acconsento a inviare il file completo e la segnalazione per una nuova analisi AI.`; buttons `Analizza la correzione` (`Invio…`, disabled until all filled) and `Annulla`. Submit → `POST /api/personal-imports {csv, name:"Correzione", correctionOf, feedback, consent, consentVersion}`. Server errors: `Descrivi il problema di un’importazione completata`, `C’è già una correzione da controllare per questa importazione`.
- **Correction job** (title `Correzione dell’importazione`): while queued/processing `Nuova analisi in corso. Ti avviseremo via email quando potrai controllarla.`; job error shown; expired `La correzione è scaduta. Scartala e ricarica il file dall’importazione originale.`
- When `correction_ready`: comparison `GET /api/personal-imports/{id}?correction=1` (`Caricamento del confronto…`; 422 on error, e.g. `L’importazione originale è cambiata. Scarta questa analisi e avvia una nuova correzione.`). Shows table `Effetto dell’importazione sul conto` with columns `Attuale` / `Proposto` and rows `Movimenti` (counts), `Operazioni di investimento` (counts), `Variazione di liquidità` (sum of amounts); expandable lists `Movimenti attuali` / `Movimenti proposti` (date · description · amount) and `Investimenti attuali` / `Investimenti proposti` (Data, Strumento, Operazione, Quantità, Prezzo, Lordo, Commissioni, Imposte; note `Prezzo e lordo nella valuta dello strumento; commissioni e imposte nella valuta del profilo.`).
- Required checkbox `Ho controllato il confronto e voglio sostituire i dati dell’importazione originale.` → `Conferma e sostituisci` → `POST /api/personal-imports/{id} {action:"replace_import"}` (removal of the original and import of the new one in one transaction; blocked if data changed since the request or if removing purchases would oversell later sales).
- Always: `Scarta correzione e mantieni originale` → `{action:"discard_correction"}`, returns to the original job.

### «Le tue importazioni» list

- Section title `Le tue importazioni`. Loading `Caricamento…`; error `Impossibile caricare i CSV personali. Riprova.`; empty: icon, `Nessun file caricato`, `Quando carichi un file lo trovi qui, con il suo stato.`
- One row per job (newest first): status icon (running spinner / review / done check / failed alert), format name (or `File`), day label (`oggi HH:mm`, `ieri`, or `d MMM`), status message, action label (wide screens) or chevron (phone). Running rows add an indeterminate progress bar and shimmering text. The selected row is highlighted.
- Message/action by status: queued/processing `Analisi in corso` (no action); ready `Salvataggio in corso`; imported `{cash} movimenti · {investments} operazioni` / `Dettaglio` (web #461: nothing new → `Niente di nuovo: {0} movimenti c'erano già`; some already there → `{0} su {1} movimenti importati`); review_failed job error or `Qualche riga da correggere` / `Controlla`; failed job error or `Formato non riconosciuto` / `Riprova`; expired `File scaduto: caricalo di nuovo` / `Riprova`; correction_ready `Correzione da confermare` / `Confronta`.
- Tap: for `Riprova` rows (not corrections) → clear selection and scroll to the upload form; otherwise select the job (report area shows it).
- Deletion is not available here; it is in Investimenti → «Gestisci importazioni» (07-investments) via `GET /api/personal-imports/{id}?deletion=1` (preview + token) and `DELETE /api/personal-imports/{id} {token}`.

### Global import island (all app pages)

- Shows one pill per job created in the last 24 h that is not dismissed and not expired, newest first, stacked under sync islands.
- Content: running → ring spinner, `{source}: importo il file` (shimmer), `Puoi continuare a usare l'app.`, link `Dettaglio`; review_failed → `{source}: da controllare`, `Vedi quali righe e scegli cosa fare.`; correction_ready → `{source}: da controllare`, `Confronta la correzione prima di confermare.`; failed → `{source}: non riuscito`, `Vedi cosa fare.`; imported with nothing new → `{source}: niente di nuovo`, `I movimenti c'erano già tutti.` (web #461); imported with some already there → `{source}: completato`, `{0} su {1} movimenti importati`; imported → `{source}: completato`, `{n} movimenti · {m} operazioni` (or `Dati aggiunti.`). `Dettaglio` → `/importazioni?job={id}`. Non-running pills have a close button `Chiudi riepilogo importazione`; dismissals are remembered on the device (last 50 ids).
- When a running job finishes, the app refreshes accounts, investments, net-worth snapshots, transactions, categorize suggestions, auto-categorised and attention data.

### Emails (server)

When a job reaches `imported`, `review_failed`, `failed` or `correction_ready`, one email is sent (idempotent) with a link to `/importazioni?job={id}`: `Il tuo CSV è stato importato` (CTA `Apri BuddyBudget`), `Il tuo CSV ha righe da controllare` (`Vedi le righe`), `Non è stato possibile importare il tuo CSV` (`Vedi il motivo`), `La correzione del CSV è pronta da confrontare` / `La correzione del CSV richiede attenzione` (`Controlla la correzione`).

## Requirements

#### Page & list

- **IMP-001** `/importazioni` shall show BackLink `‹ Liquidità`, title `Importa da CSV o Excel` and the intro text.
- **IMP-002** The app shall load formats and jobs and show jobs newest first. _API: `GET /api/personal-imports`_
- **IMP-003** The app shall poll the jobs list every 3 s only while at least one job is `queued`, `processing` or `ready`.
- **IMP-004** Opening `/importazioni?job={id}` shall show that job's report.
- **IMP-005** Without an explicit selection, the report area shall show the first active job, or nothing if none is active.
- **IMP-006** The report area shall show the correction screen, the review screen (`review_failed`) or the receipt, according to the rules in Page layout.
- **IMP-007** Each list row shall show status icon, format name, relative day label and the status message defined per status.
- **IMP-008** Running rows shall show an indeterminate progress indicator.
- **IMP-009** Tapping a failed or expired non-correction row shall bring the user to the upload form; tapping any other row shall open its report.
- **IMP-010** The list shall show the empty state `Nessun file caricato` / `Quando carichi un file lo trovi qui, con il suo stato.` and the error `Impossibile caricare i CSV personali. Riprova.`
- **IMP-011** The list shall not offer deletion; deletion of personal imports is provided by Investimenti «Gestisci importazioni» (07-investments). _API: `GET /api/personal-imports/{id}?deletion=1`, `DELETE /api/personal-imports/{id}`_

#### Upload

- **IMP-012** The upload form shall have three steps (source, file, consent) with a step indicator, `Indietro` from step 2 and a primary button enabled only when the current step is complete.
- **IMP-013** Under a disabled primary button the app shall list what is missing in the current step.
- **IMP-014** Step 1 shall offer saved formats plus `Nuova banca o broker` (default) when formats exist.
- **IMP-015** A new format shall require `Nome della banca o del broker` (1–80 characters).
- **IMP-016** An existing format shall offer `Rileggi il formato con l'AI`, default off and reset when the format changes.
- **IMP-017** Step 2 shall accept `.csv`, `.txt` and `.xlsx` up to 25 MB and 50.000 data rows.
- **IMP-018** An `.xlsx` file shall be converted on the device to CSV text (first sheet) before upload; the server always receives CSV text.
- **IMP-019** `.xls` files shall be rejected with the specified "Salva con nome" message; oversize files with the size message; unreadable files with `Non riesco a leggere questo file.`
- **IMP-020** File errors shall be shown with a «Segnala questo problema» link for area `import_movimenti`.
- **IMP-021** A chosen file shall be shown with name, size and `· pronto`, and be removable.
- **IMP-022** Step 3 shall require the consent checkbox and offer the `Cosa succede ai tuoi dati` disclosure with the specified copy.
- **IMP-023** Submitting shall send name, CSV text, optional formatId, regenerate flag, `consent: true` and `consentVersion: "openrouter-raw-zdr-v3"`. _API: `POST /api/personal-imports`_
- **IMP-024** On success the form shall reset and be replaced by the «File ricevuto» receipt for the new job, and the list shall refresh.
- **IMP-025** Server errors (413 `File troppo grande`, 400 validation, `Il file è vuoto`, `Il file supera 50000 righe`, `Formato non disponibile`, rate limit `Limite raggiunto: massimo 2 analisi in corso e 10 caricamenti al giorno`, 503 not configured) shall be shown under the button with a report link.

#### Receipt

- **IMP-026** The receipt shall title itself `File ricevuto`, `Importazione completata` or `Non siamo riusciti a importare il file` according to status.
- **IMP-027** The receipt shall show the file name and, right after upload, source, size and row count; for jobs opened later `Importazione del {date}` and the format name.
- **IMP-028** The receipt shall show the four stages derived from status (queued/processing → analysis, ready → checks and saving, imported → all done).
- **IMP-029** While in progress the receipt shall show the email reassurance and the estimate `Stima: entro il {date time}. È una stima, non una scadenza garantita.`
- **IMP-030** (changed by web #456/#461) When imported, the receipt shall say how many movements of the file were new (`Niente di nuovo da importare` / `{0} su {1} movimenti importati: gli altri c'erano già.` / `I dati sono già nel tuo conto.`) and, unless nothing was new, list movements and operations added, skipped unrecognised rows, movements that took the bank's category, and — only for jobs without the counts — `Le righe già presenti sono state saltate, senza doppioni.`
- **IMP-031** (changed: correction out of scope) When imported, the receipt shall offer `Vai a Liquidità` (if cash > 0) and `Vai alle operazioni` (if investments > 0).
- **IMP-032** The receipt shall always offer `Vedi le tue importazioni` and `Carica un altro file`.
- **IMP-033** A failed receipt shall show the job error and a «Segnala questo problema» link.

#### Review («Righe da controllare»)

- **IMP-034** For a `review_failed` job the app shall load the preview and show a loading state while doing so. _API: `GET /api/personal-imports/{id}`_
- **IMP-035** The review title shall be `{n} righe da controllare` when there are error rows, otherwise `Non siamo riusciti a importare il file` with the job error.
- **IMP-036** The review shall state `Su {total} righe lette, {ready} sono pronte e {errors} non le ho capite. Non ho salvato nulla: scegli tu cosa fare.`
- **IMP-037** When there are error rows and at least one importable row, the app shall offer `Importa le {n} righe riconosciute` behind the specified confirmation. _API: `POST /api/personal-imports/{id}` `{action:"import_skipping_errors"}`_
- **IMP-038** Importing while skipping errors shall save only recognised rows, leave skipped rows importable by a later corrected upload, and keep the derived format.
- **IMP-039** The review shall offer `Rianalizza con l'AI` behind the specified confirmation, re-sending consent; on success the new job replaces the old one in the list and its receipt is shown. _API: `POST /api/personal-imports/{id}` `{action:"reanalyze", consent:true, consentVersion}`_
- **IMP-040** The review shall offer `Carica un file corretto`, returning to the upload form.
- **IMP-041** Review actions shall be disabled while one is running, and errors shown with a report link.
- **IMP-042** `Cosa non va` shall group error rows by reason (most frequent first), show the count per reason and up to 5 rows (file line number + original text) with `Mostra tutte le {n} righe`.
- **IMP-043** Line numbers shall refer to the original file with the header as line 1.
- **IMP-044** With «Nascondi importi» on, original row text in `Cosa non va` shall be replaced by `(nascosta)` and `Tutte le righe` by `Disattiva «Nascondi gli importi» per consultare il dettaglio.`
- **IMP-045** `Tutte le righe` shall show counts and tabs `Da importare`, `Escluse` (if any), `Errori` (if any), defaulting to Errori when present.
- **IMP-046** Each row shall show date, title, type/line subtitle and amount, and expand to the original columns and FX rate.
- **IMP-047** Rows shall be paged by 25 with `Mostra altre`.
- **IMP-048** The review shall include the `Perché succede e come correggere` help.

#### Correction

- ~~**IMP-049**~~ Out of scope (not on web `main`, decision 0004; kept for when the web merges it): `Il risultato è sbagliato` shall open a form requiring a problem description (≤ 2000 characters), the original file and explicit consent, stating that originals stay unchanged until confirmation. _API: `POST /api/personal-imports` with `correctionOf`, `feedback`_
- ~~**IMP-050**~~ Out of scope (not on web `main`, decision 0004; kept for when the web merges it): The app shall show the correction's progress and, when `correction_ready`, a comparison of current vs proposed movements count, investment operations count and liquidity change, with expandable detail lists. _API: `GET /api/personal-imports/{id}?correction=1`_
- ~~**IMP-051**~~ Out of scope (not on web `main`, decision 0004; kept for when the web merges it): Replacing shall require the checkbox `Ho controllato il confronto e voglio sostituire i dati dell’importazione originale.` _API: `POST /api/personal-imports/{id}` `{action:"replace_import"}`_
- ~~**IMP-052**~~ Out of scope (not on web `main`, decision 0004; kept for when the web merges it): The user shall be able to discard a correction at any time, keeping the original. _API: `POST /api/personal-imports/{id}` `{action:"discard_correction"}`_
- ~~**IMP-053**~~ Out of scope (not on web `main`, decision 0004; kept for when the web merges it): Only one pending correction per import shall be allowed; the server error shall be shown.
- ~~**IMP-054**~~ Out of scope (not on web `main`, decision 0004; kept for when the web merges it): An expired correction shall show `La correzione è scaduta. Scartala e ricarica il file dall’importazione originale.`

#### Background, island & notifications

- **IMP-055** A job without row errors shall be saved automatically after analysis without user confirmation, and categorisation rules/auto-apply shall run on the new movements.
- **IMP-056** Rows already imported for the same format shall never be duplicated.
- **IMP-057** Jobs not imported within 7 days shall become `expired` and their file/preview become unavailable.
- **IMP-058** The import island shall show, on every app screen, jobs created in the last 24 h that are not dismissed, with status-specific title and detail and a `Dettaglio` link to the job.
- **IMP-059** Finished island pills shall be dismissible and dismissals remembered on the device.
- **IMP-060** When a job the app saw running finishes, the app shall refresh accounts, investments, net worth, movements and categorisation data.
- **IMP-061** The server shall email the user once when a job is imported, needs review or fails, linking to `/importazioni?job={id}`.
- **IMP-062** (web #461) Uploading a file identical to one already imported shall be refused before any analysis with `409 {code:"already_imported", error}`; the app shall show the message as a notice (info icon, not an error, no report link). _API: `POST /api/personal-imports`_
- **IMP-063** (web #461) The list and the island shall say `Niente di nuovo: {0} movimenti c'erano già` / `{source}: niente di nuovo` · `I movimenti c'erano già tutti.` when nothing was new, and `{0} su {1} movimenti importati` when some movements were already there.

#### Files from other apps (mobile only, owner request 2026-10-21)

The web has no share sheet; these requirements make a file sent to BuddyBudget from another app (Files, Mail, a bank
app, a broker app…) go through **the same server flows the web uses for that file**, without the user opening the
import screen first. Nothing is uploaded without what the web asks for (a source name and the consent).

- **IMP-064** The app shall register for CSV and Excel files from other apps: Android `ACTION_SEND` / `ACTION_SEND_MULTIPLE` / `ACTION_VIEW` (content URIs) for `text/csv`, `text/comma-separated-values`, `text/tab-separated-values`, `application/csv`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `application/octet-stream` (the last only when the name ends in `.csv`, `.txt`, `.tsv`, `.xlsx` or `.xls`); iOS document types (`public.comma-separated-values-text`, `public.tab-separated-values-text`, `org.openxmlformats.spreadsheetml.sheet`, `com.microsoft.excel.xls`) with `LSHandlerRank` `Alternate`, so BuddyBudget appears in the share sheet / «Apri con» / «Apri in…». Anything else is ignored.
- **IMP-065** The app shall read an incoming file at once (the grant does not last) but at most 25 MB + 1 byte, keeping the real size, so an oversized file gets the web's size message (IMP-019) without being loaded in memory; the iOS copy left in `Documents/Inbox` is deleted after reading.
- **IMP-066** Files shall be routed as the broker wizard and the personal import would take them on the web: several files, or a file whose content a broker parser recognises (`detectImportProvider`: Trade Republic, DEGIRO, Fineco, Interactive Brokers, Yahoo), open the Investimenti import wizard already parsed (its review step, INV-093…); anything else opens the personal import (`/importazioni`) with the file chosen and read (`.xlsx` converted on the device, IMP-018), errors (`.xls`, size, unreadable) shown at once.
- **IMP-067** Files that arrive while the user is signed out, onboarding, on the legal or deactivated screen shall be kept in memory and routed once the app is usable (after sign-in and onboarding).
- **IMP-068** A shared file shall open the personal form on the first step still missing something: `Da dove arriva il file?` when a new source needs its name, otherwise the consent step (`Ultimo passo: il consenso`); from the source step `Continua` goes straight to the consent (the file is already chosen). The consent checkbox always starts unticked (web: consent on every upload).
- **IMP-069** For a shared file, ticking the consent (with the source given) shall upload the file at once — the same `POST /api/personal-imports` as `Importa il file`, with `consent: true` — and show the «File ricevuto» receipt (IMP-024…026); errors, the rate limit and `already_imported` (IMP-062) show under the button as for any upload. The consent is never skipped or remembered.

## Mobile adaptation notes

- **Proposal — needs product sign-off:** File selection → system document picker (iOS `UIDocumentPicker` / Android Storage Access Framework) filtered to CSV, plain text and XLSX; also accept files shared to the app via the share sheet / "Open in", which preselects step 2. No drag-and-drop.
- **Proposal — needs product sign-off:** XLSX → CSV conversion must be done on device with an identical algorithm (first sheet, header + rows, same CSV quoting as web `gridToCsv`) so parsers derived on web and mobile match; alternatively request a server endpoint that accepts XLSX (see open questions).
- **Proposal — needs product sign-off:** The 3-step upload is a full-screen flow with the step indicator; the report area (receipt / review / correction) is a pushed detail screen, and «Le tue importazioni» is the root list of `/importazioni` on phone (instead of one long scrolling page).
- **Proposal — needs product sign-off:** Import island → a compact persistent banner above the bottom navigation bar (same content and dismiss rules), stacked with the sync banner; additionally, when the app is backgrounded, rely on the server email (no local push until a push channel exists).
- **Proposal — needs product sign-off:** Polling → 3 s polling only while the app is foregrounded and a job is running; refresh once on returning to foreground.
- **Proposal — needs product sign-off:** Email links `/importazioni?job={id}` → universal links / app links open the job detail in the app.
- **Proposal — needs product sign-off:** Correction comparison tables → stacked cards per row (label, Attuale, Proposto) and investment details as list rows with a detail sheet instead of a horizontally scrolling 8-column table.
- **Proposal — needs product sign-off:** `<details>` disclosures and expandable rows → native disclosure rows; the "Riga n + original text" monospace block is selectable/copyable.

**Share-in made automatic (2026-10-21, both apps):** IMP-064…069 — a file shared from another app is read, routed and
processed without opening the import screen first; the personal import still asks for the source and the consent (one
tap: ticking the consent sends it).

**Adopted in Phase 4c (2026-10-19, both apps):** system picker + share-in (files routed by content: a supported broker
export opens the Investimenti wizard, anything else the personal form on the file step); on-device XLSX → CSV identical
to the web (`ImportXlsx`, golden vectors); `/importazioni` kept as **one scrolling page** like the web (report, form, list)
rather than the root-list/detail split proposed above; island as a compact pill above the bottom bar; polling only in the
foreground; correction comparison as stacked rows with disclosure lists; links `/importazioni?job=` open the job. The
«Segnala questo problema» links wait for 16-help-support.

## Open questions

1. All mutating endpoints (`POST /api/personal-imports`, `POST/DELETE /api/personal-imports/{id}`) reject requests whose `Origin` header differs from `APP_URL` (403). Native clients don't send a browser Origin: needs an API change (token-based CSRF exemption) before mobile can upload.
2. Upload sends the whole file as a JSON string (up to 25 MB, body limit ~50 MB); on mobile networks this is heavy and not resumable. Consider multipart / chunked upload.
3. XLSX conversion happens only client-side (web uses `readXlsx` + `gridToCsv`, with its own XLSX size limit `XLSX_MAX_FILE_BYTES`); mobile must reproduce it byte-for-byte or the server needs an XLSX path. The XLSX limit value must be exported to the spec.
4. File size and row count shown in the receipt exist only right after upload (not stored server-side); if the app is restarted the receipt loses them. Acceptable?
5. Several strings are not localised on web (`describeImportJob` messages, `Riga n`/`Movimento`/`Giroconto` subtitles, `Carico il file…`/`Importa il file`, `describeRowErrors`, server `ImportError` messages, emails in Italian only). Mobile needs catalogue keys; server messages should become codes.
6. Review/receipt page is driven by `job.error` free text from the server; no structured error codes for mobile to localise.
7. `islandState` maps `review_failed` to "failed" (list icon is an alert) while the island card says «da controllare»; list and island icons are inconsistent — confirm intended visuals.
8. Dismissed island ids and "seen" state are device-local (localStorage); dismissing on web will not hide the pill on mobile. Confirm per-device behaviour is acceptable.
9. The disclosure says file and preview remain for 7 days and the original is deleted after analysis, but a correction requires re-uploading the original: confirm the copy for mobile.
10. The deletion flow for personal imports lives only in Investimenti «Gestisci importazioni» even for cash-only imports; consider exposing delete from the `/importazioni` detail on mobile (product decision).
