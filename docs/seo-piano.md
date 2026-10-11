# SEO e indicizzazione: audit, parole chiave, piano (2026-10-02)

Mercato: Italia, italiano. Dominio da posizionare: `buddybudget.io` (landing). `app.buddybudget.io` resta fuori dall'indice (`noindex` + `robots.txt` con `Disallow: /`, già così).

## 1. Audit tecnico della landing

| Voce | Prima | Dopo (PR) |
|---|---|---|
| Title | "BuddyBudget: quanto vali, davvero?" (nessuna parola cercata) | "BuddyBudget: app per budget, investimenti, pensione e debiti" |
| Meta description | generica | con funzioni e "tasse italiane già calcolate" |
| Canonical | assente | `/`, `/privacy`, `/termini`, `/cookie` |
| Open Graph / Twitter | senza immagine, card `summary` | `og.png` 1200×630, card `summary_large_image` |
| Dati strutturati | nessuno | JSON-LD: Organization, WebSite, SoftwareApplication (FinanceApplication, prezzo 0), FAQPage |
| Testo con parole chiave | H1 solo di marca ("Quanto vali, davvero?"), paragrafo hero generico | paragrafo hero con "app per gestire budget, investimenti, fondo pensione e debiti" + sezione FAQ (8 domande) |
| Sitemap / robots | presenti, senza `lastmod` | `lastmod` aggiunto; pagine legali escluse finché in bozza |
| Rendering | export statico: tutto il testo è già nell'HTML | invariato (ok) |
| Alt immagini | screenshot con alt descrittivo, decorative con `alt=""` | invariato (ok) |
| hreflang | non serve (solo italiano) | da aggiungere quando ci sarà l'i18n |

Resta da fare (non in questa PR):
- **Una sola pagina indicizzabile**: è il limite principale. Una landing singola compete solo sulla parola chiave di marca e su poche generiche. Servono pagine dedicate (sezione 3).
- **H1**: è un claim di marca. Si può tenere, ma ogni pagina nuova deve avere H1 con la parola chiave.
- **Core Web Vitals**: non misurabili da qui (il sandbox non raggiunge il sito). Da controllare con PageSpeed Insights / Search Console; sospetti: GSAP + Lenis (JS iniziale), 2 font variabili, hero con screenshot JPEG da 1920×1200 (valutare `srcset`/dimensioni minori, `fetchpriority=high` solo sul primo).
- **Pagine legali**: dal 2026-10-10 definitive, indicizzabili e nella sitemap (restano da far rivedere a un professionista).

## 2. Parole chiave per intento

Nota: non ho accesso a volumi di ricerca reali (servono Search Console dopo qualche settimana, o Google Keyword Planner gratuito con un account Ads). La mappa sotto è per intento, dai risultati che oggi occupano la prima pagina: elenchi "migliori app" di testate (money.it, investireoggi, ilgiornale), calcolatori di piccoli siti (sum.money, rivaluta.it, tuttocalcolato.it) e guide fiscali (fiscoinvestimenti.it, fiscomania, money.it per lo "zainetto fiscale").

| Intento | Esempi di ricerca | Difficoltà stimata | Come ci si posiziona |
|---|---|---|---|
| Marca | "buddybudget", "buddy budget app" | bassa | home (già) |
| Categoria (alta concorrenza) | "app gestione budget", "app per tenere traccia delle spese", "migliori app finanza personale" | alta | non frontale: si entra dagli elenchi altrui (sezione 4) |
| Fiscalità investimenti (informativo, lungo) | "zainetto fiscale", "come si calcolano le plusvalenze ETF", "bollo titoli calcolo", "minusvalenze 4 anni" | media | guide + calcolatore gratuito; è il tuo vantaggio unico |
| Pensione | "TFR o fondo pensione conviene", "simulatore fondo pensione", "quanto rende il mio fondo pensione", "prelievo fondo pensione tassazione" | media | guida + simulatore/pagina funzione |
| Debiti | "piano di ammortamento calcolo", "estinzione anticipata mutuo conviene", "surroga mutuo calcolo", "TAEG calcolo", "credit lombard" | media-alta | guide + calcolatori |
| Dati bancari | "collegare conto bancario app spese", "open banking cos'è" | media | pagina funzione + guida |
| Confronto | "alternative a ..." (app note), "foglio excel budget vs app" | bassa-media | pagine di confronto, onesto e senza nominare marchi in modo scorretto |

Posizionamento realistico: sulla categoria generica non si vince presto. Si vince sulle code lunghe legate a fisco, pensione e debiti, dove nessun concorrente combina budget + investimenti + tasse italiane + debiti + pensione.

## 3. Mappa di pagine da creare (in ordine di priorità)

