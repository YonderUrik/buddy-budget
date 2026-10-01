/**
 * Modello del mosaico animato del login: lo stato finanziario di esempio, gli eventi che lo fanno cambiare
 * (un movimento sul conto tocca conti, patrimonio, debiti, investimenti e cash flow insieme) e i calcoli puri che
 * alimentano grafici e numeri. Nessun React: tutto deterministico e testabile. Dati di esempio, mai dati reali.
 */

/** Stato di esempio del mosaico, in euro. */
export interface MosaicState {
  checking: number;
  savings: number;
  /** Saldo della carta: negativo = da pagare. */
  card: number;
  /** Valore di mercato del portafoglio. */
  investments: number;
  /** Capitale versato nel portafoglio. */
  invested: number;
  /** Debito residuo (positivo). */
  debt: number;
  /** Numero dell'ultima rata pagata del finanziamento. */
  installment: number;
  /** Entrate e uscite del mese in corso. */
  monthIn: number;
  monthOut: number;
}

export const MOSAIC_INITIAL_STATE: MosaicState = {
  checking: 8740,
  savings: 3900,
  card: -240,
  investments: 38700,
  invested: 38118,
  debt: 21300,
  installment: 15,
  monthIn: 0,
  monthOut: 640,
};

/** Dati fissi del finanziamento di esempio. */
export const MOSAIC_DEBT = { original: 28900, installments: 48 } as const;

/** Cash flow dei mesi precedenti (entrate/uscite), per il grafico a barre. */
export const MOSAIC_PAST_MONTHS = [
  { label: "mag", income: 2100, expense: 1750 },
  { label: "giu", income: 2150, expense: 1900 },
  { label: "lug", income: 2150, expense: 1620 },
  { label: "ago", income: 2300, expense: 1980 },
  { label: "set", income: 2150, expense: 1710 },
] as const;
export const MOSAIC_CURRENT_MONTH_LABEL = "ott";
/** Valore che riempie per intero l'altezza di una barra del cash flow. */
export const MOSAIC_CASHFLOW_SCALE = 2400;

/** Un movimento di esempio e i suoi effetti sullo stato (oltre al conto corrente). */
export interface MosaicEvent {
  id: string;
  /** Testo grezzo come arriva dalla banca. */
  raw: string;
  merchant: string;
  category: string;
  /** Variabile CSS del colore categoria (token esistente in globals.css). */
  swatchVar: string;
  /** Importo con segno: negativo = uscita. */
  amount: number;
  /** Variazioni di stato oltre a `checking += amount`. */
  effects?: Partial<Record<Exclude<keyof MosaicState, "checking">, number>>;
}

/** La rata mette 640 € a debito del conto, ma toglie solo 569 € di capitale: il resto sono interessi. */
export const MOSAIC_EVENTS: readonly MosaicEvent[] = [
  {
    id: "esselunga",
    raw: "PAGAMENTO POS 4471 ESSELUNGA VIA ROMA MI",
    merchant: "Esselunga",
    category: "Spesa",
    swatchVar: "--swatch-amber",
    amount: -86.4,
    effects: { monthOut: 86.4 },
  },
  {
    id: "netflix",
    raw: "SDD CORE NETFLIX.COM 8832 AMSTERDAM NL",
    merchant: "Netflix",
    category: "Abbonamenti",
    swatchVar: "--swatch-violet",
    amount: -12.99,
    effects: { monthOut: 12.99 },
  },
  {
    id: "stipendio",
    raw: "BONIFICO DA ACME SRL RIF 0934 STIPENDIO",
    merchant: "Stipendio",
    category: "Entrate",
    swatchVar: "--swatch-emerald",
    amount: 2150,
    effects: { monthIn: 2150 },
  },
  {
    id: "eni",
    raw: "ADDEBITO POS 3310 ENI STATION A1 NORD",
    merchant: "Eni",
    category: "Carburante",
    swatchVar: "--swatch-orange",
    amount: -62.3,
    effects: { monthOut: 62.3 },
  },
  {
    id: "rata",
    raw: "ADDEBITO SDD RATA FINANZIAMENTO 15/48",
    merchant: "Rata finanziamento",
    category: "Debiti",
    swatchVar: "--swatch-red",
    amount: -640,
    effects: { debt: -569, installment: 1, monthOut: 640 },
  },
  {
    id: "pac",
    raw: "ACQUISTO ETF MSCI WORLD PAC MENSILE",
    merchant: "PAC · ETF World",
    category: "Investimenti",
    swatchVar: "--swatch-blue",
    amount: -150,
    effects: { investments: 150, invested: 150 },
  },
];

