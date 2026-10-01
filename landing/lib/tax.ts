/** Aliquote del simulatore semplificato "Prima di vendere" (percentuali). */
export const TAX_RATE = { azioni_etf: 26, titoli_stato: 12.5 } as const;
export type TaxInstrument = keyof typeof TAX_RATE;

export interface SaleEstimate {
  gain: number;
  tax: number;
  net: number;
}

/**
 * Stima semplificata dell'imposta su una vendita: aliquota sul solo guadagno, nessuna imposta su una perdita
 * (che nell'app entra nello zaino a 4 anni). Non tiene conto di minusvalenze pregresse.
 */
export function estimateSale(paid: number, value: number, instrument: TaxInstrument): SaleEstimate {
  const gain = value - paid;
  const tax = gain > 0 ? (gain * TAX_RATE[instrument]) / 100 : 0;
  return { gain, tax, net: value - tax };
}
