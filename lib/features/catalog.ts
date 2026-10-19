/**
 * Catalogue of BuddyBudget's features: the ONLY source of truth for the landing ("Tutte le funzioni" catalogue, counts),
 * the "In arrivo" panel of the sign-in page and the consistency test with the sidebar. Data only, no dependencies: the
 * landing keeps a generated copy (`pnpm sync:features` in `landing/`), CI fails when it is out of date. When a feature
 * ships, changes status or is born, update it HERE and run the sync. Only features that count on their own: interface
 * details (search inside a section, cleaned names, shortcuts, theme) stay inside the entry they serve; the app-wide
 * «Cerca» with typed sentences is an entry of its own.
 */

export const FEATURE_AREAS = ["Liquidità", "Investimenti", "Debiti", "Patrimonio", "Account"] as const;
export type FeatureArea = (typeof FEATURE_AREAS)[number];

/** English names of the areas, for the English landing (`/en/features`). */
export const FEATURE_AREA_LABELS_EN: Record<FeatureArea, string> = {
  Liquidità: "Cash",
  Investimenti: "Investments",
  Debiti: "Debts",
  Patrimonio: "Net worth",
  Account: "Account",
};

/** `live` disponibile, `new` rilasciata da poco (badge "Nuovo"), `soon` pianificata (badge "Presto"). */
export type FeatureStatus = "live" | "new" | "soon";

/** Name and description of a feature in another language. */
export interface FeatureText {
  name: string;
  description: string;
}

export interface Feature {
  /** Identificatore stabile (kebab-case). */
  id: string;
  area: FeatureArea;
  name: string;
  description: string;
  status: FeatureStatus;
  /** Schermata dell'app che la ospita (pathname), se è una voce di sidebar: il test la confronta con `NAV_ITEMS`. */
  appPath?: string;
  /** English name and description, from `FEATURES_EN` (the landing's English features page needs one for every entry). */
  en?: FeatureText;
}

/**
 * English texts of the features, by id. When an entry is added or its Italian text changes, update its English text
 * here too: the test fails if an entry has none.
 */
