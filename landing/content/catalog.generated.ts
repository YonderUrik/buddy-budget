// GENERATO da scripts/sync-features.mjs a partire da lib/features/catalog.ts: non modificare a mano.
/**
 * Catalogo delle funzionalità di BuddyBudget: UNICA fonte di verità per la landing (catalogo "Tutte le funzioni",
 * conteggi), il pannello "In arrivo" del login e il test di coerenza con la sidebar. Solo dati, nessuna dipendenza:
 * la landing ne tiene una copia generata (`pnpm sync:features` in `landing/`), la CI fallisce se non è allineata.
 * Quando una funzione viene rilasciata, cambia stato o nasce, si aggiorna QUI e si lancia il sync.
 */

export const FEATURE_AREAS = ["Conti", "Movimenti", "Investimenti", "Debiti", "Patrimonio", "Account"] as const;
export type FeatureArea = (typeof FEATURE_AREAS)[number];

/** `live` disponibile, `new` rilasciata da poco (badge "Nuovo"), `soon` pianificata (badge "Presto"). */
export type FeatureStatus = "live" | "new" | "soon";

export interface Feature {
  /** Identificatore stabile (kebab-case). */
  id: string;
  area: FeatureArea;
  name: string;
  description: string;
  status: FeatureStatus;
  /** Schermata dell'app che la ospita (pathname), se è una voce di sidebar: il test la confronta con `NAV_ITEMS`. */
  appPath?: string;
}

const f = (
  id: string,
  area: FeatureArea,
  name: string,
  description: string,
  status: FeatureStatus,
  appPath?: string,
): Feature => ({ id, area, name, description, status, ...(appPath ? { appPath } : {}) });

