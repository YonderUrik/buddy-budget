/**
 * Catalogo delle funzioni di BuddyBudget: UNICA fonte di verità per la landing (catalogo "Tutte le funzioni",
 * conteggi, riquadri). Quando si rilascia, cambia stato o si pianifica una funzione si aggiorna questo file (regola
 * in CLAUDE.md). Il login e la sidebar dell'app possono leggere da qui invece di tenere liste proprie.
 */

export const FEATURE_AREAS = ["Conti", "Movimenti", "Investimenti", "Debiti", "Patrimonio", "Account"] as const;
export type FeatureArea = (typeof FEATURE_AREAS)[number];

/** `live` disponibile, `new` rilasciata da poco (badge "Nuovo"), `soon` pianificata (badge "Presto"). */
export type FeatureStatus = "live" | "new" | "soon";

export interface Feature {
  area: FeatureArea;
  title: string;
  description: string;
  status: FeatureStatus;
}

const f = (area: FeatureArea, title: string, description: string, status: FeatureStatus = "live"): Feature => ({
  area,
  title,
  description,
  status,
});

export const FEATURES: readonly Feature[] = [
  f("Conti", "Collegamento alla banca", "Importa saldi e movimenti con l'Open Banking, in sola lettura."),
  f("Conti", "Conti manuali", "Per il contante o le banche che non si collegano. Si modificano a mano."),
  f("Conti", "Aggiornamento automatico e manuale", "Ogni 12 ore, più un pulsante per aggiornare subito."),
  f("Conti", "Conti raggruppati per banca", "Con l'andamento della liquidità degli ultimi 30 giorni."),

  f("Movimenti", "Categorizzazione automatica", "Conferma un negozio una volta e le volte dopo viene riconosciuto. Le regole sono visibili e modificabili."),
  f("Movimenti", "Proposte per somiglianza", "Riconosce lo stesso negozio anche con codici o filiali diverse."),
  f("Movimenti", "Quattro gruppi di spesa", "Dovute, Volute, Te futuro e Saltuarie, con colori e icone scelti da te."),
  f("Movimenti", "Dividi e escludi", "Escludi in tutto o in parte rimborsi, giroconti e spese condivise."),
  f("Movimenti", "Budget per categoria", "Imposta un budget e guarda quanto ne hai usato."),
  f("Movimenti", "Analisi e cash flow", "Entrate, uscite, netto e risparmio, mese per mese e per categoria."),
  f("Movimenti", "Ricerca, filtri e note", "Cerca per testo o categoria e aggiungi una nota a ogni movimento."),

  f("Investimenti", "ETF, azioni, BTP, fondi e crypto", "Prezzi di fine giornata da fonti gratuite con riserva automatica, cambi della BCE."),
  f("Investimenti", "Operazioni, PAC e import CSV", "Registra acquisti e vendite, programma i PAC, importa da un file."),
  f("Investimenti", "Rendimenti veri", "Del portafoglio e dei tuoi soldi, al netto dell'inflazione."),
  f("Investimenti", "Confronto con un indice", "«Con gli stessi versamenti oggi avresti X invece di Y»."),
  f("Investimenti", "Rischio", "Volatilità, caduta peggiore, Sharpe, beta e correlazione con l'indice."),
  f("Investimenti", "Diversificazione", "Per area e settore guardando dentro gli ETF."),
  f("Investimenti", "Allocazione obiettivo", "Con il suggerimento di dove mettere il prossimo versamento."),
  f("Investimenti", "Proventi", "Previsione dei dividendi a 12 mesi e incassi mese per mese."),
  f("Investimenti", "Tasse italiane", "Plus e minus, zaino a 4 anni, titoli di Stato, crypto e bollo."),
  f("Investimenti", "Simulatore «Prima di vendere»", "Ricalcola le tasse con la vendita in più, prima di farla."),
  f("Investimenti", "Titoli, watchlist e avvisi", "Pagina per titolo con grafico e avvisi di prezzo via email."),

  f("Debiti", "Finanziamenti nuovi o in corso", "Dall'origine o con la fotografia di oggi, con piano di ammortamento."),
  f("Debiti", "Calcolatore della variabile mancante", "Dai capitale, rata, numero di rate o tasso ricava quello che manca, con il TAEG."),
  f("Debiti", "Rate, cambio tasso e correzioni", "Segna le rate pagate, cambia il tasso o correggi il residuo."),
  f("Debiti", "Estinzione anticipata", "Rata o durata, con penale, interessi risparmiati ed extra mensile."),
  f("Debiti", "Credit Lombard", "Linea di credito con saldo variabile, interessi a fine trimestre e soglia di allerta sull'utilizzo.", "new"),
  f("Debiti", "Simulatore dei debiti", "Surroga o nuova offerta, valanga e palla di neve su più debiti, effetto di un rialzo dell'indice.", "new"),

  f("Patrimonio", "Patrimonio netto nel tempo", "Liquidità, investimenti e debiti, con lo storico ricostruito."),
  f("Patrimonio", "Riepilogo sempre in vista", "Nella barra laterale: patrimonio, portafoglio, watchlist e avvisi."),
  f("Patrimonio", "Nascondi importi", "Oscura cifre e grafici quando qualcuno guarda lo schermo."),
  f("Patrimonio", "Pensione e Pianifica", "Simulatori di pensione e scenari di vita.", "soon"),
  f("Patrimonio", "Analitiche", "Report e analisi trasversali.", "soon"),

  f("Account", "Accesso semplice", "Link via email o Google, senza password da ricordare."),
  f("Account", "Tuoi dati, tuo controllo", "Esporti tutto in ZIP, azzeri o cancelli l'account con 30 giorni di ripensamento."),
  f("Account", "Installabile e a tema", "Si installa come app dal telefono e ha tema chiaro e scuro."),
  f("Account", "Più lingue e valute", "Oggi italiano ed EUR, altre in arrivo.", "soon"),
  f("Account", "Notifiche push", "Avvisi sul telefono, per esempio per i prezzi.", "soon"),
];

/** Funzioni di un'area, nell'ordine del catalogo. */
export function featuresByArea(area: FeatureArea): Feature[] {
  return FEATURES.filter((x) => x.area === area);
}

/** Totale delle funzioni e quante sono già disponibili (live + new). */
export function featureCounts(): { total: number; available: number } {
  return { total: FEATURES.length, available: FEATURES.filter((x) => x.status !== "soon").length };
}
