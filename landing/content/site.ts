/** Indirizzi e testi della landing. Gli URL arrivano dall'env, con default di produzione. */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://buddybudget.io";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.buddybudget.io";
/**
 * Repository pubblico del codice. Vuoto finché il repo è privato: senza valore la landing non mostra nessun link
 * (così non ne pubblica uno rotto). Si attiva impostando `NEXT_PUBLIC_SOURCE_URL` (vedi `Dockerfile`).
 */
export const SOURCE_URL = process.env.NEXT_PUBLIC_SOURCE_URL ?? "";
/** Licenza del codice, mostrata accanto al link. */
export const SOURCE_LICENSE = "AGPL-3.0";

export const SITE_NAME = "BuddyBudget";
/** Title della home: marchio + parole che la gente cerca (budget, investimenti, pensione, debiti), entro ~60 caratteri. */
export const SITE_TITLE = "BuddyBudget: app per budget, investimenti, pensione e debiti";
export const SITE_DESCRIPTION =
  "Gestisci conti, spese, investimenti, fondo pensione e debiti in un'unica app, con le tasse italiane già calcolate. Collega la banca, categorizza i movimenti e conosci il tuo patrimonio netto.";
/** Immagine di anteprima per social e risultati arricchiti (1200×630, vedi `scripts/make-og-image.mjs`). */
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 630, alt: "BuddyBudget: conti, investimenti, pensione e debiti in un solo quadro" } as const;

export interface FaqItem {
  question: string;
  answer: string;
}

/** Domande frequenti: stesso testo nella sezione visibile e nei dati strutturati FAQPage (Google vuole che coincidano). */
export const FAQ: readonly FaqItem[] = [
  { question: "BuddyBudget è gratuito?", answer: "Sì, al momento l'uso è gratuito. Se in futuro cambierà, lo comunicheremo in anticipo e potrai esportare tutti i tuoi dati in ZIP." },
  { question: "Come si collega la banca?", answer: "Con l'Open Banking (PSD2), tramite un fornitore regolato. Autorizzi l'accesso presso la tua banca in sola lettura: BuddyBudget vede saldi e movimenti, non può muovere denaro e non conosce le tue credenziali. Il consenso dura al massimo 90 giorni e ti avvisiamo prima che scada." },
  { question: "Calcola le tasse italiane sugli investimenti?", answer: "Sì. Dalle tue operazioni ricava plusvalenze, zaino fiscale a quattro anni, imposta di bollo e l'imposta che pagheresti vendendo oggi. Sono stime pensate per decidere, non sostituiscono il rendiconto del tuo intermediario né un consulente." },
  { question: "Quali investimenti posso tracciare?", answer: "ETF, azioni, BTP e titoli di Stato, fondi e crypto. Vedi il rendimento vero, il confronto con un indice a parità di versamenti, rischio e diversificazione, più i proventi (dividendi e cedole)." },
  { question: "Come funziona la parte sul fondo pensione?", answer: "Il tuo fondo ti mostra spesso solo contributi netti e controvalore. Inserisci questi due numeri ogni tanto, o importa lo storico da un file CSV o Excel, e BuddyBudget ricava versamenti e rendimento, stima quanto ti resterebbe prelevando oggi al netto delle tasse e confronta il fondo con il TFR in azienda. Le regole fiscali sono stime." },
  { question: "Posso simulare l'estinzione anticipata di un finanziamento o di un mutuo?", answer: "Sì. Inserisci le condizioni del debito e vedi il piano di ammortamento, il TAEG, gli interessi risparmiati e la penale se riduci la rata o la durata, oppure se lo surroghi. C'è anche il Credit Lombard contro il tuo portafoglio." },
  { question: "Dove sono i miei dati e posso portarli via?", answer: "App e database girano su un server in Germania e le connessioni sono cifrate. Non vendiamo i dati e non facciamo pubblicità. Scarichi tutto in un file ZIP, azzeri i dati o elimini l'account dalle impostazioni, quando vuoi." },
  { question: "Funziona su telefono?", answer: "Sì. BuddyBudget si usa dal browser su computer e telefono e si installa come app (PWA) sulla schermata Home, senza passare dagli store." },
];

