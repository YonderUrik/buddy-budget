/** Indirizzi e testi della landing. Gli URL arrivano dall'env, con default di produzione. */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://buddybudget.io";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.buddybudget.io";

export const SITE_TITLE = "BuddyBudget: quanto vali, davvero?";
export const SITE_DESCRIPTION =
  "Conti, spese, investimenti, pensione e debiti in un solo quadro, con le tasse italiane già dentro. Collega la banca, categorizza i movimenti e decidi con i numeri davanti.";

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
    text: "Il tuo provider mostra solo contributi netti e controvalore? Inserisci i due numeri ogni tanto: BuddyBudget ricava versamenti e rendimento vero, ti dice quanto ti resterebbe prelevando oggi e se convengono di più il fondo o il TFR in azienda.",
    bullets: ["Stima al netto delle tasse, con una forbice onesta", "Proiezione in termini reali, dentro il patrimonio netto"],
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

export interface SecurityPoint {
  title: string;
  text: string;
}

/** Cosa fa BuddyBudget per i dati: solo fatti verificabili nel codice o nell'infrastruttura, niente promesse generiche. */
export const SECURITY = {
  kicker: "Sicurezza e privacy",
  title: "I tuoi soldi sono affari tuoi. Anche per noi.",
  intro: "Un'app che vede i tuoi conti deve meritarsi la fiducia. Ecco cosa facciamo, in concreto.",
  points: [
    { title: "Nessuna password da rubare", text: "Si entra con un link via email o con Google. Non conserviamo password." },
    { title: "Banca in sola lettura", text: "Il collegamento ai conti passa da un fornitore regolato (PSD2) e permette solo di leggere saldi e movimenti, mai di muovere denaro. Il consenso scade e lo rinnovi tu." },
    { title: "Dati in Europa", text: "App e database girano su un server in Germania. Le connessioni sono cifrate." },
    { title: "Non vendiamo i tuoi dati", text: "Niente pubblicità, niente cookie di profilazione, niente rivendita. Le statistiche d'uso sono anonime e le spegni dalle impostazioni." },
    { title: "Log senza dati personali", text: "I registri tecnici non contengono email, importi, descrizioni dei movimenti né IBAN: l'utente compare solo come codice pseudonimo." },
    { title: "Sei tu a decidere", text: "Scarichi tutto in un file, azzeri i dati o elimini l'account quando vuoi, e puoi nascondere gli importi a schermo." },
  ] satisfies readonly SecurityPoint[],
  legalNote: "Maggiori dettagli nella",
} as const;
