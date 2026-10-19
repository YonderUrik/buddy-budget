/**
 * Catalogo delle funzionalità di BuddyBudget: UNICA fonte di verità per la landing (catalogo "Tutte le funzioni",
 * conteggi), il pannello "In arrivo" del login e il test di coerenza con la sidebar. Solo dati, nessuna dipendenza:
 * la landing ne tiene una copia generata (`pnpm sync:features` in `landing/`), la CI fallisce se non è allineata.
 * Quando una funzione viene rilasciata, cambia stato o nasce, si aggiorna QUI e si lancia il sync. Solo funzioni che
 * contano da sole: i dettagli dell'interfaccia (ricerca, nomi puliti, scorciatoie, tema) restano dentro la voce che servono.
 */

export const FEATURE_AREAS = ["Liquidità", "Investimenti", "Debiti", "Patrimonio", "Account"] as const;
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
  f("setup-self-hosted", "Account", "Installazione self-hosted guidata", "Configura BuddyBudget dal terminale con un percorso in inglese a sei passi: inserisci le tue chiavi API oppure salta un servizio. OpenRouter consigliato, prezzi Yahoo senza chiave, email e altre integrazioni a scelta. Verifiche e riepilogo prima del salvataggio, worker AI incluso e stato dei servizi nelle Impostazioni.", "new"),
  f("csv-personali-ai", "Liquidità", "CSV personali con AI", "Carica il CSV di una banca o di un broker che non conosciamo: lo leggiamo in background e ricordiamo istituzione e colonne del formato. Se il lettore salvato fallisce, riproviamo con l’AI autorizzata e inviamo un report tecnico al supporto. Ti avvisiamo per email a import finito. Se il risultato è sbagliato, descrivi il problema e ricarica il file: confronti la correzione AI prima di sostituire i dati originali.", "new"),
  f("primi-passi-e-dati-d-esempio", "Account", "Primi passi e dati d'esempio", "Chi parte senza banca trova in Panoramica quattro passi che si spuntano da soli (conto, movimenti, investimento, obiettivo) e può provare l'app con dati d'esempio, azzerabili con un tocco.", "new"),
  f("collegamento-alla-banca", "Liquidità", "Collegamento alla banca", "Importa saldi e movimenti di una banca con l'Open Banking, in sola lettura, ogni 12 ore o quando vuoi. Posti limitati durante la beta.", "live"),
  f("conti-manuali", "Liquidità", "Conti manuali", "Per il contante o le banche che non si collegano. Tocchi il conto e cambi saldo, nome e icona.", "live"),

  f("categorizza-con-ai", "Liquidità", "Categorizza con l'AI", "Se lo attivi, l'assistente propone una categoria per ogni esercente. Le proposte sicure almeno al 90% si applicano da sole e le controlli in «Messe dall'app»; le altre le confermi con un gesto, una carta alla volta. Usa solo il nome pulito dell'esercente e le tue istruzioni personali, modificabili in Impostazioni.", "new"),
  f("categorie-pronte", "Liquidità", "Categorie pronte da scegliere", "All'iscrizione trovi 24 categorie già divise per tipo di spesa: le confermi con un tocco oppure ne togli, rinomini o aggiungi.", "new"),
  f("categorizzazione-automatica", "Liquidità", "Categorizzazione automatica", "Le tue regole e le categorie sicure almeno al 90% si applicano da sole, e una regola nuova vale subito. In «Messe dall'app» vedi cosa è stato messo, con il logo dell'esercente, le date e da dove viene (regola, tue scelte o AI), e lo correggi con un tocco. «Ricategorizza» rifà le categorie messe da sole con le regole di oggi, con l'anteprima e l'annulla.", "new"),
  f("quattro-gruppi-di-spesa", "Liquidità", "Quattro gruppi di spesa", "Dovute, Volute, Te futuro e Saltuarie, con colori e icone scelti da te.", "live"),
  f("trasferimenti-tra-conti", "Liquidità", "Trasferimenti tra i tuoi conti", "Assegna i giroconti alla categoria dedicata: restano visibili nei movimenti, esclusi dai conteggi di entrate e spese.", "new"),
  f("dividi-e-escludi", "Liquidità", "Dividi e escludi", "Escludi in tutto o in parte rimborsi, giroconti e spese condivise: scegli Metà, Un terzo o un importo, e vedi subito quanto è tuo.", "live"),
  f("budget-per-categoria", "Liquidità", "Budget per categoria", "Imposta un budget e guarda quanto ne hai usato.", "live"),
  f("analisi-e-cash-flow", "Liquidità", "Analisi e cash flow", "Entrate, uscite, netto e risparmio, mese per mese e per categoria.", "live", "/liquidita"),
  f("abbonamenti", "Liquidità", "Abbonamenti", "Trova gli addebiti ricorrenti (streaming, palestra, assicurazioni) e li confermi con un tocco. Vedi il costo al mese e all'anno, il prossimo addebito e gli aumenti di prezzo. Il calcolo parte dai tuoi movimenti, senza AI.", "new"),

  f("etf-azioni-btp-fondi-e-crypto", "Investimenti", "ETF, azioni, BTP, fondi e crypto", "Prezzi di fine giornata da fonti gratuite con riserva automatica, cambi della BCE.", "live", "/investimenti"),
  f("operazioni-e-import-csv", "Investimenti", "Operazioni e import CSV", "Registra acquisti e vendite o importa i file del tuo broker: Interactive Brokers, DEGIRO, Trade Republic, Fineco, Yahoo Finance o un altro CSV. Più broker convivono nello stesso portafoglio e gli import si gestiscono uno per uno. Se autorizzi il recupero AI, gli errori di lettura avviano automaticamente una nuova analisi, mantenendo i controlli finanziari.", "live"),
  f("rendimenti-veri", "Investimenti", "Rendimenti veri", "Rendimenti TWR, MWR e al netto dell'inflazione del paese del prodotto (Italia o Germania, indice Eurostat), con spiegazioni su hover. I numeri seguono la data del grafico; trascina per selezionare un intervallo, anche per rischio e rendimenti mensili. Mostra anche quanto varresti se costi e imposte fossero rimasti investiti.", "live"),
  f("confronto-con-un-indice", "Investimenti", "Confronto con un indice", "«Con gli stessi versamenti oggi avresti X invece di Y». Scelte rapide per S&P 500, MSCI World, FTSE All-World e Nasdaq-100 tramite ETF ad accumulazione, oppure cerca un altro strumento.", "live"),
  f("rischio", "Investimenti", "Rischio", "Un livello di rischio chiaro (da basso a molto alto), poi quanto oscilla, la perdita peggiore, se il rischio è stato ripagato e quanto segue l'indice.", "live"),
  f("diversificazione", "Investimenti", "Diversificazione", "Per area e settore guardando dentro gli ETF.", "live"),
  f("allocazione-obiettivo", "Investimenti", "Allocazione obiettivo", "Con il suggerimento di dove mettere il prossimo versamento.", "live"),
  f("proventi", "Investimenti", "Dividendi", "Proventi incassati e previsti nei prossimi 12 mesi, mese per mese e per strumento, con lordo, ritenute e netto.", "live"),
  f("pianificazione-germania", "Investimenti", "Pianificazione finanziaria Germania", "Localizzazione essenziale in inglese e tedesco: portafoglio, proventi e stime fiscali 2026 in EUR con limiti espliciti. Pensione, AVD, pensionamento e simulatori avanzati sono nascosti in attesa di revisione.", "new"),
  f("tasse-italiane", "Investimenti", "Tasse italiane", "Plus e minus, zaino a 4 anni, titoli di Stato, crypto e bollo.", "live"),
  f("simulatore-prima-di-vendere", "Investimenti", "Simulatore «Prima di vendere»", "Ricalcola le tasse con la vendita in più, prima di farla.", "live"),
  f("titoli-watchlist-e-avvisi", "Investimenti", "Titoli, watchlist e avvisi", "Pagina per titolo, che si apre dalle posizioni o con la ricerca, con grafico dei tuoi acquisti, rischio, watchlist e avvisi di prezzo via email.", "live"),
  f("indicatori-fondamentali", "Investimenti", "Indicatori fondamentali", "Per ogni azione P/E, P/S, P/B, ricavi e utili per azione, margini, ROE e debiti calcolati dai bilanci, con la forbice degli ultimi anni e il calcolo sotto ogni numero. Per gli ETF composizione, settori, costo del TER e titoli che hai già altrove.", "new"),

  f("finanziamenti-nuovi-o-in-corso", "Debiti", "Finanziamenti nuovi o in corso", "Dall'origine o con la fotografia di oggi, con piano di ammortamento.", "live", "/debiti"),
  f("calcolatore-della-variabile-mancante", "Debiti", "Calcolatore della variabile mancante", "Dai capitale, rata, numero di rate o tasso ricava quello che manca, con il TAEG.", "live"),
  f("estinzione-anticipata", "Debiti", "Estinzione anticipata", "Rata o durata, con penale, interessi risparmiati ed extra mensile.", "live"),
  f("simulatore-dei-debiti", "Debiti", "Simulatore dei debiti", "Dentro ogni finanziamento: quanto risparmi versando di più, estinguendo una parte o passando a un'altra banca. In panoramica il percorso per uscire prima dai debiti.", "new"),

  f("patrimonio-netto-nel-tempo", "Patrimonio", "Patrimonio netto nel tempo", "Liquidità, investimenti e previdenza (debiti già sottratti), con lo storico ricostruito. Dalla legenda mostri o nascondi le voci e il totale si aggiorna.", "live", "/panoramica"),
  f("pensione", "Patrimonio", "Pensione", "Fondo pensione e TFR: rendimento reale, quanto ritireresti oggi al netto delle tasse e una stima di quanto varrà. Lo storico lo inserisci a mano o lo importi da CSV o Excel.", "new", "/pensione"),
  f("analitiche", "Patrimonio", "Analitiche", "L'anno in cui puoi smettere di lavorare, con quattro cursori «e se…» su risparmio, spesa, rendimento e prelievo; i primi tre partono dai tuoi dati degli ultimi 12 o 24 mesi, o dei mesi che scegli. Per chi vuole di più: numero FIRE al netto delle tasse, simulazioni Monte Carlo e regole di prelievo.", "new", "/analitiche"),
  f("obiettivi-di-risparmio", "Patrimonio", "Obiettivi di risparmio", "Un viaggio, l'anticipo di casa, un fondo per gli imprevisti: scegli quanto ti serve, entro quando e da quali conti o investimenti arrivano i soldi. Il risparmio del mese va agli obiettivi nell'ordine che scegli; vedi quando arrivi a ciascuno, se il risparmio basta per tutto e di quanto ognuno sposta l'anno in cui puoi smettere di lavorare. Promemoria via email a inizio mese, se li vuoi.", "new"),

  f("tuoi-dati-tuo-controllo", "Account", "Tuoi dati, tuo controllo", "Esporti tutto in ZIP, azzeri o cancelli l'account con 30 giorni di ripensamento.", "live"),
  f("email-riepilogo-e-avvisi", "Account", "Email di riepilogo e avvisi", "Se vuoi, ricevi il riepilogo del mese o della settimana, con speso, entrato, guadagno degli investimenti e dividendi in poche righe, e un avviso quando un budget è quasi finito o una rata sta per scadere. Le scegli già al primo accesso, partono spente e ognuna si disattiva con un clic.", "new"),
  f("piu-lingue-e-valute", "Account", "Più lingue e valute", "Prodotto Italia in italiano e inglese; prodotto Germania in tedesco e inglese. Valute selezionabili. Per la Germania: portafoglio e proventi, stime fiscali 2026 parziali con limiti espliciti; pensione e simulatori avanzati sospesi in attesa di revisione. I casi non supportati sono indicati, senza applicare regole italiane.", "new"),
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