/** Destinazioni dei pulsanti verso l'app. */
/** Link verso l'app, con UTM per distinguere in Umami gli arrivi dalla landing. */
const LOGIN_URL = `${APP_URL}/login?utm_source=landing&utm_medium=cta`;
export const APP_LINKS = { signup: LOGIN_URL, login: LOGIN_URL } as const;

export interface TourStep {
  kicker: string;
  title: string;
  text: string;
  bullets: readonly string[];
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    kicker: "Collega",
    title: "I movimenti arrivano da soli.",
    text: "Colleghi la banca in sola lettura e ogni movimento entra con il testo grezzo dell'estratto. Per il contante c'è il conto manuale.",
    bullets: ["Open Banking, aggiornamento ogni 12 ore", "Conti manuali per contanti e risparmi"],
  },
  {
    kicker: "Capisci",
    title: "Sai dove vanno i soldi.",
    text: "Confermi un negozio una volta e dalla volta dopo BuddyBudget lo riconosce. Le spese si dividono in quattro gruppi, con un budget per categoria.",
    bullets: ["Dovute, Volute, Te futuro, Saltuarie", "Regole che vedi e puoi modificare"],
  },
  {
    kicker: "Investi",
    title: "Quanto rende, e quanto paghi.",
    text: "Il rendimento vero, confrontato con un indice a parità di versamenti, più rischio e diversificazione. E l'imposta che pagheresti vendendo oggi.",
    bullets: ["Plusvalenze, zaino fiscale a 4 anni e bollo", "ETF, azioni, BTP, fondi e crypto"],
  },
  {
    kicker: "Prepara",
    title: "Il fondo pensione, finalmente leggibile.",
    text: "Il tuo provider mostra solo contributi netti e controvalore? Inserisci i due numeri ogni tanto, o importa lo storico da CSV o Excel: BuddyBudget ricava versamenti e rendimento vero, ti dice quanto ti resterebbe prelevando oggi e se convengono di più il fondo o il TFR in azienda.",
    bullets: ["Import dello storico da CSV o Excel", "Stima al netto delle tasse, con una forbice onesta", "Proiezione in termini reali, dentro il patrimonio netto"],
  },
  {
    kicker: "Decidi",
    title: "Scegli con i conti già fatti.",
    text: "Estinguere un finanziamento riducendo la rata o la durata? Surrogarlo? Il confronto è pronto, con interessi risparmiati, penale e costi.",
    bullets: ["Piano di ammortamento e TAEG", "Surroga, valanga e Credit Lombard"],
  },
];

export const STORY = {
  title: "Il tuo patrimonio non sta in un posto solo. BuddyBudget sì.",
  text: "Conti in banca, titoli sul broker, un mutuo, un foglio di calcolo per le tasse. Ogni pezzo ha la sua app, e nessuna ti dice quanto hai davvero. BuddyBudget li mette insieme e fa i conti con le regole italiane.",
} as const;

export const STORY_POINTS = [
  { kicker: "Il problema", title: "Tutto sparso.", text: "Conti, titoli e debiti stanno in posti diversi. Qui sono insieme, e il patrimonio netto si aggiorna da solo." },
  { kicker: "Il problema", title: "Le tasse a occhio.", text: "Plusvalenze, zaino fiscale e bollo calcolati dalle tue operazioni, senza un foglio da rifare ogni anno." },
  { kicker: "Il problema", title: "Una pensione che è un grafico.", text: "Due curve e nessuna tabella: quanto hai versato, quanto rende, quanto ti resterebbe. Qui lo ricavi dai due numeri che già vedi, con le tasse in uscita." },
  { kicker: "Il problema", title: "Un debito di cui non conosci il costo.", text: "Rata, interessi ed estinzione anticipata: vedi quanto costa e quanto risparmi se lo chiudi prima." },
] as const;

