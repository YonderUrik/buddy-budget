/**
 * Dati e tempi della storia animata del login ("Collega → Capisci → Decidi").
 * Tutti i movimenti sono di esempio: la UI li dichiara come tali.
 */

export interface StoryTransaction {
  /** Testo grezzo come arriva dalla banca. */
  raw: string;
  /** Nome pulito del beneficiario/ordinante. */
  merchant: string;
  category: string;
  /** Variabile CSS del colore categoria (token esistente in globals.css). */
  swatchVar: string;
  /** Importo con segno: negativo = uscita. */
  amount: number;
}

export const STORY_TRANSACTIONS: StoryTransaction[] = [
  {
    raw: "BONIFICO DA ACME SRL RIF 0934 STIPENDIO SETT",
    merchant: "Stipendio",
    category: "Entrate",
    swatchVar: "--swatch-emerald",
    amount: 2150,
  },
  {
    raw: "PAGAMENTO POS 4471 ESSELUNGA VIA ROMA MI",
    merchant: "Esselunga",
    category: "Spesa",
    swatchVar: "--swatch-amber",
    amount: -86.4,
  },
  {
    raw: "SDD CORE NETFLIX.COM 8832 AMSTERDAM NL",
    merchant: "Netflix",
    category: "Abbonamenti",
    swatchVar: "--swatch-violet",
    amount: -12.99,
  },
  {
    raw: "ADDEBITO POS 3310 ENI STATION A1 NORD",
    merchant: "Eni",
    category: "Carburante",
    swatchVar: "--swatch-orange",
    amount: -62.3,
  },
  {
    raw: "PRELIEVO ATM 0921 CIRCUITO BANCOMAT",
    merchant: "Prelievo",
    category: "Contanti",
    swatchVar: "--swatch-cyan",
    amount: -50,
  },
];

/** Id delle tre fasi di ogni capitolo della storia (le etichette cambiano per capitolo). */
export type StoryPhase = "collega" | "capisci" | "decidi";

/** Una fase della storia: etichetta nello stepper e didascalia sotto. */
export interface StoryStep {
  id: StoryPhase;
  label: string;
  caption: string;
}

/** Fasi del capitolo dei movimenti, nell'ordine in cui vengono mostrate. */
export const STORY_STEPS: readonly StoryStep[] = [
  { id: "collega", label: "Collega", caption: "I movimenti arrivano dalla banca" },
  { id: "capisci", label: "Capisci", caption: "Ogni movimento diventa leggibile" },
  { id: "decidi", label: "Decidi", caption: "Vedi dove va ogni euro" },
];

/** Versamento mensile del PAC di esempio del capitolo investimenti. */
export const PAC_STORY_MONTHLY = 150;

/**
 * Rendimenti mensili del PAC di esempio (24 mesi), con la volatilità di un portafoglio azionario: un calo di tre mesi
 * a metà percorso che porta il valore sotto il versato (fino a −153 €), poi la ripresa fino a circa +16%.
 */
export const PAC_STORY_RETURNS = [
  0.031, -0.024, 0.042, 0.018, -0.037, 0.029, 0.035, -0.052, -0.068, -0.041, 0.047, 0.058, 0.039, -0.021, 0.044, 0.027,
  -0.033, 0.049, 0.022, -0.018, 0.036, 0.041, -0.026, 0.034,
] as const;

/** Composizione per tipo del portafoglio di esempio, coi colori dei tipi della pagina Investimenti. */
export const STORY_ALLOCATION = [
  { label: "ETF", share: 0.62, swatchVar: "--swatch-blue" },
  { label: "Azioni", share: 0.18, swatchVar: "--swatch-violet" },
  { label: "BTP", share: 0.12, swatchVar: "--swatch-teal" },
  { label: "Crypto", share: 0.08, swatchVar: "--swatch-orange" },
] as const;

/** Fasi del capitolo degli investimenti. */
export const INVESTMENT_STORY_STEPS: readonly StoryStep[] = [
  { id: "collega", label: "Versa", caption: "Un PAC da 150 € al mese, per due anni" },
  { id: "capisci", label: "Cresce", caption: "Quanto aggiunge o toglie il mercato, mese per mese" },
  { id: "decidi", label: "Capisci", caption: "Il risultato e dove sono i tuoi soldi" },
];

/** Capitoli della storia, mostrati a turno: uno per ciclo. */
export const STORY_CHAPTERS = ["movimenti", "investimenti"] as const;
export type StoryChapter = (typeof STORY_CHAPTERS)[number];

/** Tempi della timeline, in millisecondi. */
export const STORY_TIMING = {
  /** Intervallo tra l'arrivo di una riga e la successiva (fase "collega"). */
  rowArrivalMs: 380,
  /** Inizio della fase "capisci", dall'avvio del ciclo. */
  understandStartMs: 2800,
  /** Intervallo tra la risoluzione di una riga e la successiva. */
  rowResolveMs: 480,
  /** Inizio della fase "decidi". */
  decideStartMs: 6000,
  /** Durata totale di un ciclo prima di ricominciare. */
  cycleMs: 11500,
} as const;