const FEATURES_EN: Readonly<Record<string, FeatureText>> = {
  "csv-personali-ai": { name: "Personal CSVs with AI", description: "Upload the CSV of a bank or broker we don't know: we read it in the background and remember the institution and the columns of its format. If the saved reader fails, we try again with the AI you have authorized and send a technical report to support. If the file has your bank's own category column, transactions get the matching category right away. You get an email when the import is done." },
  "cerca-ovunque": { name: "Search everywhere, even with a sentence", description: "Find a transaction, an account, a security, a subscription or a setting from any page: ⌘K on a computer, pull the page down on the phone. Type “bought 3 Apple at 50 € today” or “paid 12 € at the café yesterday” and the form opens already filled in, in Italian, English or German, for you to check and save. For a sentence it cannot read, you can ask the AI with one tap: it only gets the sentence." },
  "dall-ultima-visita": { name: "Since your last visit", description: "When you come back, a quiet notice tells you what happened while you were away (new transactions, price alerts that went off, subscriptions that went up) and what to sort out: transactions without a category, subscriptions to confirm, imports to check. One tap and you are there." },
  "primi-passi-e-dati-d-esempio": { name: "First steps and sample data", description: "Starting without a bank? The Overview shows four steps that tick themselves off (account, transactions, investment, goal), and you can try the app with sample data that resets with one tap." },
  "demo-senza-account": { name: "Demo without an account", description: "Open the app with the data of a sample account, for Italy or Germany, in Italian, English or German, without signing up: look at everything, nothing is saved." },
  "collegamento-alla-banca": { name: "Bank connection", description: "Balances and transactions straight from your bank through Open Banking, read-only. Coming soon: until then you import the bank statement, and “Keep me posted” tells you when it is ready." },
  "conti-manuali": { name: "Manual accounts", description: "For cash, prepaid cards or any bank. Tap the account to change its balance, name and icon." },
  "categorizza-con-ai": { name: "Categorize with AI", description: "If you turn it on, the assistant suggests a category for every transaction type, including payments to people and transfers. Suggestions that are at least 70% sure apply themselves and you review them in “Set by the app”; you confirm the others with a swipe, one card at a time. It uses the cleaned counterparty name, which may name a person, and your personal instructions, which you can change in Settings." },
  "categorie-pronte": { name: "Ready-made categories", description: "When you sign up you get 24 categories already split by type of spending: confirm them with one tap, or remove, rename or add your own." },
  "categorizzazione-automatica": { name: "Automatic categorization", description: "Your rules, and categories that are at least 70% sure, apply themselves, and a new rule takes effect right away. In “Set by the app” you see what was set, with the merchant's logo, the dates and where it came from (a rule, your past choices, AI or your bank's file), and you fix it with one tap. “Recategorize” redoes the automatic categories with today's rules, with a preview and undo." },
  "quattro-gruppi-di-spesa": { name: "Four spending groups", description: "Needs, Wants, Future you and Occasional, with colors and icons you choose." },
  "trasferimenti-tra-conti": { name: "Transfers between your accounts", description: "Put transfers in their own category: they stay visible in your transactions and are left out of income and spending." },
  "dividi-e-escludi": { name: "Split and exclude", description: "Leave out all or part of refunds, transfers and shared expenses: pick Half, A third or an amount, and see right away how much is yours." },
  "budget-per-categoria": { name: "Budget per category", description: "Budgets proposed from your own months, how much you can still spend today and where the month is heading; what you don't spend on occasional costs carries over to the next month." },
  "analisi-e-cash-flow": { name: "Analysis and cash flow", description: "Income, spending, net and savings, month by month and by category." },
  "dettaglio-del-movimento": { name: "Transaction details", description: "Tap a transaction to see everything: where it came from, who chose its category and why, the bank's own text, your note and how much you spent at the same merchant in the last year. With the assistant on, you can also ask the AI which category it would pick." },
  abbonamenti: { name: "Subscriptions", description: "Finds recurring charges (streaming, gym, insurance) and you confirm them with one tap. See the cost per month and per year, the next charge and price increases. Worked out from your transactions, without AI." },
  "etf-azioni-btp-fondi-e-crypto": { name: "ETFs, stocks, government bonds, funds and crypto", description: "End-of-day prices from free sources with automatic fallback, ECB exchange rates." },
  "operazioni-e-import-csv": { name: "Trades and CSV import", description: "Record buys and sells or import your broker's files: Interactive Brokers, DEGIRO, Trade Republic, Fineco, Yahoo Finance or another CSV. Several brokers live in the same portfolio and each import is managed on its own. If you allow AI recovery, read errors start a new analysis automatically, with the financial checks kept in place." },
  "rendimenti-veri": { name: "Real returns", description: "TWR, MWR and returns after inflation in the product's country (Italy or Germany, Eurostat index), with explanations on hover. The figures follow the chart date; drag to pick a range, also for risk and monthly returns. It also shows what you'd have if costs and taxes had stayed invested." },
  "confronto-con-un-indice": { name: "Compare with an index", description: "“With the same contributions you'd have X today instead of Y.” Quick picks for the S&P 500, MSCI World, FTSE All-World and Nasdaq-100 through accumulating ETFs, or search for another instrument." },
  rischio: { name: "Risk", description: "A clear risk level (from low to very high), then how much the portfolio swings, the worst drop, whether the risk paid off and how closely it follows the index." },
  diversificazione: { name: "Diversification", description: "By region and sector, looking inside the ETFs." },
  "allocazione-obiettivo": { name: "Target allocation", description: "With a suggestion of where to put your next contribution." },
  proventi: { name: "Dividends", description: "Income received and expected over the next 12 months, month by month and by instrument, with gross, withholding tax and net." },
  "pianificazione-germania": { name: "Financial planning for Germany", description: "Essential localization in English and German: portfolio, income and 2026 tax estimates in EUR, with explicit limits. Analytics works as everywhere else, without German taxes. Pension and AVD (a German private pension product) are hidden until they have been reviewed." },
  "tasse-italiane": { name: "Italian taxes", description: "Capital gains and losses, the zainetto fiscale (four-year tax-loss carryforward), government bonds, crypto and bollo (stamp duty)." },
  "simulatore-prima-di-vendere": { name: "“Before you sell” simulator", description: "Works out the taxes again with the extra sale, before you make it." },
  "titoli-watchlist-e-avvisi": { name: "Securities, watchlist and alerts", description: "A page for each security, opened from your holdings or by search, with a chart of your purchases, risk, a watchlist and price alerts by email." },
  "indicatori-fondamentali": { name: "Fundamentals", description: "For every stock: P/E, P/S, P/B, revenue and earnings per share, margins, ROE and debt calculated from the financial statements, with the range of recent years and the calculation under each number. For ETFs: holdings, sectors, what the TER costs you and the securities you already hold elsewhere." },
  "finanziamenti-nuovi-o-in-corso": { name: "New or ongoing loans", description: "From the start or from a snapshot of today, with the amortization schedule." },
  "calcolatore-della-variabile-mancante": { name: "Missing-figure calculator", description: "From principal, payment, number of payments or rate it works out the one that's missing, with the APR (TAEG)." },
  "estinzione-anticipata": { name: "Early repayment", description: "Lower payment or shorter term, with the penalty, the interest saved and a monthly extra." },
  "simulatore-dei-debiti": { name: "Debt simulator", description: "Inside each loan: how much you save by paying more, paying off part of it or moving to another bank. In the overview, the path to getting out of debt sooner." },
  "patrimonio-netto-nel-tempo": { name: "Net worth over time", description: "Cash, investments and pension, with debts already subtracted, and the history rebuilt. Show or hide items from the legend and the total updates." },
  pensione: { name: "Pension", description: "Pension fund and TFR (Italian severance pay): real return, what you'd take home if you withdrew today after tax, and an estimate of what it will be worth. Enter the history by hand or import it from CSV or Excel." },
  analitiche: { name: "Analytics", description: "The year you could stop working, with four “what if…” sliders for savings, spending, return and withdrawal; the first three start from your data for the last 12 or 24 months, or the months you choose. For those who want more: the FIRE number after tax, Monte Carlo simulations and withdrawal rules." },
  "obiettivi-di-risparmio": { name: "Savings goals", description: "A trip, a house deposit, an emergency fund: choose how much you need, by when, and which accounts or investments the money comes from. The month's savings go to your goals in the order you choose; see when you'll reach each one, whether your savings cover everything and how much each goal moves the year you could stop working. Email reminders at the start of the month, if you want them." },
  "tuoi-dati-tuo-controllo": { name: "Your data, your control", description: "Export everything as a ZIP, or reset or delete your account with 30 days to change your mind." },
  "email-riepilogo-e-avvisi": { name: "Summary and alert emails", description: "If you want, get a summary of the month or the week, with what you spent, what came in, investment gains and dividends in a few lines, and an alert when a budget is nearly used up or a payment is about to fall due. You choose them when you first sign in, they start switched off and each one turns off with one click." },
  "piu-lingue-e-valute": { name: "Languages and currencies", description: "The Italy product in Italian and English; the Germany product in German and English; everywhere else, everything that doesn't depend on local rules, in any of the three. You start in your country's language (English outside Italy and the German-speaking countries) and change it whenever you like. Selectable currencies. For Germany: portfolio and income, partial 2026 tax estimates with explicit limits; pension on hold until review. In other countries the pension stays in the menu marked «Coming soon» and taxes are not estimated: income and Analytics work on your own figures, before tax. Unsupported cases are flagged, without applying Italian rules." },
  "notifiche-push": { name: "Push notifications", description: "Alerts on your phone, for example about prices." },
};

