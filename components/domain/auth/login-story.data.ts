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

/** Un'operazione di investimento nella storia: riga grezza del broker, poi strumento col suo valore di oggi. */
export interface StoryInvestment {
  /** Testo grezzo come nell'estratto del broker. */
  raw: string;
  name: string;
  /** Tipo di strumento (ETF, Azione, BTP, Crypto). */
  kind: string;
  /** Variabile CSS del colore del tipo, la stessa della pagina Investimenti. */
  swatchVar: string;
  /** Quanto hai pagato, in euro. */
  cost: number;
  /** Valore alla chiusura di ieri, in euro. */
  value: number;
}

export const STORY_INVESTMENTS: StoryInvestment[] = [
  {
    raw: "ACQ 10 VWCE XETRA @ 95,50 EUR",
    name: "Vanguard FTSE All-World",
    kind: "ETF",
    swatchVar: "--swatch-blue",
    cost: 955,
    value: 1210,
  },
  {
    raw: "PAC SWDA MIL 150,00 EUR X 12",
    name: "iShares Core MSCI World",
    kind: "ETF",
    swatchVar: "--swatch-blue",
    cost: 1800,
    value: 2160,
  },
  {
    raw: "ACQ 3 AAPL NASDAQ @ 178,20 USD",
    name: "Apple",
    kind: "Azione",
    swatchVar: "--swatch-violet",
    cost: 492,
    value: 603,
  },
  {
    raw: "SOTTOSCR BTP 1.000 NOM @ 99,80",
    name: "BTP 2030",
    kind: "BTP",
    swatchVar: "--swatch-teal",
    cost: 998,
    value: 1011,
  },
  {
    raw: "ACQ 0,015 BTC-EUR @ 58.400",
    name: "Bitcoin",
    kind: "Crypto",
    swatchVar: "--swatch-orange",
    cost: 876,
    value: 812,
  },
];

/** Fasi del capitolo degli investimenti. */
export const INVESTMENT_STORY_STEPS: readonly StoryStep[] = [
  { id: "collega", label: "Registra", caption: "Inserisci acquisti e PAC" },
  { id: "capisci", label: "Segui", caption: "Ogni sera i prezzi di chiusura" },
  { id: "decidi", label: "Capisci", caption: "Quanto hai messo e quanto ha fatto il mercato" },
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
