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

/** Fasi della storia, nell'ordine in cui vengono mostrate. */
export const STORY_STEPS = [
  { id: "collega", label: "Collega", caption: "I movimenti arrivano dalla banca" },
  { id: "capisci", label: "Capisci", caption: "Ogni movimento diventa leggibile" },
  { id: "decidi", label: "Decidi", caption: "Vedi dove va ogni euro" },
] as const;

export type StoryPhase = (typeof STORY_STEPS)[number]["id"];

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
