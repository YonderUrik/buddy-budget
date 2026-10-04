import type { InstrumentType, InvestmentTransactionType } from "@/lib/db/schema/investments";

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
  split: "Split",
};

/** Periodo del grafico all'apertura di Investimenti: il layout e la scheda Portafoglio condividono la query. */
export const INVESTMENTS_DEFAULT_PERIOD = "3mesi" as const;
