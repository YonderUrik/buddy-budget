# Authentication & Onboarding
Status: draft · Source: app/(auth)/login, app/(auth)/onboarding, app/(auth)/accetta-termini, app/(auth)/account-disattivato, app/(auth)/layout.tsx, app/disiscrizione, app/api/auth/[...all], app/api/user/onboarding, app/api/user/legal-acceptance, app/api/user/reactivate, app/api/email/unsubscribe, components/domain/auth, components/domain/categories/category-setup-*, components/domain/notifications, components/domain/settings/{locale-fields,deactivated-account-panel}.tsx, lib/auth, lib/legal, lib/account/{constants,inactivity-policy,lifecycle,emails,recent-login,route-session}.ts, lib/notifications/{constants,token,store}.ts, proxy.ts

## Purpose
Let a person get into BuddyBudget **without a password** (one-time email magic link, or Google), create the account implicitly on first sign-in, complete a short onboarding (country/language/currency, starter categories, optional AI categorisation consent, optional emails, mandatory legal declarations), and handle the gated account states: legal re-acceptance when `LEGAL_VERSION` changes, deactivated account (30-day grace), inactive-account deletion, and one-click email unsubscribe without login.

**There is no password, no sign-up form and no password reset.** "Password reset" does not exist in the web app: the only credentials are a magic link sent to the email (valid 10 minutes, single use) and Google OAuth. Losing access to the mailbox can only be resolved by writing to `privacy@buddybudget.io` (rectification request, see 15-settings).