const f = (
  id: string,
  area: FeatureArea,
  name: string,
  description: string,
  status: FeatureStatus,
  appPath?: string,
): Feature => ({ id, area, name, description, status, ...(appPath ? { appPath } : {}), ...(FEATURES_EN[id] ? { en: FEATURES_EN[id] } : {}) });

export const FEATURES: readonly Feature[] = [
  f("setup-self-hosted", "Account", "Installazione self-hosted guidata", "Configura BuddyBudget dal terminale con un percorso in inglese a sei passi: inserisci le tue chiavi API oppure salta un servizio. OpenRouter consigliato, prezzi Yahoo senza chiave, email e altre integrazioni a scelta. Verifiche e riepilogo prima del salvataggio, avvio fino alla conferma con URL e istruzioni di accesso, worker AI incluso e stato dei servizi nelle Impostazioni.", "new"),
  f("csv-personali-ai", "Liquidità", "CSV personali con AI", "Carica il CSV di una banca o di un broker che non conosciamo: lo leggiamo in background e ricordiamo istituzione e colonne del formato. Se il lettore salvato fallisce, riproviamo con l’AI autorizzata e inviamo un report tecnico al supporto. Se il file ha la colonna con la categoria della banca, i movimenti prendono subito la categoria corrispondente. Ti avvisiamo per email a import finito.", "new"),
  f("primi-passi-e-dati-d-esempio", "Account", "Primi passi e dati d'esempio", "Dici cosa vuoi tenere sotto controllo e la Panoramica ti mostra un passo alla volta: conto, movimenti, investimenti, mutuo o fondo pensione. Ogni passo fatto ti porta al successivo, e puoi provare l'app con dati d'esempio, azzerabili con un tocco.", "new"),
  f("cerca-ovunque", "Account", "Cerca ovunque, anche con una frase", "Trovi un movimento, un conto, un titolo, un abbonamento o un'impostazione da qualsiasi pagina: ⌘K sul computer, tiri giù la pagina sul telefono. Scrivi «comprato 3 Apple a 50 € oggi» o «pagato 12 € al bar ieri» e si apre il modulo già compilato, in italiano, inglese o tedesco, da controllare e salvare. Se una frase non la capisce, con un tocco la chiedi all'AI: riceve soltanto la frase.", "new"),
  f("dall-ultima-visita", "Account", "Dall'ultima visita", "Quando torni, un avviso discreto ti dice cosa è successo mentre eri via (movimenti arrivati, avvisi di prezzo scattati, abbonamenti aumentati) e cosa c'è da sistemare: movimenti senza categoria, abbonamenti da confermare, import da controllare. Un tocco e ci sei.", "new"),
  f("demo-senza-account", "Account", "Demo senza account", "Apri l'app con i dati di un account d'esempio, per l'Italia o la Germania, in italiano, inglese o tedesco, senza registrarti: guardi tutto, non si salva niente.", "new"),
  f("collegamento-alla-banca", "Liquidità", "Collegamento alla banca", "Saldi e movimenti che arrivano da soli dalla banca con l'Open Banking, in sola lettura. Arriva presto: intanto importi l'estratto conto, e con «Tienimi aggiornato» ti scriviamo quando è pronto.", "soon"),
  f("conti-manuali", "Liquidità", "Conti manuali", "Per il contante, le carte prepagate o qualsiasi banca. Tocchi il conto e cambi saldo, nome e icona.", "live"),

  f("categorizza-con-ai", "Liquidità", "Categorizza con l'AI", "Se lo attivi, l'assistente propone una categoria per tutti i tipi di movimento, inclusi pagamenti a persone e trasferimenti. Le proposte sicure almeno al 70% si applicano da sole e le controlli in «Messe dall'app»; le altre le confermi con un gesto, una carta alla volta. Usa il nome pulito della controparte, che può essere una persona, e le tue istruzioni personali, modificabili in Impostazioni.", "new"),
  f("categorie-pronte", "Liquidità", "Categorie pronte da scegliere", "All'iscrizione trovi 24 categorie già divise per tipo di spesa: le confermi con un tocco oppure ne togli, rinomini o aggiungi.", "new"),
  f("categorizzazione-automatica", "Liquidità", "Categorizzazione automatica", "Le tue regole e le categorie sicure almeno al 70% si applicano da sole, e una regola nuova vale subito. In «Messe dall'app» vedi cosa è stato messo, con il logo dell'esercente, le date e da dove viene (regola, tue scelte, AI o file della banca), e lo correggi con un tocco. «Ricategorizza» rifà le categorie messe da sole con le regole di oggi, con l'anteprima e l'annulla.", "new"),
  f("quattro-gruppi-di-spesa", "Liquidità", "Quattro gruppi di spesa", "Dovute, Volute, Te futuro e Saltuarie, con colori e icone scelti da te.", "live"),
  f("dettaglio-del-movimento", "Liquidità", "Dettaglio del movimento", "Tocchi un movimento e vedi tutto: da dove arriva, chi ha scelto la categoria e perché, il testo della banca, la tua nota e quanto hai speso dallo stesso esercente nell'ultimo anno. Con l'assistente acceso puoi anche chiedere all'AI quale categoria sceglierebbe.", "new", "/liquidita"),
  f("trasferimenti-tra-conti", "Liquidità", "Trasferimenti tra i tuoi conti", "Assegna i giroconti alla categoria dedicata: restano visibili nei movimenti, esclusi dai conteggi di entrate e spese.", "new"),
  f("dividi-e-escludi", "Liquidità", "Dividi e escludi", "Escludi in tutto o in parte rimborsi, giroconti e spese condivise: scegli Metà, Un terzo o un importo, e vedi subito quanto è tuo.", "live"),
  f("budget-per-categoria", "Liquidità", "Budget per categoria", "Budget proposti dai tuoi mesi, quanto puoi ancora spendere oggi e dove arriva il mese; quello che non spendi nelle spese saltuarie resta per i mesi dopo.", "new"),
  f("analisi-e-cash-flow", "Liquidità", "Analisi e cash flow", "Entrate, uscite, netto e risparmio, mese per mese e per categoria.", "live", "/liquidita"),
  f("abbonamenti", "Liquidità", "Abbonamenti", "Trova gli addebiti ricorrenti (streaming, palestra, assicurazioni) e li confermi con un tocco. Vedi il costo al mese e all'anno, il prossimo addebito e gli aumenti di prezzo. Il calcolo parte dai tuoi movimenti, senza AI.", "new"),

  f("etf-azioni-btp-fondi-e-crypto", "Investimenti", "ETF, azioni, BTP, fondi e crypto", "Prezzi di fine giornata da fonti gratuite con riserva automatica, cambi della BCE.", "live", "/investimenti"),
  f("operazioni-e-import-csv", "Investimenti", "Operazioni e import CSV", "Registra acquisti e vendite o importa i file del tuo broker: Interactive Brokers, DEGIRO, Trade Republic, Fineco, Yahoo Finance o un altro CSV. Più broker convivono nello stesso portafoglio e gli import si gestiscono uno per uno. Se autorizzi il recupero AI, gli errori di lettura avviano automaticamente una nuova analisi, mantenendo i controlli finanziari.", "live"),
  f("rendimenti-veri", "Investimenti", "Rendimenti veri", "Rendimenti TWR, MWR e al netto dell'inflazione del paese del prodotto (Italia o Germania, indice Eurostat), con spiegazioni su hover. I numeri seguono la data del grafico; trascina per selezionare un intervallo, anche per rischio e rendimenti mensili. Mostra anche quanto varresti se costi e imposte fossero rimasti investiti.", "live"),
  f("confronto-con-un-indice", "Investimenti", "Confronto con un indice", "«Con gli stessi versamenti oggi avresti X invece di Y». Scelte rapide per S&P 500, MSCI World, FTSE All-World e Nasdaq-100 tramite ETF ad accumulazione, oppure cerca un altro strumento.", "live"),
  f("rischio", "Investimenti", "Rischio", "Un livello di rischio chiaro (da basso a molto alto), poi quanto oscilla, la perdita peggiore, se il rischio è stato ripagato e quanto segue l'indice.", "live"),
  f("diversificazione", "Investimenti", "Diversificazione", "Per area e settore guardando dentro gli ETF.", "live"),
  f("allocazione-obiettivo", "Investimenti", "Allocazione obiettivo", "Con il suggerimento di dove mettere il prossimo versamento.", "live"),
  f("proventi", "Investimenti", "Dividendi", "Proventi incassati e previsti nei prossimi 12 mesi, mese per mese e per strumento, con lordo, ritenute e netto.", "live"),
  f("pianificazione-germania", "Investimenti", "Pianificazione finanziaria Germania", "Localizzazione essenziale in inglese e tedesco: portafoglio, proventi e stime fiscali 2026 in EUR con limiti espliciti. Analitiche funziona come ovunque, senza le tasse tedesche. Pensione e AVD sono nascoste in attesa di revisione.", "new"),
  f("tasse-italiane", "Investimenti", "Tasse italiane", "Plus e minus, zaino a 4 anni, titoli di Stato, crypto e bollo.", "live"),
  f("simulatore-prima-di-vendere", "Investimenti", "Simulatore «Prima di vendere»", "Ricalcola le tasse con la vendita in più, prima di farla.", "live"),
  f("titoli-watchlist-e-avvisi", "Investimenti", "Titoli, watchlist e avvisi", "Pagina per titolo, che si apre dalle posizioni o con la ricerca, con grafico dei tuoi acquisti, rischio, watchlist e avvisi di prezzo via email.", "live"),
  f("indicatori-fondamentali", "Investimenti", "Indicatori fondamentali", "Per ogni azione P/E, P/S, P/B, ricavi e utili per azione, margini, ROE e debiti calcolati dai bilanci, con la forbice degli ultimi anni e il calcolo sotto ogni numero. Per gli ETF composizione, settori, costo del TER e titoli che hai già altrove.", "new"),

  f("finanziamenti-nuovi-o-in-corso", "Debiti", "Finanziamenti nuovi o in corso", "Dall'origine o con la fotografia di oggi, con piano di ammortamento.", "live", "/debiti"),
  f("calcolatore-della-variabile-mancante", "Debiti", "Calcolatore della variabile mancante", "Dai capitale, rata, numero di rate o tasso ricava quello che manca, con il TAEG.", "live"),
  f("estinzione-anticipata", "Debiti", "Estinzione anticipata", "Rata o durata, con penale, interessi risparmiati ed extra mensile.", "live"),
  f("simulatore-dei-debiti", "Debiti", "Simulatore dei debiti", "Dentro ogni finanziamento: quanto risparmi versando di più, estinguendo una parte o passando a un'altra banca. In panoramica il percorso per uscire prima dai debiti.", "new"),

  f("patrimonio-netto-nel-tempo", "Patrimonio", "Patrimonio netto nel tempo", "Liquidità, investimenti e previdenza (debiti già sottratti), con lo storico ricostruito. Dalla legenda mostri o nascondi le voci e il totale si aggiorna.", "live", "/panoramica"),
  f("pensione", "Patrimonio", "Pensione", "Fondo pensione e TFR: rendimento reale, quanto ritireresti oggi al netto delle tasse e una stima di quanto varrà. Lo storico lo inserisci a mano o lo importi da CSV o Excel.", "new", "/pensione"),
  f("analitiche", "Patrimonio", "Analitiche", "L'anno in cui puoi smettere di lavorare, con quattro cursori «e se…» su risparmio, spesa, rendimento e prelievo; i primi tre partono dai tuoi dati degli ultimi 12 o 24 mesi, o dei mesi che scegli. Per chi vuole di più: numero FIRE al netto delle tasse, simulazioni Monte Carlo e regole di prelievo.", "new", "/analitiche"),
  f("obiettivi-di-risparmio", "Patrimonio", "Obiettivi di risparmio", "Un viaggio, l'anticipo di casa, un fondo per gli imprevisti: scegli quanto ti serve, entro quando e da quali conti o investimenti arrivano i soldi. Il risparmio del mese va agli obiettivi nell'ordine che scegli; vedi quando arrivi a ciascuno, se il risparmio basta per tutto e di quanto ognuno sposta l'anno in cui puoi smettere di lavorare. Promemoria via email a inizio mese, se li vuoi.", "new"),

  f("tuoi-dati-tuo-controllo", "Account", "Tuoi dati, tuo controllo", "Esporti tutto in ZIP, azzeri o cancelli l'account con 30 giorni di ripensamento.", "live"),
  f("email-riepilogo-e-avvisi", "Account", "Email di riepilogo e avvisi", "Se vuoi, ricevi il riepilogo del mese o della settimana, con speso, entrato, guadagno degli investimenti e dividendi in poche righe, e un avviso quando un budget è quasi finito o una rata sta per scadere. Le scegli già al primo accesso, partono spente e ognuna si disattiva con un clic.", "new"),
  f("piu-lingue-e-valute", "Account", "Più lingue e valute", "Prodotto Italia in italiano e inglese; prodotto Germania in tedesco e inglese; negli altri paesi tutto ciò che non dipende dalle regole locali, in una delle tre lingue. Parti nella lingua del tuo paese (inglese fuori da Italia e paesi di lingua tedesca) e la cambi quando vuoi. Valute selezionabili. Per la Germania: portafoglio e proventi, stime fiscali 2026 parziali con limiti espliciti; pensione sospesa in attesa di revisione. Negli altri paesi la pensione resta nel menu con «Presto» e le tasse non vengono stimate: proventi e Analitiche lavorano sui tuoi numeri, al lordo. I casi non supportati sono indicati, senza applicare regole italiane.", "new"),
  f("notifiche-push", "Account", "Notifiche push", "Avvisi sul telefono, per esempio per i prezzi.", "soon"),
];

/** Funzioni di un'area, nell'ordine del catalogo. */
export function featuresByArea(area: FeatureArea): Feature[] {
  return FEATURES.filter((x) => x.area === area);
}

/** Funzioni con lo stato richiesto, nell'ordine del catalogo. */
export function featuresByStatus(status: FeatureStatus): Feature[] {
  return FEATURES.filter((x) => x.status === status);
}

/** Totale delle funzioni e quante sono già disponibili (live + new). */
export function featureCounts(): { total: number; available: number } {
  return { total: FEATURES.length, available: FEATURES.filter((x) => x.status !== "soon").length };
}

/** Name and description of a feature in the page language: English when the entry has it, otherwise the Italian text. */
export function featureText(feature: Feature, locale: "it" | "en"): FeatureText {
  return locale === "en" && feature.en ? feature.en : { name: feature.name, description: feature.description };
}
