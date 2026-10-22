# Help & support

Status: draft · Source: app/(app)/aiuto/page.tsx, components/domain/support/*, app/api/support/route.ts, lib/support/*, components/domain/shared/page-error.tsx, app/(app)/error.tsx, app/global-error.tsx, lib/client-errors/*, app/api/client-errors/route.ts

## Purpose

Lets the user get help and contact the team from anywhere: a dedicated «Aiuto e segnalazioni» screen (quick answers, contact form, GitHub links, service status), a global «Scrivici» quick-report sheet, and «Segnala questo problema» links/toast actions attached to error messages that pre-attach the failed operation. Reports are emailed to support with a reference code. Separately, screen crashes are reported automatically (non-user-facing telemetry) so the team sees rendering failures.

## Entry points & navigation

- User menu → `Aiuto e segnalazioni` → `/aiuto?da=<current path>` (spec 00).
- Phone «Altro» → `Assistenza` → `Aiuto e segnalazioni` (`Domande, problemi e idee`) → `/aiuto` (no `da`).
- «Scrivici» buttons: sidebar footer and phone top-bar speech-bubble icon → quick-report sheet, source `pulsante`.
- «Segnala questo problema» link under errors (form errors, sync island, screen-crash page, import failures …) and `Segnala` action on error toasts → quick-report sheet, source `errore`, with the error attached.
- Deep-link parameters of /aiuto: `?da=` origin page (used as attached context path), `?tipo=` preselects kind (`problema|domanda|idea`; invalid values ignored).

## Screens

> **Phone layout (Phase 4R, web 0.81.0).** «Scrivici», «Risposte rapide» and «Su GitHub» are display-face titles without
> icon tiles; the FAQ rows have no rules.

### Aiuto e segnalazioni (/aiuto)

- Title `Aiuto e segnalazioni`; subtitle `Puoi scriverci anche da qualsiasi pagina, con l'icona del fumetto, e dai messaggi d'errore.`
- Status line: `L'app è lenta o non risponde? Guarda prima lo` + link `stato del servizio` (external, `https://stats.uptimerobot.com/BCuTWm0Ukg`).
- Section 1 — `Scrivici` (`Un problema, una domanda o un'idea: ti rispondiamo via email.`): full Report form (below), source `pagina`, initial kind from `?tipo=` else `problema`, context path from `?da=` else current path.
- Section 2 — `Risposte rapide` (`Le domande che riceviamo più spesso.`): accordion FAQ, each item independently expandable:
  1. `Il collegamento con la banca non si aggiorna più` → `Il consenso Open Banking dura al massimo 90 giorni e poi va rinnovato. Vai in Liquidità → Conti e scegli «Rinnova» sul conto: ti avvisiamo anche per email prima della scadenza.`
  2. `Come importo i movimenti o le operazioni da un file?` → `Da Liquidità → Conti puoi aggiungere un conto importando un CSV, e da Investimenti → Operazioni importi gli estratti del broker. Gestisci e cancella gli import da «Gestione importazioni».`
  3. `Una transazione ha la categoria sbagliata` → `Tocca l'icona del movimento in Liquidità e scegli la categoria: se vuoi, la ricordiamo con una regola per i prossimi movimenti dello stesso esercente.`
  4. `Posso scaricare o cancellare i miei dati?` → `Sì, da Impostazioni: esporti tutto in un file ZIP, azzeri i dati o elimini l'account quando vuoi.`
  5. `Le stime fiscali sono una consulenza?` → `No. Imposte, aliquote e proiezioni sono stime a scopo informativo: per decisioni fiscali o di investimento rivolgiti a un professionista abilitato.`
- Section 3 — `Su GitHub` (`BuddyBudget è open source: puoi seguire e segnalare anche da lì.`): four external links, each with a hint:
  - `Apri una issue su GitHub` — `Pubblica: per problemi e idee senza dati personali.` → `https://github.com/YonderUrik/buddy-budget/issues/new?template=bug.yml&ambiente=BuddyBudget {version}, pagina {path}, schermo {WxH}, tema {chiaro|scuro}`
  - `Vedi le segnalazioni aperte` — `Controlla se qualcuno ha già scritto la stessa cosa.` → `{repo}/issues`
  - `Novità e correzioni` — `Cosa è cambiato in ogni versione.` → `{repo}/releases`
  - `Segnala una vulnerabilità` — `In privato, mai in una issue pubblica.` → `{repo}/security/policy`
- Not country-gated; no amounts shown.

### Report form (shared by page and sheet)

- Kind selector (segmented, a11y `Di cosa si tratta`): `Un problema` / `Una domanda` / `Un'idea`. Hidden when an error is attached (kind forced to `problema`).
- Message textarea, label `Racconta` (visually hidden in the sheet), placeholder by kind:
  - problema `Cosa è successo e cosa ti aspettavi? Se puoi, i passi per rivederlo.`
  - domanda `Cosa vuoi sapere?`
  - idea `Cosa ti piacerebbe poter fare?`
  - Hint `Non scrivere IBAN, password o altri dati sensibili: non servono. Useremo la tua email solo per risponderti.`
  - Validation: trimmed length ≥ 10 (server message `Scrivi qualche parola in più.`), ≤ 4000 (input hard-limited).
- Checkbox (default checked) `Allega il contesto tecnico: pagina {path}, versione {version}, schermo {WxH}, tema {Chiaro|Scuro}. Nessun dato finanziario.`
  - Context = `{path (no query/hash, ≤120 chars), version (≤40), viewport "WxH" (2–5 digits each), theme "chiaro"|"scuro"}`. Unchecked → no context sent.
- Submit `Invia` (`Invio…` while pending); disabled while message < 10 chars or pending.
- Success state (replaces form): `Grazie, abbiamo ricevuto la segnalazione.` / `Codice di riferimento {SUP-XXXXXX}. Ti rispondiamo via email.` + button `Scrivi un'altra segnalazione` (resets to an empty form).
- Error state: server error message + ` Puoi anche scrivere a support@buddybudget.io.` Known server messages:
  - 400 validation: first zod message (e.g. `Scrivi qualche parola in più.`) or `Segnalazione non valida.`
  - 429: `Hai già inviato diverse segnalazioni: riprova tra un po'.` (limit 5 reports per user per hour)
  - 502: `Non siamo riusciti a inviare la segnalazione. Riprova o scrivi a support@buddybudget.io.`
  - Network/unknown: `Non siamo riusciti a inviare la segnalazione.`
- Request: `POST /api/support` body `{kind, message (trimmed), context?, source?: "pagina"|"pulsante"|"errore", error?: {area, message ≤300}}` → `201 {reference}`.
- Server behaviour: emails support (reply-to = user's email) with subject `[{ref}] {kind}: {first 60 chars}` and body: kind, sender, attached error (`Errore: {area label}: {message}`), context lines (or `Contesto: non allegato dall'utente`), user agent (≤200 chars), message. Logs never contain message text or email.

### Quick-report sheet («Scrivici» / «Segnala questo problema»)

- Mounted once for the whole authenticated app; opens over the current screen (bottom sheet on phone).
- Title `Scrivici`, or `Segnala questo problema` when an error is attached. Description `Ti rispondiamo via email. Leggiamo tutto.`
- With attached error: a red box showing the operation label and the error message (truncated to 300 chars). Operation labels (area → label):
  `import_movimenti` Importazione dei movimenti · `import_investimenti` Importazione degli investimenti · `sync_banca` Aggiornamento dalla banca · `collega_banca` Collegamento della banca · `movimento` Salvataggio di un movimento · `operazione` Salvataggio di un'operazione · `conto` Salvataggio di un conto · `debito` Salvataggio di un debito · `abbonamento` Salvataggio di un abbonamento · `pensione` Salvataggio della pensione · `obiettivo` Salvataggio di un obiettivo · `caricamento` Caricamento della pagina · `salvataggio` Salvataggio.
- Body: Report form in compact mode; context path = current screen; source = `pulsante` or `errore`.
- Each opening starts a fresh form. Closing discards the draft.

### «Segnala questo problema» link / ErrorWithReport / error toast

- `ReportErrorLink`: text button `Segnala questo problema` under an error message → opens the sheet with `{area, message}`.
- `ErrorWithReport`: inline error message (alert role) + the link; used by forms across the app.
- `errorToast(message, area="salvataggio")`: error toast with action `Segnala` → opens the sheet with the error attached. Can be triggered from non-UI code via an app-wide event.
- Used in ~24 places (areas in use: import_movimenti, import_investimenti, sync_banca, collega_banca, movimento, operazione, conto, debito, abbonamento, pensione, obiettivo, caricamento, salvataggio). Each area spec references this mechanism.

### Automatic crash reporting (client errors)

- When a screen fails to render (error boundary, kind `sezione`) or the root app fails (kind `globale`), the client sends once, best-effort, `POST /api/client-errors` `{kind, area, name? ≤80, message ≤500 (fallback "Errore senza messaggio"), digest? ≤64}`; `area` is only the first path segment from a closed list (panoramica, liquidita, conti, investimenti, debiti, pensione, analitiche, categorizza, importazioni, impostazioni, aiuto, onboarding, altro) — never the full path. Responses: `204`, `400` invalid, `429` (> 20 per user per 10 min), `401` without session.
- Not visible to the user except through the crash screen (spec 00: `Questa pagina non si è caricata`, `Codice errore: {digest}`, `Riprova`, `Segnala questo problema` with area `caricamento` and message `{title}. Codice errore: {digest}`).

## Requirements

#### Help screen

- **SUP-001** The app shall provide an «Aiuto e segnalazioni» screen reachable from the user menu and from «Altro» → Assistenza.
- **SUP-002** When opened from the user menu, the screen shall use the screen the user came from as the attached context path; otherwise the current screen.
- **SUP-003** The screen shall accept a preselected report kind (`problema`, `domanda`, `idea`), ignoring invalid values and defaulting to `problema`.
- **SUP-004** The screen shall show a service-status link opening `https://stats.uptimerobot.com/BCuTWm0Ukg` externally.
- **SUP-005** The screen shall show sections in order: Scrivici (report form), Risposte rapide, Su GitHub.
- **SUP-006** Risposte rapide shall list the five FAQ items verbatim, each independently expandable/collapsible.
- **SUP-007** Su GitHub shall offer the four external links (new issue prefilled with version/path/screen/theme, open issues, releases, security policy) with their hints.

#### Report form

- **SUP-008** The report form shall let the user choose the kind among `Un problema`, `Una domanda`, `Un'idea`, with a kind-specific placeholder.
- **SUP-009** The form shall require a message of at least 10 characters after trimming and at most 4000 characters; the submit button shall be disabled until valid.
- **SUP-010** The form shall show the sensitive-data hint below the message field.
- **SUP-011** The form shall show the technical context to be attached (path without query/fragment, app version, screen size, theme) with a checkbox, checked by default; unchecking shall omit the context.
- **SUP-012** The technical context shall never include financial data, query parameters or identifiers beyond the path.
- **SUP-013** Submitting shall send the report and on success replace the form with the thank-you message and the reference code `SUP-XXXXXX`. _API: `POST /api/support`_
- **SUP-014** `Scrivi un'altra segnalazione` shall reset to an empty form.
- **SUP-015** On failure the form shall keep the message, show the server error text followed by `Puoi anche scrivere a support@buddybudget.io.`, and allow retry.
- **SUP-016** The backend shall limit reports to 5 per user per hour, answering `429` with `Hai già inviato diverse segnalazioni: riprova tra un po'.` _API: `POST /api/support`_
- **SUP-017** The backend shall email the report to support with the user's address as reply-to and return `201 {reference}`; if sending fails it shall return `502` with the fallback message. _API: `POST /api/support`_
- **SUP-018** The client shall tag each report with its source: `pagina` (help screen), `pulsante` («Scrivici» button), `errore` (from an error).

#### Quick-report sheet

- **SUP-019** The app shall open a quick-report sheet from the «Scrivici» buttons (sidebar/top bar) on any authenticated screen, titled `Scrivici`, with the current screen as context.
- **SUP-020** The app shall open the same sheet from any `Segnala questo problema` link or `Segnala` toast action, titled `Segnala questo problema`, showing the failed operation label and the error message, with kind fixed to `problema` and the kind selector hidden.
- **SUP-021** The attached error message shall be truncated to 300 characters and sent as `error: {area, message}` with `area` from the closed list of operation areas.
- **SUP-022** Every opening of the sheet shall start from an empty form; dismissing the sheet shall discard the draft.
- **SUP-023** Error toasts for failed saves shall offer a `Segnala` action that opens the sheet with the error attached (default area `salvataggio`).

#### Crash reporting

- **SUP-024** When a screen fails to render, the app shall send one crash report with kind `sezione`, area (first path segment from the closed list, else `altro`), error name, message (≤500) and digest. _API: `POST /api/client-errors`_
- **SUP-025** Crash reporting shall be best-effort and silent: failures to send shall never affect the error screen.
- **SUP-026** The backend shall accept at most 20 crash reports per user per 10 minutes, answering `429` beyond that. _API: `POST /api/client-errors`_

## Mobile adaptation notes

- **Proposal — needs product sign-off:** Quick-report sheet is a bottom sheet (medium/large detents, drag to dismiss); if the message is non-empty, dismissing by drag should still discard (parity) — or ask confirmation; pick one for both platforms (recommend: discard, parity with web).
- **Proposal — needs product sign-off:** «Scrivici» entry on phone: keep the speech-bubble icon in the top app bar of every root tab screen (matching web top bar).
- **Proposal — needs product sign-off:** Technical context on native: `path` = logical route of the current screen using the same web path strings (e.g. `/liquidita/conti`) so support sees comparable data; `version` = app marketing version; `viewport` = screen points `WxH`; `theme` = resolved theme. Add platform/OS to the server-side "Browser" line via the User-Agent header (e.g. `BuddyBudget-iOS/1.2 (iOS 18.1; iPhone15,2)`).
- **Proposal — needs product sign-off:** External links (status page, GitHub) open in the in-app browser (SFSafariViewController / Custom Tabs).
- **Proposal — needs product sign-off:** FAQ answers reference web paths ("Liquidità → Conti", «Gestione importazioni»); keep wording but make them match native navigation labels, and optionally deep-link.
- **Proposal — needs product sign-off:** Crash reporting: map native unhandled UI errors in a screen to `POST /api/client-errors` with kind `sezione`; keep native crash tooling (e.g. platform crash reporter) separate. A `globale` crash equivalent is an app crash, which cannot report from within — send it on next launch.
- **Proposal — needs product sign-off:** Show the `SUP-XXXXXX` reference as selectable/copyable text with a copy button.

## Open questions

1. `/api/support` and `/api/client-errors` require the web session (cookie); mobile needs the same endpoints to accept the native auth token.
2. The issue-prefill URL and context `theme` values are Italian enums (`chiaro`/`scuro`); server-side schema accepts only those — mobile must send them literally regardless of UI language.
3. `viewport` regex (`^\d{2,5}x\d{2,5}$`) — native must send integer points; tablets/foldables fine.
4. `CLIENT_ERROR_AREAS` includes `conti` (legacy route) but not newer segments like `country-unavailable`; mobile screens outside the list will report `altro` — acceptable?
5. FAQ content is hard-coded in the web bundle (and translated via catalogs); mobile must duplicate it or the server must expose it.
6. Quick-report sheet is not available outside the authenticated area (login/onboarding errors can't be reported; global crash shows only the email address) — same on mobile?
7. Rate-limit and send-failure messages are Italian source strings returned by the server; the web client translates them via its catalog (`t(error.message)`). Mobile must ship the same catalog keys or the server should localize.
8. The success message is keyed on `reference`; mobile should treat a 2xx without `reference` as failure (web does).

## Implementation notes (Phase 4d, 2026-10-19)

- Open question 1: resolved — `/api/support` and `/api/client-errors` accept the bearer token on the backend branch.
- Open question 7: resolved — the server localizes its error messages to the account language (DE user: `Wir konnten die
  Meldung nicht senden…`); the apps still pass the text through the catalog, which leaves non-Italian text unchanged.
- Adopted mobile notes (same on both platforms): bottom sheet, dismiss discards; «Scrivici» icon on the tab roots;
  context `path` = logical web path, `version` = `ios|android-<version> (<build>)`, `viewport` = points / dp, `theme` sent
  as `chiaro|scuro`; external links open in the system browser; the reference is selectable text; crash reporting =
  a screen response that cannot be decoded (`kind: sezione`, `name: DecodingError`), once per run; no `globale` report yet.
- Fixture: `api/fixtures/support.json`. With the local placeholder Resend key every valid report answers 502.
