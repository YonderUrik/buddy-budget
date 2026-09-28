import type { InstrumentType, InvestmentTransactionType, PlanFrequency } from "@/lib/db/schema/investments";

/** Etichette dei tipi di strumento. */
export const INSTRUMENT_TYPE_LABELS: Record<InstrumentType, string> = {
  etf: "ETF",
  azione: "Azioni",
  obbligazione: "Obbligazioni",
  fondo: "Fondi",
  crypto: "Crypto",
  etc: "Materie prime (ETC)",
};

/** Etichette dei tipi al singolare, per i selettori. */
export const INSTRUMENT_TYPE_SINGULAR: Record<InstrumentType, string> = {
  etf: "ETF",
  azione: "Azione",
  obbligazione: "Obbligazione / BTP",
  fondo: "Fondo comune",
  crypto: "Crypto",
  etc: "ETC (materie prime)",
};

/** Etichette dei tipi di operazione. */
export const TRANSACTION_TYPE_LABELS: Record<InvestmentTransactionType, string> = {
  acquisto: "Acquisto",
  vendita: "Vendita",
  dividendo: "Dividendo",
  cedola: "Cedola",
  rimborso: "Rimborso",
};

/** Etichette della frequenza dei PAC. */
export const PLAN_FREQUENCY_LABELS: Record<PlanFrequency, string> = {
  mensile: "ogni mese",
  bimestrale: "ogni 2 mesi",
  trimestrale: "ogni 3 mesi",
};

/** Mesi tra due versamenti del PAC. */
export const PLAN_FREQUENCY_MONTHS: Record<PlanFrequency, number> = { mensile: 1, bimestrale: 2, trimestrale: 3 };