/** Variazione di mercato del portafoglio a ogni passo, a rotazione (somma positiva: il portafoglio sale piano). */
export const MOSAIC_MARKET_DRIFT = [0.004, -0.006, 0.009, 0.003, -0.004, 0.007] as const;

/** Dopo quanti giri completi di eventi lo stato torna al punto di partenza (tiene i numeri realistici). */
export const MOSAIC_RESET_EVERY_ROUNDS = 2;
/** Punti visibili nei grafici (finestra scorrevole): fissi, così il tracciato cambia valori ma non struttura. */
export const MOSAIC_NET_POINTS = 24;
export const MOSAIC_INVEST_POINTS = 20;
/** Movimenti mostrati nell'elenco. */
export const MOSAIC_FEED_SIZE = 4;

/** Tempi dell'animazione, in millisecondi. */
export const MOSAIC_TIMING = {
  /** Attesa prima del primo movimento: lascia finire l'ingresso delle tessere. */
  firstTickMs: 2300,
  /** Intervallo tra i primi movimenti, ravvicinati per mostrare subito che i numeri reagiscono. */
  rapidTickMs: 800,
  rapidTicks: 3,
  /** Intervallo a regime. */
  tickMs: 2600,
  /** Tempo in cui una riga resta "grezza" prima di diventare leggibile. */
  resolveMs: 750,
} as const;

/** Patrimonio netto: liquidità + investimenti − debiti. */
export function netWorth(s: MosaicState): number {
  return liquidity(s) + s.investments - s.debt;
}

export function liquidity(s: MosaicState): number {
  return s.checking + s.savings + s.card;
}

/** Applica un movimento allo stato (puro: restituisce un nuovo oggetto). */
export function applyEvent(state: MosaicState, event: MosaicEvent): MosaicState {
  const next: MosaicState = { ...state, checking: state.checking + event.amount };
  for (const [key, delta] of Object.entries(event.effects ?? {})) {
    next[key as keyof Omit<MosaicState, "checking">] += delta;
  }
  return next;
}

/** Quota di capitale già rimborsata del finanziamento (0-1). */
export function debtPaidShare(debt: number, original: number = MOSAIC_DEBT.original): number {
  return Math.min(1, Math.max(0, 1 - debt / original));
}

/** Tasso di risparmio del mese: null finché non ci sono entrate. */
export function monthSavingsRate(monthIn: number, monthOut: number): number | null {
  if (monthIn <= 0) return null;
  return (monthIn - monthOut) / monthIn;
}

/**
 * Serie di esempio che finisce su `end`: sale di circa `rise` (frazione di `end`) lungo `count` punti, con
 * oscillazioni deterministiche di ampiezza `amp` (frazione di `end`).
 */
export function seedSeries(end: number, count: number, rise: number, amp: number): number[] {
  return Array.from({ length: count }, (_, i) => {
    if (i === count - 1) return end;
    const progress = i / (count - 1);
    const trend = end * (1 - rise * (1 - progress));
    const wobble = end * amp * (Math.sin(i * 1.7) * 0.6 + Math.sin(i * 0.9 + 1) * 0.4);
    return trend + wobble;
  });
}

