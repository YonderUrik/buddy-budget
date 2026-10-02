/** Aliquote dei redditi diversi di natura finanziaria (percentuali). */
export const ZAINETTO_RATES = { azioni_etf: 26, titoli_stato: 12.5 } as const;
export type ZainettoInstrument = keyof typeof ZAINETTO_RATES;

/** Le minusvalenze si portano in compensazione fino al quarto anno successivo a quello in cui sono state realizzate. */
export const LOSS_CARRY_YEARS = 4;

export interface LossInput {
  /** Anno in cui la minusvalenza è stata realizzata. */
  year: number;
  amount: number;
}

export interface LossUse {
  year: number;
  amount: number;
  used: number;
  /** Ultimo anno in cui si può ancora compensare. */
  expiresYear: number;
  expired: boolean;
}

export interface ZainettoResult {
  /** Plusvalenza prima delle compensazioni. */
  gain: number;
  /** Minusvalenze effettivamente compensate. */
  compensated: number;
  taxableGain: number;
  tax: number;
  /** Imposta evitata grazie alle minusvalenze. */
  taxSaved: number;
  /** Minusvalenze ancora riportabili dopo questa compensazione. */
  remaining: number;
  losses: LossUse[];
}

/**
 * Stima della compensazione con lo zainetto fiscale: le minusvalenze non scadute si usano dalla più vecchia
 * (la scadenza arriva prima) contro la plusvalenza dell'anno. Semplificata: una sola categoria di reddito,
 * nessun arrotondamento di legge né regole speciali sui titoli di Stato.
 */
export function computeZainetto(params: { taxYear: number; gain: number; instrument: ZainettoInstrument; losses: LossInput[] }): ZainettoResult {
  const { taxYear, instrument } = params;
  const gain = Math.max(0, params.gain);
  const rate = ZAINETTO_RATES[instrument] / 100;
  let room = gain;
  let compensated = 0;
  const losses = [...params.losses]
    .filter((l) => l.amount > 0)
    .sort((a, b) => a.year - b.year)
    .map<LossUse>((l) => {
      const expiresYear = l.year + LOSS_CARRY_YEARS;
      const expired = taxYear > expiresYear;
      const usable = !expired && l.year <= taxYear;
      const used = usable ? Math.min(l.amount, room) : 0;
      room -= used;
      compensated += used;
      return { year: l.year, amount: l.amount, used, expiresYear, expired };
    });
  const taxableGain = gain - compensated;
  const remaining = losses.reduce((s, l) => s + (l.expired ? 0 : l.amount - l.used), 0);
  return { gain, compensated, taxableGain, tax: taxableGain * rate, taxSaved: compensated * rate, remaining, losses };
}
