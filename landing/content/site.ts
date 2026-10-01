/** Indirizzi e testi della landing. Gli URL arrivano dall'env, con default di produzione. */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://buddybudget.io";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.buddybudget.io";

export const SITE_TITLE = "BuddyBudget: quanto vali, davvero?";
export const SITE_DESCRIPTION =
  "Conti, spese, investimenti e debiti in un solo quadro, con le tasse italiane già dentro. Collega la banca, categorizza i movimenti e decidi con i numeri davanti.";

/** Destinazioni dei pulsanti verso l'app. */
export const APP_LINKS = { signup: `${APP_URL}/login`, login: `${APP_URL}/login` } as const;

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
    text: "Colleghi la banca in sola lettura. Ogni movimento entra con il testo grezzo e ne esce con un nome pulito.",
    bullets: ["Open Banking, aggiornamento ogni 12 ore", "Conti manuali per il contante"],
  },
  {
    kicker: "Capisci",
    title: "Sai dove vanno i soldi.",
    text: "Conferma un negozio una volta e BuddyBudget lo riconosce le volte dopo. Quattro gruppi di spesa e un budget per categoria.",
    bullets: ["Dovute, Volute, Te futuro, Saltuarie", "Regole visibili e modificabili"],
  },
  {
    kicker: "Investi",
    title: "Vedi quanto rende, e quanto paghi.",
    text: "Rendimento vero contro un indice, rischio e diversificazione. E l'imposta che pagheresti vendendo oggi.",
    bullets: ["Plus e minus, zaino a 4 anni, bollo", "ETF, azioni, BTP, fondi e crypto"],
  },
  {
    kicker: "Decidi",
    title: "Scegli con la penale già dentro.",
    text: "Estinguere il finanziamento riducendo la rata o la durata? Il confronto è già fatto, con interessi risparmiati e costi.",
    bullets: ["Piano di ammortamento e TAEG", "Surroga, valanga e Credit Lombard"],
  },
];

export const STORY_TEXT =
  "Per sapere quanto valevo servivano cinque posti: la banca, un foglio di calcolo, l'app dei titoli, quella del budget e un cassetto di PDF. Nessuno parlava di tasse italiane. Così ho costruito il sesto, e l'ho fatto diventare l'unico.";

export const STORY_POINTS = [
  { kicker: "Che cos'è", title: "Un solo quadro.", text: "Conti, movimenti, investimenti, debiti e patrimonio netto nello stesso posto, aggiornati insieme." },
  { kicker: "A cosa serve", title: "Decidere con i numeri davanti.", text: "Sapere dove vanno i soldi, quanto rende davvero un portafoglio e quanto costa un debito, prima di muoversi." },
  { kicker: "Cosa ti dà", title: "Tasse e rate già calcolate.", text: "Plusvalenze, zaino fiscale, ammortamento ed estinzione anticipata, senza foglio di calcolo." },
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
  { need: "Un solo patrimonio netto nel tempo", budgetApp: c("half", "Parziale"), investApp: c("half", "Parziale"), sheet: c("no", "A mano"), us: US },
];

export const FOUNDER = {
  name: "Daniele",
  role: "Fondatore e sviluppatore",
  text: "BuddyBudget nasce da un bisogno personale: avere in un solo posto conti, spese, investimenti e debiti, con le regole fiscali italiane già dentro. Si costruisce una funzione alla volta e si apre a chi ha lo stesso problema.",
  quote: "Volevo sapere quanto valgo davvero, senza aprire cinque app.",
} as const;