/** Aggiunge un valore in coda alla finestra scorrevole, mantenendone la lunghezza. */
export function pushWindow(values: readonly number[], value: number, size: number): number[] {
  return [...values, value].slice(-size);
}

/** Un movimento arrivato, con una chiave unica per le animazioni dell'elenco. */
export interface MosaicFeedItem {
  key: number;
  event: MosaicEvent;
}

/** Stato "vivo" del mosaico: valori correnti, finestre dei grafici ed elenco dei movimenti arrivati. */
export interface MosaicLive {
  step: number;
  state: MosaicState;
  netHistory: number[];
  investHistory: number[];
  feed: MosaicFeedItem[];
  /** Variazione del patrimonio netto causata dall'ultimo passo (0 prima del primo). */
  netDelta: number;
}

export function createMosaicLive(): MosaicLive {
  return {
    step: 0,
    state: MOSAIC_INITIAL_STATE,
    netHistory: seedSeries(netWorth(MOSAIC_INITIAL_STATE), MOSAIC_NET_POINTS, 0.09, 0.012),
    investHistory: seedSeries(MOSAIC_INITIAL_STATE.investments, MOSAIC_INVEST_POINTS, 0.03, 0.008),
    feed: [],
    netDelta: 0,
  };
}

/** Passa al movimento successivo: aggiorna stato, grafici ed elenco; ogni `MOSAIC_RESET_EVERY_ROUNDS` giri riparte da capo. */
export function advanceMosaicLive(live: MosaicLive): MosaicLive {
  const index = live.step % MOSAIC_EVENTS.length;
  const round = Math.floor(live.step / MOSAIC_EVENTS.length);
  const restart = index === 0 && round > 0 && round % MOSAIC_RESET_EVERY_ROUNDS === 0;
  const base = restart ? createMosaicLive() : live;

  const event = MOSAIC_EVENTS[index];
  const drift = MOSAIC_MARKET_DRIFT[live.step % MOSAIC_MARKET_DRIFT.length];
  const applied = applyEvent(base.state, event);
  const state: MosaicState = { ...applied, investments: Math.round(applied.investments * (1 + drift)) };

  return {
    step: live.step + 1,
    state,
    netHistory: pushWindow(base.netHistory, netWorth(state), MOSAIC_NET_POINTS),
    investHistory: pushWindow(base.investHistory, state.investments, MOSAIC_INVEST_POINTS),
    feed: [{ key: live.step + 1, event }, ...live.feed].slice(0, MOSAIC_FEED_SIZE),
    netDelta: netWorth(state) - netWorth(live.state),
  };
}

export interface LineBox {
  width: number;
  height: number;
  padX: number;
  padY: number;
}

export interface LinePaths {
  line: string;
  area: string;
  lastX: number;
  lastY: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Tracciato morbido (curve cubiche) e area di una serie di valori. A parità di numero di punti la struttura del path
 * è sempre la stessa, quindi si può interpolare da una serie alla successiva.
 */
export function buildLinePaths(values: readonly number[], box: LineBox): LinePaths {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const innerW = box.width - box.padX * 2;
  const innerH = box.height - box.padY * 2;
  const pts = values.map((v, i) => ({
    x: box.padX + (values.length === 1 ? innerW / 2 : (i / (values.length - 1)) * innerW),
    y: box.padY + innerH - ((v - min) / span) * innerH,
  }));

  let line = `M${round2(pts[0].x)},${round2(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    line += ` C${round2(c1.x)},${round2(c1.y)} ${round2(c2.x)},${round2(c2.y)} ${round2(p2.x)},${round2(p2.y)}`;
  }
  const last = pts[pts.length - 1];
  const first = pts[0];
  return {
    line,
    area: `${line} L${round2(last.x)},${round2(box.height)} L${round2(first.x)},${round2(box.height)} Z`,
    lastX: round2(last.x),
    lastY: round2(last.y),
  };
}