export const FEATURES: readonly Feature[] = [
  f("collegamento-alla-banca", "Conti", "Collegamento alla banca", "Importa saldi e movimenti con l'Open Banking, in sola lettura.", "live", "/conti"),
  f("avviso-rinnovo-banca", "Conti", "Avviso di rinnovo del collegamento", "Ti avvisiamo per email e in app prima che il consenso con la banca scada, con un clic per rinnovarlo.", "new"),
  f("conti-manuali", "Conti", "Conti manuali", "Per il contante o le banche che non si collegano. Si modificano a mano.", "live"),
  f("aggiornamento-automatico-e-manuale", "Conti", "Aggiornamento automatico e manuale", "Ogni 12 ore, più un pulsante per aggiornare subito.", "live"),
  f("conti-raggruppati-per-banca", "Conti", "Conti raggruppati per banca", "Con l'andamento della liquidità degli ultimi 30 giorni.", "live"),

  f("categorizzazione-automatica", "Movimenti", "Categorizzazione automatica", "Conferma un negozio una volta e le volte dopo viene riconosciuto. Le regole sono visibili e modificabili.", "live"),
  f("proposte-per-somiglianza", "Movimenti", "Proposte per somiglianza", "Riconosce lo stesso negozio anche con codici o filiali diverse.", "live"),
  f("nomi-leggibili", "Movimenti", "Nomi leggibili", "Dalle descrizioni criptiche della banca ricava il negozio (Amazon, Esselunga, il nome di chi ti ha pagato) e mostra il tipo di esercente quando la banca lo indica.", "new"),
  f("quattro-gruppi-di-spesa", "Movimenti", "Quattro gruppi di spesa", "Dovute, Volute, Te futuro e Saltuarie, con colori e icone scelti da te.", "live"),
  f("dividi-e-escludi", "Movimenti", "Dividi e escludi", "Escludi in tutto o in parte rimborsi, giroconti e spese condivise.", "live"),
  f("budget-per-categoria", "Movimenti", "Budget per categoria", "Imposta un budget e guarda quanto ne hai usato.", "live"),
  f("analisi-e-cash-flow", "Movimenti", "Analisi e cash flow", "Entrate, uscite, netto e risparmio, mese per mese e per categoria.", "live", "/movimenti"),
  f("ricerca-filtri-e-note", "Movimenti", "Ricerca, filtri e note", "Cerca per testo o categoria e aggiungi una nota a ogni movimento.", "live"),
  f("da-sistemare", "Movimenti", "Da sistemare", "Un avviso in Panoramica e nella barra laterale quando ci sono movimenti nuovi o da categorizzare, con la categoria proposta da confermare in un tocco.", "new"),

  f("etf-azioni-btp-fondi-e-crypto", "Investimenti", "ETF, azioni, BTP, fondi e crypto", "Prezzi di fine giornata da fonti gratuite con riserva automatica, cambi della BCE.", "live", "/investimenti"),
  f("operazioni-e-import-csv", "Investimenti", "Operazioni e import CSV", "Registra acquisti e vendite, importa da un file: Interactive Brokers, Yahoo Finance o un altro CSV.", "live"),
  f("rendimenti-veri", "Investimenti", "Rendimenti veri", "Del portafoglio e dei tuoi soldi, al netto dell'inflazione.", "live"),
  f("confronto-con-un-indice", "Investimenti", "Confronto con un indice", "«Con gli stessi versamenti oggi avresti X invece di Y».", "live"),
  f("rischio", "Investimenti", "Rischio", "Volatilità, caduta peggiore, Sharpe, beta e correlazione con l'indice.", "live"),
  f("diversificazione", "Investimenti", "Diversificazione", "Per area e settore guardando dentro gli ETF.", "live"),
  f("allocazione-obiettivo", "Investimenti", "Allocazione obiettivo", "Con il suggerimento di dove mettere il prossimo versamento.", "live"),
  f("proventi", "Investimenti", "Proventi", "Previsione dei dividendi a 12 mesi e incassi mese per mese.", "live"),
  f("tasse-italiane", "Investimenti", "Tasse italiane", "Plus e minus, zaino a 4 anni, titoli di Stato, crypto e bollo.", "live"),
  f("simulatore-prima-di-vendere", "Investimenti", "Simulatore «Prima di vendere»", "Ricalcola le tasse con la vendita in più, prima di farla.", "live"),
  f("titoli-watchlist-e-avvisi", "Investimenti", "Titoli, watchlist e avvisi", "Pagina per titolo con grafico e avvisi di prezzo via email.", "live"),

  f("finanziamenti-nuovi-o-in-corso", "Debiti", "Finanziamenti nuovi o in corso", "Dall'origine o con la fotografia di oggi, con piano di ammortamento.", "live", "/debiti"),
  f("calcolatore-della-variabile-mancante", "Debiti", "Calcolatore della variabile mancante", "Dai capitale, rata, numero di rate o tasso ricava quello che manca, con il TAEG.", "live"),
  f("rate-cambio-tasso-e-correzioni", "Debiti", "Rate, cambio tasso e correzioni", "Segna le rate pagate, cambia il tasso o correggi il residuo.", "live"),
  f("estinzione-anticipata", "Debiti", "Estinzione anticipata", "Rata o durata, con penale, interessi risparmiati ed extra mensile.", "live"),
  f("credit-lombard", "Debiti", "Credit Lombard", "Linea di credito con saldo variabile, interessi a fine trimestre e soglia di allerta sull'utilizzo.", "new"),
  f("simulatore-dei-debiti", "Debiti", "Simulatore dei debiti", "Surroga o nuova offerta, valanga e palla di neve su più debiti, effetto di un rialzo dell'indice.", "new"),

  f("patrimonio-netto-nel-tempo", "Patrimonio", "Patrimonio netto nel tempo", "Liquidità, investimenti e previdenza (debiti già sottratti), con lo storico ricostruito. Dalla legenda mostri o nascondi le voci e il totale si aggiorna.", "live", "/panoramica"),
  f("riepilogo-sempre-in-vista", "Patrimonio", "Riepilogo sempre in vista", "Nella barra laterale: patrimonio, portafoglio, watchlist e avvisi.", "live"),
  f("nascondi-importi", "Patrimonio", "Nascondi importi", "Oscura cifre e grafici quando qualcuno guarda lo schermo.", "live"),
  f("pensione", "Patrimonio", "Pensione", "Fondo pensione e TFR: rendimento reale, quanto ritireresti oggi al netto delle tasse e una stima di quanto varrà. Lo storico lo inserisci a mano o lo importi da CSV o Excel.", "new", "/pensione"),
  f("pianifica", "Patrimonio", "Pianifica", "Simula un cambio di lavoro, una casa o un figlio e vedi l'effetto sul patrimonio.", "soon", "/pianifica"),
  f("analitiche", "Patrimonio", "Analitiche", "Strumenti per chi ama i numeri: numero FIRE al netto delle tasse, simulazioni Monte Carlo, confronto tra regole di prelievo, rischio, costi e imposte latenti. Ogni risultato è spiegato e parte da ipotesi che decidi tu.", "new", "/analitiche"),

  f("accesso-semplice", "Account", "Accesso semplice", "Link via email o Google, senza password da ricordare.", "live"),
  f("tuoi-dati-tuo-controllo", "Account", "Tuoi dati, tuo controllo", "Esporti tutto in ZIP, azzeri o cancelli l'account con 30 giorni di ripensamento.", "live"),
  f("installabile-e-a-tema", "Account", "Installabile e a tema", "Si installa come app dal telefono e ha tema chiaro e scuro.", "live"),
  f("piu-lingue-e-valute", "Account", "Più lingue e valute", "Oggi italiano ed EUR, altre in arrivo.", "soon"),
  f("notifiche-push", "Account", "Notifiche push", "Avvisi sul telefono, per esempio per i prezzi.", "soon"),
];

/** Funzioni di un'area, nell'ordine del catalogo. */
export function featuresByArea(area: FeatureArea): Feature[] {
  return FEATURES.filter((x) => x.area === area);
}

/** Funzioni con lo stato richiesto, nell'ordine del catalogo. */
export function featuresByStatus(status: FeatureStatus): Feature[] {
  return FEATURES.filter((x) => x.status === status);
}

/** Totale delle funzioni e quante sono già disponibili (live + new). */
export function featureCounts(): { total: number; available: number } {
  return { total: FEATURES.length, available: FEATURES.filter((x) => x.status !== "soon").length };
}
