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
  /** Quota di previdenza dentro `total` e `monthChange` (null se non ci sono fondi): l'utente può escluderla dal totale. */
  pension: { total: number; monthChange: number | null } | null;
}

export interface SidebarSummary {
  currency: string;
  netWorth: SidebarNetWorth | null;
  portfolio: SidebarPortfolio | null;
  watchlist: SidebarWatchItem[];
  /** Avvisi di prezzo scattati su tutti i titoli. */
  triggeredAlerts: number;
}

/** Una scadenza vicina mostrata nella sidebar: una rata di un finanziamento o il rinnovo del collegamento a una banca. */
export interface SidebarDeadline {
  /** Chiave stabile per React (id del debito o della connessione). */
  id: string;
  kind: "rata" | "rinnovo";
  label: string;
  /** Data `YYYY-MM-DD`: per i rinnovi la scadenza del consenso (oggi se è già scaduto o in errore). */
  date: string;
  /** Importo della rata, null per i rinnovi. */
  amount: number | null;
  overdue: boolean;
  href: string;
}

export interface SidebarDeadlines {
  currency: string;
  items: SidebarDeadline[];
}

/** Avanzamento verso il numero FIRE, calcolato con le stesse ipotesi di Analitiche. */
export interface SidebarFire {
  currency: string;
  /** Patrimonio considerato, come in Analitiche (liquidità + investimenti, previdenza se scelta nelle ipotesi). */
  wealth: number;
  /** Numero FIRE, null se mancano i dati per stimarlo (spesa annua sconosciuta). */
  target: number | null;
  /** Patrimonio / numero FIRE, può superare 1. */
  progress: number | null;
  /** Anni stimati al numero FIRE; null se non raggiungibile o non calcolabile. */
  yearsToFire: number | null;
}