## Entry points & navigation
- Any protected URL without a session → `/login?redirect=<path>` (pages) or HTTP 401 (APIs).
- `/login` while already signed in → redirected to the validated `redirect` target (default `/`, which forwards to the user's home page).
- After sign-in: if `onboardingCompleted=false` → every page redirects to `/onboarding` (APIs pass through). If completed, `/onboarding` redirects to `/`.
- If onboarding completed and `legalAcceptedVersion ≠ LEGAL_VERSION` → every page redirects to `/accetta-termini`; APIs return 403 except `/api/user/legal-acceptance`, `/api/user/export`, `/api/user/account`. Visiting `/accetta-termini` when not needed → `/`.
- If `deletionScheduledAt` is set (deactivated) → every page redirects to `/account-disattivato`; every API returns 403 except `POST /api/user/reactivate` (and `/api/auth/*`, public, used for sign-out). Visiting `/account-disattivato` when not deactivated → `/`.
- Precedence of gates (proxy order): no session → deactivated → legal re-acceptance → onboarding → country path availability.
- Public (no session) paths: `/login`, `/api/auth/*`, `/api/health*`, `/api/cron/*`, `/api/metrics`, `/api/email/*`, `/disiscrizione`.
- Sign-out («Esci») exists in the app sidebar / mobile «Altro» menu, on `/accetta-termini` and on `/account-disattivato`; always lands on `/login`.
- Email links: magic link email («Accedi»), lifecycle emails («Riattiva account» / «Accedi a BuddyBudget» → `/login`), notification emails («Disattiva queste email» → `/disiscrizione?t=`).

## Screens

### Auth frame (shared layout of login / onboarding / accetta-termini / account-disattivato)
- Left panel: brand row (logo + «BuddyBudget», links to landing `https://buddybudget.io`; aria label `{0}: torna al sito`) with a language picker on the right (`Lingua`, options Italiano / English / Deutsch). The picker is hidden on `/onboarding`. Changing language writes the `bb-language` cookie (1 year) and reloads.
- Foot links: `Torna al sito` (landing), `Sicurezza` (landing `/sicurezza`), `Codice aperto` (landing `/#codice`), `Aiuto` (landing `/#domande`).
- Right side (desktop ≥ lg only, not on `/onboarding`): animated preview of the Overview with fictional data — `Patrimonio netto` total composing row by row: `Liquidità · 3 conti` 22 706,19; `Investimenti · 3 posizioni` 35 431,71; `Previdenza · 1 fondo` 11 082,07; `Debiti · 3 debiti` −39 937,23 (EUR), caption `6 di 6 · con i dati di una persona inventata` / `E in tutto, quanto ho?`. Reduced motion shows the final state immediately. Hidden on phones.

### Login (`/login`)
- Optional notice above the form when `?account=eliminato`: `Il tuo account e tutti i tuoi dati sono stati eliminati.`
- Title `Entra in BuddyBudget`; subtitle `Un link via email, nessuna password. Se è la prima volta, l'account si crea da solo.`
- Field `Email` (type email, required, placeholder `nome@esempio.it`, autofocus); hint `Il link vale {0} minuti e si usa una volta sola.` (10).
- Primary button `Mandami il link` (loading `Invio in corso…`). Calls better-auth magic link sign-in with `callbackURL = redirect target`.
- Divider `oppure`; button `Continua con Google` (loading `Reindirizzamento…`). Google is only offered by the server when Google credentials are configured (UI currently always shows the button).
- Legal note: `Continuando accetti i Termini di servizio e confermi di aver letto la Privacy. Usiamo solo strumenti tecnici.` (links to landing `/termini`, `/privacy`, `/cookie`, new tab).
- Errors (inline under the field, replaces hint):
  - HTTP 429: `Troppi tentativi ravvicinati. Riprova tra qualche minuto.`
  - other send error: `Non siamo riusciti a inviare il link. Controlla l'indirizzo e riprova.`
  - network: `Connessione non riuscita. Controlla la rete e riprova.`
  - Google error: `Accesso con Google non riuscito. Riprova o usa l'email.`
- While any request is pending, both buttons and the field are disabled.
- **Sent state** (only after the server confirmed sending): icon, title `Controlla la tua email`, text `Abbiamo inviato un link di accesso a <email>. Resta valido per 10 minuti.`, `Non lo trovi? Guarda anche nella cartella spam.`; button `Invia di nuovo il link` disabled for a 30 s cooldown showing `Invia di nuovo tra {0}s`; button `Usa un'altra email` returns to the form (email kept).
- Magic link email: subject `Il tuo link di accesso a BuddyBudget`, title `Accesso`, CTA `Accedi`, `Il link vale **10 minuti** e funziona una sola volta.`, footnote `Se non l'hai chiesto tu, ignora questa email: senza il link nessuno può entrare.`
- `redirect` validation (`safeRedirectPath`): only internal paths starting with `/` (not `//`, not `/\`); `/`, `/login*`, `/onboarding*` collapse to `/`.
- **«Rientra in BuddyBudget»** (web #398): after signing out or an expired session, the login opens on the account remembered on this device (email and last sign-in method in device storage only, never on the server; written at every successful sign-in). Title `Rientra in BuddyBudget`, text `Su questo dispositivo ricordiamo il tuo account, così non devi riscrivere l'email.`, an account card with the initial of the email, the masked email (first up to 3 characters of the local part, then `•••`, then `@domain`: `dan•••@gmail.com`) and `Ultimo accesso con il link via email` / `Ultimo accesso con Google`, the main button repeating the last method (`Mandami il link`, or `Continua con Google` with `Mandami il link via email` under `oppure`), the hint `Il link arriva a questo indirizzo e vale {0} minuti.`, and `Non sei tu? Usa un altro account` (forgets the account and shows the normal form). Mobile adaptation: the method is the emailed code — main button `Mandami il codice`, card line `Ultimo accesso con il codice via email`, hint `Il codice arriva a questo indirizzo e vale {0} minuti.`; it then continues to the normal code step. Deleting the account forgets it.
- First sign-in of an unknown email/Google account creates the user with defaults: country `IT`, language `it`, currency `EUR`, home page `/panoramica`, `hideAmounts=false`, `onboardingCompleted=false`, and seeds default categories.
- Google with an email that already exists links to that account (account linking enabled, user info updated on link).

### Onboarding (`/onboarding`)
Header `Ti diamo il benvenuto` + step progress (`Passi dell'onboarding`). Steps (5, or 6 when the AI service is available on the server — `GET /api/user/ai-categorization` → `available`; the «Interessi» step was added by web #444):
1. **Valuta e paese** — `In che valuta vuoi vedere i tuoi soldi?` / `Vale per saldi, transazioni e investimenti.`
   - `Paese del prodotto`: `Italia` | `Germania` | `Altro paese` (web #465); `Lingua`: options depend on country (IT → Italiano, English; DE → English, Deutsch; OTHER → English, Italiano, Deutsch). Switching country to one that does not support the current language forces English. Note: `Il paese determina le funzioni finanziarie disponibili. La lingua cambia solo i testi e i formati.` When DE: `Per la Germania, tasse, pensione, previsioni dei dividendi e pianificazione del pensionamento non sono ancora disponibili. I dati esistenti vengono conservati.`
   - Changing language/country updates the UI language immediately (client-side; persisted only on final submit).
   - Currency picker (radio tiles, `Valuta principale`): `€ Euro EUR` (preselected), `$ Dollaro USA USD`, `£ Sterlina britannica GBP`, `CHF Franco svizzero CHF`.
   - Country and language as two rows (web #397): `Paese` (hint `Decide tasse e funzioni disponibili.`) and `Lingua` (hint `Cambia solo testi, date e numeri.`), the language opening a list of every language — name in its own language and, under it, today's date (`d MMM y`) and `1.234,56` in the chosen currency as that language writes them; a language not offered for the country is greyed with `Disponibile col paese {0}`. (Flags next to countries and languages are visual, Phase 4R.)
2. **Interessi** (web #444) — `Cosa vuoi tenere sotto controllo?` / `Scegli quante cose vuoi: in Panoramica ti diciamo da dove partire. Puoi cambiarle quando vuoi.` Toggle tiles, several at once, none allowed: `Spese e conti` (`Dove vanno i soldi ogni mese, per categoria.`, wallet icon), `Investimenti` (`ETF, azioni, BTP e crypto, con rendimento e tasse.`, trending-up), `Mutuo e prestiti` (`Rate, interessi e quando finisci di pagare.`, credit-card), `Fondo pensione` (`Quanto hai da parte e quanto rende.`, umbrella; only where the pension section exists — not DE). Primary button `Salta` while nothing is picked, else `Continua`. The answer decides the «Primi passi» (02-overview); a pension answer left over from a country change is dropped on submit.
3. **Categorie** — `Ecco le categorie per i tuoi movimenti`; description `Ne abbiamo preparate {0}, divise per tipo di spesa. Puoi iniziare con queste.` (or `Ne userai {0}, divise per tipo di spesa.` once customised). Summary of enabled categories as chips grouped by expense group, then `Trasferimenti tra conti`, `Entrate`, each group header with count. Proposal is localised by country+language; changing country/language discards customisations.
   - Button `Personalizza` opens the **«Personalizza le categorie»** sheet (phone: bottom sheet; desktop: dialog), description `Spegni quelle che non usi e tocca un nome per cambiarlo.`: per group, one row per category with switch (`Usa {0}`), tap name to rename (inline input), optional description; at the bottom of each group `Aggiungi in <group>` → input `Nome, poi Invio`. Footer: `Ripristina` (disabled if unchanged) and `Fatto · N attive` (closes only; edits apply immediately).
   - Validation (enabled items only, case-insensitive, reserved name `Da categorizzare`): `Ogni categoria accesa deve avere un nome.`; `«<first 20 chars>…» è troppo lungo.` (> 40 chars); `«<name>» c'è già.`. Invalid rename/add is rejected with the inline message. If a problem exists the step shows it plus `Correggilo in «Personalizza», o prosegui con le categorie proposte.` and the original proposal is submitted.
   - Hint `Le ritrovi e le cambi quando vuoi in Liquidità → Categorie.` Primary button reads `Continua con queste` while not customised, else `Continua`.
   - New categories get icon `package`, colour slate.
4. **Assistente** (only if available) — `Vuoi un aiuto a categorizzare?` / `Puoi cambiare idea quando vuoi in Impostazioni.` Three paragraphs: `Quando arrivano movimenti nuovi dalla banca o da un file, un assistente basato su intelligenza artificiale propone una categoria per ogni esercente.`; `Quando l'app è abbastanza sicura mette la categoria da sola, e la ritrovi in Categorizza, sotto «Messe dall'app», dove puoi cambiarla. Le altre le scegli tu, una carta alla volta. Se preferisci scegliere sempre tu, lo spegni in Impostazioni.` (web #456); `Per farlo inviamo a OpenRouter solo il nome pulito dell'esercente (mai importi, date, IBAN, note o nomi di persone), in modalità zero data retention: lo ricevono solo fornitori che non conservano i dati e non li usano per l'addestramento.` (web #460). Switch `Proponi le categorie`, **off by default** (GDPR art. 7, no pre-ticked consent).
5. **Notifiche** — `Quali email vuoi ricevere?` / `Partono tutte spente. Ognuna ha il link per disattivarla e le ritrovi in Impostazioni.` Three switch rows, all off:
   - `Riepilogo periodico` — `Speso, entrato e investimenti, in poche righe.`; when on, a segmented control `Ogni settimana` | `Ogni mese` (default `Ogni mese`).
   - `Avvisi sul budget` — `Quando una categoria si avvicina al limite del mese.`
   - `Avvisi sulle scadenze` — `Prima della rata di un finanziamento.`
   - (Goal reminders are not offered in onboarding.)
   - Live «Nella tua casella» preview listing the emails that will arrive: `Riepilogo della settimana · Ogni lunedì` / `Riepilogo del mese · Nei primi giorni del mese`; `Avvisi sul budget · All'80% e al 100% di un budget`; `Avvisi sulle scadenze · 3 giorni prima di una rata`. Empty: `Nessuna email facoltativa. Puoi attivarle quando vuoi in Impostazioni.`
6. **Conferme** — `Ultima cosa: le conferme` / `Servono per usare l'app. Le trovi sempre in Impostazioni.` Three unticked checkboxes (all required):
   - `Dichiaro di avere almeno 18 anni.`
   - `Accetto i Termini di servizio e dichiaro di aver letto la Privacy e l'informativa sui cookie.` (links)
   - `Approvo in modo specifico, ai sensi degli artt. 1341 e 1342 del codice civile, le sezioni dei Termini: Responsabilità, Sospensione e chiusura, Modifiche ai termini, Legge applicabile, foro e contatti.`
- Navigation: `Indietro` (not on first step), primary `Continua` / last step `Inizia` (pending `Salvataggio in corso…`), disabled on last step until all three boxes are ticked.
- Submit: `POST /api/user/onboarding` with `{currency, productCountry, language, legal:{version, ageConfirmed, termsAccepted, specificClausesAccepted}, notifications:{digestEnabled, digestFrequency, budgetAlertsEnabled, deadlineAlertsEnabled}, focus: ["spese"|"investimenti"|"debiti"|"pensione"] (possibly empty), categories?: [{key,name,type,enabled}] (only if customised and valid), aiCategorization?: boolean (only if available)}`. On 200 → full reload to `/`.
- Errors: any non-OK → `Non siamo riusciti a salvare la valuta. Riprova.`; network → `Connessione non riuscita. Controlla la rete e riprova.`
- Server rules: 401 without session; 400 `Richiesta non valida` on invalid JSON; 400 `unsupported_locale` if country/language combination unsupported (IT: it|en; DE: en|de; OTHER: en|it|de); 400 `Valuta non supportata` if not EUR/USD/GBP/CHF; 400 `legal_acceptance_required` unless `version` equals current `LEGAL_VERSION` and all three flags are `true`. AI consent stored only if `true` and the service is configured. Invalid notifications payload is silently ignored (defaults all off remain). Categories payload: array ≤ 100 of `{key ≤ 40 chars|null, name ≤ 80, type, enabled}`; invalid or failing category setup never blocks onboarding (defaults remain). Starter categories are then localised to the chosen country/language.

### Legal re-acceptance (`/accetta-termini`)
- Shown to users who completed onboarding but have not accepted the current `LEGAL_VERSION` (currently `2026-10-12`); changing the version forces everyone here at next request.
- Title `Abbiamo aggiornato Termini e Privacy`; text `Per continuare a usare BuddyBudget leggi i documenti e accettali. Se non vuoi accettare puoi scaricare i tuoi dati ed eliminare l'account.`
- Same three checkboxes as onboarding. Buttons: `Accetta e continua` (disabled until all ticked; pending `Salvataggio in corso…`) → `POST /api/user/legal-acceptance` → 204 → reload `/`; `Esci` → sign out → `/login`; link `Scarica i miei dati` → `GET /api/user/export` (ZIP; requires recent login, see 15-settings).
- Error: `Non siamo riusciti a registrare l'accettazione. Riprova.`; network error as above.

### Deactivated account (`/account-disattivato`)
- Reached whenever a deactivated user has a session (including signing in again during the grace period — magic link and Google still work).
- Title `Il tuo account è disattivato`; text `Il {date} l'account e tutti i tuoi dati verranno eliminati per sempre. Fino ad allora puoi riattivarlo e ritrovare tutto com'era.` (long localised date).
- `Riattiva account` → `POST /api/user/reactivate` (clears the deletion date; 204 also if not deactivated) → reload `/`. Error message from server/fallback `Riattivazione non riuscita` shown in a red box.
- `Esci` → sign out → `/login`.
- After the scheduled date a daily cron permanently deletes the account; signing in afterwards with the same email creates a brand-new empty account.

### Inactive accounts (user-visible behaviour; no in-app UI)
- Any session creation or daily session refresh counts as activity.
- After **83 days** without activity (90 − 7) the user receives the email `Il tuo account BuddyBudget sta per essere eliminato` (title `Account inattivo`, CTA `Accedi a BuddyBudget` → `/login`) stating the deletion date.
- Deletion happens at **90 days** of inactivity, but never earlier than 7 days after the warning. Any sign-in after the warning cancels it. After deletion the email `Il tuo account BuddyBudget è stato eliminato` is sent (backups overwritten within 14 days).
- The cron may run in dry-run mode on the server; the app has no indicator of this.

### Unsubscribe (`/disiscrizione?t=<token>`) — public, no login
- Token = signed `<userId>.<scope>.<signature>`, scopes `digest`, `budget`, `deadlines`, `goals`, `all`; never expires.
- Valid token: title `Vuoi smettere di riceverle?`, text `Disattiviamo <scope label>. Basta un clic, non serve accedere. Le email di servizio (come il link di accesso) non si possono disattivare.` (scope label = lower-cased kind label, or `tutte le email di riepilogo e avviso`). Buttons `Disattiva queste email` (pending `Un attimo…`) → `POST /api/email/unsubscribe?t=…&source=page`; link `Preferisco scegliere cosa ricevere` → `/impostazioni?sezione=notifiche#impostazioni-notifiche` (login required).
  - Success: `Fatto, non ti scriviamo più` / `Abbiamo disattivato <scope>. Se è stato un errore, puoi riattivarle quando vuoi da Impostazioni → Notifiche. Le email di servizio (per esempio il link di accesso) restano attive: servono a usare l'account.`
  - Error: `Non siamo riusciti a disattivarle. Riprova tra poco o scrivi a privacy@buddybudget.io.`
- Invalid token: `Questo link non funziona` / `Il link è incompleto o non è più valido. Puoi disattivare le email da Impostazioni → Notifiche (serve accedere) oppure scrivere a privacy@buddybudget.io.`
- `GET /api/email/unsubscribe` never unsubscribes (303 to the page); `POST` is idempotent, also used by mail clients (RFC 8058 one-click); unknown/deleted users still get `{ok:true}`.

### Sessions & security (behavioural)
- Session lifetime 7 days without use; renewed (expiry pushed forward) at most once per day of use.
- Stored IP is truncated; sessions/verification tokens past expiry are purged.
- Rate limiting: better-auth built-in limiter (no custom config) → HTTP 429 on auth endpoints, shown as `Troppi tentativi ravvicinati…`.
- "Recent login" (session created ≤ 10 min ago) is required for export/reset/deactivate/delete (see 15-settings).

## Requirements

#### Login
- **AUTH-001** The app shall offer exactly two sign-in methods: email magic link and Google; it shall not offer password, sign-up or password-reset flows. _API: `POST /api/auth/sign-in/magic-link`, `POST /api/auth/sign-in/social`_
- **AUTH-002** The login screen shall show title `Entra in BuddyBudget`, subtitle `Un link via email, nessuna password. Se è la prima volta, l'account si crea da solo.`, an email field with hint `Il link vale 10 minuti e si usa una volta sola.`, button `Mandami il link`, divider `oppure`, button `Continua con Google` and the legal note with links to Termini, Privacy and cookie pages.
- **AUTH-003** The app shall require a syntactically valid email before requesting a magic link.
- **AUTH-004** The app shall show the «Controlla la tua email» state only after the server confirms the link was sent, including the email address and the 10-minute validity.
- **AUTH-005** The sent state shall disable `Invia di nuovo il link` for 30 seconds with a live countdown `Invia di nuovo tra {0}s`.
- **AUTH-006** `Usa un'altra email` shall return to the form keeping the typed email.
- **AUTH-007** On HTTP 429 the app shall show `Troppi tentativi ravvicinati. Riprova tra qualche minuto.`; on other send errors `Non siamo riusciti a inviare il link. Controlla l'indirizzo e riprova.`; on network failure `Connessione non riuscita. Controlla la rete e riprova.`
- **AUTH-008** On Google sign-in failure the app shall show `Accesso con Google non riuscito. Riprova o usa l'email.`
- **AUTH-009** While a sign-in request is pending, the email field and both sign-in buttons shall be disabled.
- **AUTH-010** When opened with `?account=eliminato`, the login screen shall show the notice `Il tuo account e tutti i tuoi dati sono stati eliminati.`
- **AUTH-011** The post-login destination shall be the requested internal path if safe (starts with `/`, not `//` or `/\`, not `/`, `/login*`, `/onboarding*`), otherwise `/` (user's home page).
- **AUTH-012** A signed-in user opening the login screen shall be sent directly to the destination of AUTH-011.
- **AUTH-013** Signing in with an unknown email or Google account shall create the account with defaults IT / it / EUR / home `/panoramica` / amounts visible / onboarding not completed, and seed the default categories.
- **AUTH-014** Signing in with Google using an email that already has an account shall sign into that same account (linking Google to it).
- **AUTH-015** The auth screens shall offer a language selector (Italiano, English, Deutsch) that changes the UI language before sign-in; it shall be hidden during onboarding. Until the user picks one, the language is the one proposed for the visitor's country (AUTH-061); a language picked by hand always wins and is remembered on the device.
- **AUTH-016** The auth screens shall show the links `Torna al sito`, `Sicurezza`, `Codice aperto`, `Aiuto` to the public website.

#### Session & gating
- **AUTH-017** A session shall expire after 7 days without use and be extended at most once per day of use.
- **AUTH-018** Requests without a valid session shall lead to the login screen (keeping the requested destination); API calls shall receive 401.
- **AUTH-019** A user with onboarding not completed shall be routed to onboarding from any screen; a user with onboarding completed shall never see onboarding again.
- **AUTH-020** A user who completed onboarding but has not accepted the current legal version shall be routed to the legal re-acceptance screen from any screen; other APIs shall return 403 except legal acceptance, export and account deletion.
- **AUTH-021** A deactivated user shall be routed to the deactivated-account screen from any screen; all APIs except reactivation and auth shall return 403.
- **AUTH-022** Gates shall be evaluated in the order: session → deactivated → legal re-acceptance → onboarding → country availability.
- **AUTH-023** Sign-out shall end the current session and show the login screen.

#### Onboarding
- **AUTH-024** (changed by web #444) Onboarding shall show the steps Valuta, Interessi, Categorie, [Assistente], Notifiche, Conferme, with the Assistente step present only when the AI service is available. _API: `GET /api/user/ai-categorization`_
- **AUTH-025** Onboarding shall show a step progress indicator and allow going back with `Indietro` from every step except the first, preserving entered values.
- **AUTH-026** (changed by web #465) The first step shall offer product country (Italia, Germania, Altro paese — each with its flag, a globe for Altro paese), language filtered by country (IT: Italiano, English; DE: English, Deutsch; OTHER: English, Italiano, Deutsch) and currency (EUR, USD, GBP, CHF) with EUR preselected and country/language preselected from the proposed profile (AUTH-061).
- **AUTH-027** Changing country to one that does not support the selected language shall set language to English.
- **AUTH-028** (changed by web #465) Under the country and language rows the first step shall show the chosen country's note (`COUNTRY_UNAVAILABLE_NOTES`): DE `Per la Germania la pensione non è ancora disponibile. I dati esistenti vengono conservati.`, OTHER `Tasse e pensione seguono le regole italiane e tedesche: per il tuo paese arriveranno presto. Tutto il resto funziona.`, nothing for IT.
- **AUTH-029** Changing language in onboarding shall immediately re-render the onboarding UI in that language.
- **AUTH-030** The categories step shall show the localised proposal of enabled categories grouped by expense groups, then `Trasferimenti tra conti`, then `Entrate`, with per-group counts.
- **AUTH-031** `Personalizza` shall open a sheet where each category can be toggled, renamed, and new categories added per group; `Ripristina` shall restore the proposal; `Fatto · N attive` shall close the sheet.
- **AUTH-032** Category names of enabled items shall be required, ≤ 40 characters, unique case-insensitively and different from `Da categorizzare`; a rejected rename/add shall show the reason and not change the list.
- **AUTH-033** The categories primary button shall read `Continua con queste` when the proposal is unchanged and `Continua` otherwise.
- **AUTH-034** Changing country or language shall reset category customisations to the new localised proposal.
- **AUTH-035** (changed by web #456/#460) The assistant step switch `Proponi le categorie` shall be off by default and explain, with the specified paragraphs, what the assistant does, that the app applies categories it is fairly sure about, and that only the cleaned merchant name goes to OpenRouter with zero data retention.
- **AUTH-036** The notifications step shall offer `Riepilogo periodico` (with `Ogni settimana`/`Ogni mese`, default monthly, shown only when on), `Avvisi sul budget`, `Avvisi sulle scadenze`, all off by default.
- **AUTH-037** The notifications step shall show a live inbox preview of the emails that will be received, or `Nessuna email facoltativa. Puoi attivarle quando vuoi in Impostazioni.` when none.
- **AUTH-038** The confirmations step shall show three unticked checkboxes (age ≥ 18, Termini/Privacy/cookie, specific approval of the listed clauses) and the final `Inizia` button shall be disabled until all three are ticked.
- **AUTH-039** On `Inizia` the app shall submit country, language, currency, legal declaration with the current `LEGAL_VERSION`, notification preferences, categories (only if customised and valid) and AI consent (only if the step was shown). _API: `POST /api/user/onboarding`_ Since web #444 the payload also carries `focus` (the Interessi answer, filtered to the options available in the chosen country).
- **AUTH-040** The server shall reject onboarding with 400 for unsupported country/language (`unsupported_locale`), unsupported currency, or incomplete/out-of-date legal declaration (`legal_acceptance_required`).
- **AUTH-041** A failure to apply custom categories shall not block onboarding (default categories remain).
- **AUTH-042** On successful onboarding the app shall reload into `/` (the user's home page) with the chosen language and country applied.
- **AUTH-043** On onboarding failure the app shall show `Non siamo riusciti a salvare la valuta. Riprova.` (network: `Connessione non riuscita. Controlla la rete e riprova.`) and stay on the last step.

#### Interessi, returning account, language list
- **AUTH-058** (web #444) The Interessi step shall offer the four answers (the pension one only where the pension section exists) as toggle tiles, allow none (`Salta`) and send the answer as `focus`. _API: `POST /api/user/onboarding`_
- **AUTH-059** (web #398) After a successful sign-in the app shall remember the email and method on the device; the login shall then open on «Rientra in BuddyBudget» with the masked email, one main button for the remembered method and `Non sei tu? Usa un altro account`, which forgets it and shows the normal form.
- **AUTH-060** (web #397) Country and language shall be two rows; the language list shall show every language with a preview of today's date and a sample amount in that language, greying the ones not offered for the country with `Disponibile col paese {0}`. (Same component in 15-settings.)

- **AUTH-061** (web #465 `detectProfile` / `proposedProfile`; mobile: device region instead of `CF-IPCountry`) Until onboarding is done the app shall propose country and language from the device region and preferred languages: IT/SM/VA → Italian, DE/AT/LI → German, CH → German or Italian following the device languages, any other region → English; product country IT for Italy, DE for Germany, OTHER for every other region (so San Marino, Austria, Switzerland → OTHER, as on the web). Without a region the device language decides (German → DE, anything else → IT; only unsupported languages → English). A language picked by hand on the sign-in screens wins, keeping the proposed country when it offers that language (else German → DE, other → IT). The proposal is never applied to an account that finished onboarding; the country changes only in Settings.

#### Legal re-acceptance
- **AUTH-044** The re-acceptance screen shall show `Abbiamo aggiornato Termini e Privacy`, the three declarations, `Accetta e continua` (enabled only when all ticked), `Esci` and `Scarica i miei dati`. _API: `POST /api/user/legal-acceptance`, `GET /api/user/export`_
- **AUTH-045** The server shall record acceptance date and version only if the payload version equals the current `LEGAL_VERSION` and all declarations are true.
- **AUTH-046** On acceptance failure the app shall show `Non siamo riusciti a registrare l'accettazione. Riprova.`
- **AUTH-062** (2026-10-22, SHELL-056) The re-acceptance screen shall also open mid-session: when any call answers `403 legal_acceptance_required` (a new `LEGAL_VERSION` while the app is open or in the background) the app shall show this screen instead of load errors, and after `Accetta e continua` return to the app and reload its data. The same holds for `403 account_deactivated` and the deactivated screen (AUTH-047).

#### Deactivated account
- **AUTH-047** The deactivated screen shall show `Il tuo account è disattivato` with the permanent deletion date and the buttons `Riattiva account` and `Esci`.
- **AUTH-048** `Riattiva account` shall cancel the scheduled deletion and open `/` with all data intact. _API: `POST /api/user/reactivate`_
- **AUTH-049** Signing in during the 30-day grace period shall be possible and shall land on the deactivated screen.
- **AUTH-050** Once the deletion date has passed the account and all data shall be permanently deleted by the server; a later sign-in shall create a new empty account.

#### Inactive accounts
- **AUTH-051** Any sign-in or session renewal shall reset the inactivity clock.
- **AUTH-052** A user inactive for 83 days shall receive the «Account inattivo» email with the deletion date; the account shall be deleted at 90 days of inactivity but never less than 7 days after the warning, unless the user signs in.

#### Unsubscribe
- **AUTH-053** The unsubscribe page shall work without sign-in and shall not change anything until the user taps `Disattiva queste email`. _API: `POST /api/email/unsubscribe?t=&source=page`_
- **AUTH-054** Unsubscribing shall turn off only the email kind in the token scope (or all optional kinds for scope `all`) and show `Fatto, non ti scriviamo più`.
- **AUTH-055** An invalid or tampered token shall show `Questo link non funziona` with directions to Impostazioni → Notifiche or `privacy@buddybudget.io`.
- **AUTH-056** A failed unsubscribe shall show `Non siamo riusciti a disattivarle. Riprova tra poco o scrivi a privacy@buddybudget.io.`
- **AUTH-057** The page shall link `Preferisco scegliere cosa ricevere` to Settings › Notifiche.

## Mobile adaptation notes
- **Proposal — needs product sign-off:** Magic link on mobile: the email link (`/api/auth/magic-link/verify?token=…`) is registered as an iOS Universal Link / Android App Link; when the app is installed it opens the app, which verifies the token and stores the session; otherwise it falls back to the web. Both platforms show the same «Controlla la tua email» screen and an `Apri l'app Mail` shortcut is not added (keep parity with web).
- **Proposal — needs product sign-off:** Google sign-in uses the native Google SDK (Sign in with Google on iOS / Credential Manager on Android) and exchanges the ID token with better-auth (`signIn.social` with `idToken`), instead of a browser redirect; on failure show the same `Accesso con Google non riuscito. Riprova o usa l'email.`
- **Proposal — needs product sign-off:** Session transport: web relies on HttpOnly cookies set by better-auth; native apps use a bearer token stored in Keychain / EncryptedSharedPreferences (better-auth `bearer` plugin, to be enabled server-side) with identical 7-day/1-day renewal semantics.
- **Proposal — needs product sign-off:** The proxy redirects are server-side page redirects; native apps derive the gate from the session payload (`onboardingCompleted`, `legalAcceptedVersion` vs a server-provided current version, `deletionScheduledAt`) at launch and after each 403, and route to the same screens in the AUTH-022 order.
- **Proposal — needs product sign-off:** The desktop-only preview panel is omitted on phones (as on web < lg); the language selector stays in the top bar of the login screen.
- **Proposal — needs product sign-off:** The «Personalizza» categories sheet is a full-height bottom sheet with drag-to-dismiss (edits already applied, as on web); `Aggiungi in <gruppo>` uses the keyboard return key to confirm.
- **Proposal — needs product sign-off:** `Scarica i miei dati` on the re-acceptance screen saves the ZIP via the system share sheet / Files (iOS) or Storage Access Framework (Android).
- **Proposal — needs product sign-off:** Unsubscribe remains a web page (it is opened from email, no login); native apps do not implement it but open Settings › Notifiche when the user taps `Preferisco scegliere cosa ricevere` with the app installed (deep link `/impostazioni?sezione=notifiche`).

## Open questions
1. Magic link verification failures (expired/used token) are handled by better-auth's default redirect (`?error=…` on the callback URL); the web UI shows no specific message. Mobile needs explicit copy — what should it say?
2. Rate limiting relies entirely on better-auth defaults (not configured; in-memory per instance, production only). Limits are therefore undocumented and may differ per deployment; mobile retry/backoff behaviour should be confirmed.
3. Native session transport (bearer tokens) is not enabled on the server; the `/api/user/*` routes read the session via cookie headers. Server change required before mobile can call APIs.
4. The current legal version is only known client-side as a compiled constant (`LEGAL_VERSION`); mobile apps would ship a stale constant. An endpoint exposing the current version (and the gating state) is needed.
5. The onboarding error copy `Non siamo riusciti a salvare la valuta. Riprova.` is shown for every failure (including legal or locale 400s); confirm whether mobile should differentiate.
6. `Continua con Google` is always shown in the UI even when the server has no Google credentials (the call then fails). Should clients hide it based on a server capability flag?
7. CLAUDE.md describes the login as «Il foglio» (spreadsheet with formula bar, email as cell B6), but the current code shows a Panoramica preview window (`AuthPreview`); spec follows the code.
8. Inactivity cron may run in `dry-run` mode; product should confirm whether warning/deletion is active in production before documenting it in-app.