1. **Calcolatori gratuiti pubblici** (i più forti per traffico e backlink, senza login): zainetto fiscale / imposta sulle plusvalenze; TFR vs fondo pensione; piano di ammortamento + estinzione anticipata. Riusano i motori di `lib/calc/` (già testati). Ognuno con H1 con la ricerca, spiegazione, FAQ e CTA verso l'app.
2. **Guide** (`/guide/...`, 800-1500 parole, scritte da una persona e riviste per accuratezza fiscale): zainetto fiscale spiegato; come tassare ETF e BTP; TFR o fondo pensione; estinzione anticipata e surroga; budget 50/30/20 e i quattro gruppi (Dovute, Volute, Te futuro, Saltuarie).
3. **Pagine funzione** (`/funzioni/investimenti`, `/pensione`, `/debiti`, `/budget`): una per area, con screenshot e FAQ.
4. **Confronti**: "BuddyBudget vs foglio di calcolo", "app budget vs app per investimenti".
5. **Blog/novità** solo se c'è costanza: meglio 8 pagine buone che 40 sottili.

Regole: ogni pagina con title/description propri, canonical, JSON-LD adatto (`Article`, `BreadcrumbList`, `WebApplication` per i calcolatori), link interni dalla home e tra le pagine, nel sitemap. Contenuti fiscali: avviso "stime, non consulenza" e validazione professionale prima della pubblicazione (le regole pensionistiche sono ancora ipotesi).

## 4. Cosa serve da parte tua (non è codice)

1. **Google Search Console**: aggiungi la proprietà "Dominio" `buddybudget.io` e verificala con il record DNS TXT (Cloudflare → DNS). Poi Sitemap → invia `https://buddybudget.io/sitemap.xml`. Con "Controllo URL" → "Richiedi indicizzazione" per la home. Tieni d'occhio Rendimento (query e pagine) dopo 2-4 settimane.
2. **Bing Webmaster Tools**: puoi importare la proprietà direttamente da Search Console. Conta anche per DuckDuckGo e per gli assistenti AI che usano Bing.
3. **Prima del lancio**: l'apice `buddybudget.io` deve davvero servire la landing (switch dell'apice ancora da fare, vedi stato progetto) e `www` deve reindirizzare con 301 all'apice. Fai passare le pagine legali da bozza a definitive se vuoi indicizzarle.
4. **Google Business Profile**: non serve (non hai un'attività locale).
5. **Backlink e visibilità** (il fattore che oggi pesa di più per un dominio nuovo):
   - Product Hunt (lancio in inglese, per una prima ondata e un link di autorità).
   - Community italiane: r/ItalyInvesting, r/finanza, r/personalfinanceitaly, Bogleheads Italia / forum Finanza, gruppi Telegram e Facebook di investitori ETF. Regola: partecipa e aiuta, non fare spam; condividi i calcolatori gratuiti, che sono utili anche senza l'app. Dichiara sempre che sei l'autore.
   - Dev/indie: Indie Hackers, Hacker News "Show HN" (con dettaglio tecnico: Open Banking, fisco italiano), post su dev.to/Medium in italiano sul "come ho costruito" il motore fiscale.
   - Contatta le testate con elenchi "migliori app di finanza personale" (money.it, investireoggi...) con una mail breve e una demo: vuoi essere nell'elenco quando aggiornano.
   - Directory di software (AlternativeTo, Capterra/G2 solo quando c'è una base utenti).
6. **Misurazione**: Umami sulla landing già traccia le visite; aggiungi in Search Console l'utente di servizio solo se vorrai automatizzare report (opzionale).

## 4-bis. Assistenti AI (ChatGPT, Claude, Perplexity, Gemini) — 2026-10-09

- `/llms.txt` (formato llmstxt.org) generato a ogni build da FAQ, regole italiane, metodo dei gruppi e catalogo funzioni (`landing/content/llms.ts`): non può divergere dal sito.
- `robots.txt` ammette per nome i crawler AI (GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, Google-Extended, Applebot-Extended…).
- Contenuti citabili: frasi brevi con il fatto e la fonte ufficiale (sezione «Le regole italiane»), tabella HTML vera per il confronto, FAQ in testo semplice.
- Da fare: verificare ogni mese le citazioni (chiedere agli assistenti «app per tenere conti e tasse sugli ETF in Italia»), Bing Webmaster Tools (lo usano diversi assistenti), una pagina per domanda.
- Nota: secondo fonti di settore i rich result FAQ di Google non compaiono più da maggio 2026; il markup FAQPage resta, innocuo.

## 5. Cosa NON fare
- Niente testo generato in massa o pagine duplicate per città/parola chiave: Google penalizza i contenuti sottili.
- Niente scambio o acquisto di backlink.
- Non indicizzare `app.buddybudget.io`.

## 6. Tempi realistici
Indicizzazione della home: giorni-settimane dopo l'invio in Search Console. Posizioni stabili per code lunghe: 2-4 mesi con contenuti utili e qualche backlink. Il traffico generico sulla categoria: oltre 6-12 mesi.