export type ComparisonLevel = "yes" | "half" | "no";
export interface ComparisonCell {
  level: ComparisonLevel;
  label: string;
}
export interface ComparisonRow {
  need: string;
  budgetApp: ComparisonCell;
  investApp: ComparisonCell;
  sheet: ComparisonCell;
  us: ComparisonCell;
}
const c = (level: ComparisonLevel, label: string): ComparisonCell => ({ level, label });
const US = c("yes", "Sì");

/** Confronto per categorie di prodotto, non per singoli nomi: va verificato con l'analisi di mercato prima del lancio. */
export const COMPARISON_ROWS: readonly ComparisonRow[] = [
  { need: "Conti collegati alla banca", budgetApp: c("yes", "Sì"), investApp: c("half", "Spesso"), sheet: c("no", "A mano"), us: US },
  { need: "Categorie e budget mensile", budgetApp: c("yes", "Sì"), investApp: c("no", "No"), sheet: c("no", "A mano"), us: US },
  { need: "Rendimento e rischio degli investimenti", budgetApp: c("no", "Di rado"), investApp: c("yes", "Sì"), sheet: c("no", "A mano"), us: US },
  { need: "Tasse italiane e zaino fiscale", budgetApp: c("no", "No"), investApp: c("half", "Poche"), sheet: c("no", "A mano"), us: US },
  { need: "Ammortamento ed estinzione anticipata", budgetApp: c("no", "No"), investApp: c("no", "No"), sheet: c("half", "A mano"), us: US },
  { need: "Fondo pensione e TFR, con le tasse sul riscatto", budgetApp: c("no", "No"), investApp: c("no", "No"), sheet: c("no", "A mano"), us: US },
  { need: "Un solo patrimonio netto nel tempo", budgetApp: c("half", "Parziale"), investApp: c("half", "Parziale"), sheet: c("no", "A mano"), us: US },
];

/** Illustrazione animata del riquadro (vedi `SecurityArt`). */
export type SecurityArtId = "password" | "bank" | "europe" | "sell" | "logs" | "control";

export interface SecurityPoint {
  art: SecurityArtId;
  title: string;
  text: string;
}

/** Cosa fa BuddyBudget per i dati: solo fatti verificabili nel codice o nell'infrastruttura, niente promesse generiche. */
export const SECURITY = {
  kicker: "Sicurezza e privacy",
  title: "I tuoi soldi sono affari tuoi. Anche per noi.",
  intro: "Un'app che vede i tuoi conti deve meritarsi la fiducia. Ecco cosa facciamo, in concreto.",
  points: [
    { art: "password", title: "Nessuna password da rubare", text: "Si entra con un link via email o con Google. Non conserviamo password." },
    { art: "bank", title: "Banca in sola lettura", text: "Il collegamento ai conti passa da un fornitore regolato (PSD2) e permette solo di leggere saldi e movimenti, mai di muovere denaro. Il consenso scade e lo rinnovi tu." },
    { art: "europe", title: "Dati in Europa", text: "App e database girano su un server in Germania. Le connessioni sono cifrate." },
    { art: "sell", title: "Non vendiamo i tuoi dati", text: "Niente pubblicità, niente cookie di profilazione, niente rivendita. Le statistiche d'uso sono anonime e le spegni dalle impostazioni." },
    { art: "logs", title: "Log senza dati personali", text: "I registri tecnici non contengono email, importi, descrizioni dei movimenti né IBAN: l'utente compare solo come codice pseudonimo." },
    { art: "control", title: "Sei tu a decidere", text: "Scarichi tutto in un file, azzeri i dati o elimini l'account quando vuoi, e puoi nascondere gli importi a schermo." },
  ] satisfies readonly SecurityPoint[],
  legalNote: "Maggiori dettagli nella",
} as const;
