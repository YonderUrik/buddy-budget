/** Dati del riepilogo mostrato nella sidebar (portafoglio, watchlist, patrimonio). Serializzabili e senza dipendenze server. */

export interface SidebarHolding {
  instrumentId: string;
  /** Sigla breve (ticker) o, in mancanza, nome dello strumento. */
  label: string;
  name: string;
  /** Valore della posizione in valuta utente, null se manca il prezzo o il cambio. */
  value: number | null;
  /** Variazione dell'ultima chiusura rispetto alla precedente (frazione, 0,01 = 1%). */
  dayChangePct: number | null;
  /** Chiusure recenti in ordine di data, per la linea. */
  spark: number[];
  triggeredAlerts: number;
}

export interface SidebarWatchItem {
  instrumentId: string;
  label: string;
  name: string;
  currency: string;
  lastClose: number | null;
  dayChangePct: number | null;
  spark: number[];
  triggeredAlerts: number;
}

export interface SidebarPortfolio {
  totalValue: number;
  dayChange: number | null;
  dayChangePct: number | null;
  totalGain: number;
  /** Guadagno totale sul totale acquistato (frazione). */
  totalGainPct: number | null;
  /** Posizioni aperte dalla più grande. */
  holdings: SidebarHolding[];
}

export interface SidebarNetWorth {
  total: number;
  /** Differenza rispetto a circa 30 giorni fa, null se lo storico non ci arriva. */
  monthChange: number | null;
}

export interface SidebarSummary {
  currency: string;
  netWorth: SidebarNetWorth | null;
  portfolio: SidebarPortfolio | null;
  watchlist: SidebarWatchItem[];
  /** Avvisi di prezzo scattati su tutti i titoli. */
  triggeredAlerts: number;
}
