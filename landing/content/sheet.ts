/**
 * Testi della home «Il foglio» (decisione 2026-10-11, `docs/decisioni/2026-10-11-landing-il-foglio.md`): si parte dal
 * foglio di calcolo che molti tengono a mano e si mostra cosa fa l'app al suo posto. Solo fatti verificabili nel codice
 * (paesi della banca in `connect-bank-flow.tsx`, file dei broker in `lib/investments/import/providers.ts`, soglie del
 * rischio in `lib/investments/risk-insights.ts`). Le cifre sono quelle dei dati d'esempio degli screenshot.
 */
import type { ScreenId } from "./screens";

/** Riga del foglio d'esempio in apertura: voce, saldo (o errore), ultimo aggiornamento, nota a margine. */
export interface SheetRow {
  label: string;
  value: string;
  /** Il valore è un errore di formula (#VALORE!, #RIF!): si mostra in rosso. */
  error?: boolean;
  updated: string;
  note: string;
}

export const SHEET_HERO = {
  title: "Il foglio dei conti, senza aggiornarlo",
  /** Parole evidenziate come una cella selezionata, in coda al titolo. */
  titleMark: "a mano",
  lede: "Movimenti dalla banca, investimenti con le tasse italiane, mutuo e fondo pensione. Le formule che scrivevi, BuddyBudget le fa già.",
  fileName: "Conti_2026_DEFINITIVO_v3.xlsx",
  fileAge: "ultima modifica: 3 mesi fa",
  formulaCell: "B12",
  formula: "=SOMMA(B2:B9)-B11+SE(OGGI()>DATA(2026;9;1);0;C4)",
  columns: ["Voce", "Saldo", "Agg.", "Note"],
  rows: [
    { label: "Conto corrente", value: "4.812,30", updated: "02/07", note: "copiare da estratto" },
    { label: "Conto deposito", value: "6.000,00", updated: "15/06", note: "" },
    { label: "ETF mondo", value: "19.207,05", updated: "??", note: "prezzo di quando?" },
    { label: "BTP 2030", value: "#VALORE!", error: true, updated: "—", note: "cedola?" },
    { label: "Crypto", value: "1.240,00", updated: "01/05", note: "" },
    { label: "Fondo pensione", value: "10.700,00", updated: "gen", note: "guardare app fondo" },
    { label: "Tasse se vendo", value: "#RIF!", error: true, updated: "—", note: "zainetto??" },
    { label: "Contanti", value: "180,00", updated: "—", note: "" },
    { label: "", value: "", updated: "", note: "" },
    { label: "Mutuo residuo", value: "27.433,58", updated: "set", note: "piano in PDF" },
  ] satisfies readonly SheetRow[],
  totalLabel: "Patrimonio",
  totalValue: "#VALORE!",
  sheetTab: "Foglio1",
  appTab: "BuddyBudget",
  appAlt: "Lo stesso patrimonio nella Panoramica di BuddyBudget: 29.343,45 € con il grafico degli ultimi tre mesi",
} as const;

/** Fonte supportata, con logo se ne abbiamo il permesso d'uso (vedi `public/logos/ATTRIBUTION.md`). */
export interface SupportedSource {
  name: string;
  /** Cosa si carica o si collega. */
  detail: string;
  logo?: { src: string; width: number; height: number };
}

export const SUPPORTED = {
  ref: "Fonti!A1",
  title: "Funziona con quello che usi già.",
  brokersLabel: "Broker, dai file che scarichi",
  brokers: [
    { name: "Interactive Brokers", detail: "Activity Statement CSV", logo: { src: "/logos/interactive-brokers.svg", width: 271, height: 527 } },
    { name: "DEGIRO", detail: "Account.csv", logo: { src: "/logos/degiro.svg", width: 722, height: 102 } },
    { name: "Trade Republic", detail: "Transaction export.csv", logo: { src: "/logos/trade-republic.svg", width: 501, height: 44 } },
    { name: "Fineco", detail: "Excel delle operazioni", logo: { src: "/logos/fineco.png", width: 640, height: 261 } },
    { name: "Yahoo Finance", detail: "Portafoglio esportato", logo: { src: "/logos/yahoo.svg", width: 512, height: 143 } },
  ] satisfies readonly SupportedSource[],
  banksLabel: "Banche, con l'Open Banking in sola lettura",
  countries: ["Italia", "Germania", "Francia", "Spagna", "Regno Unito"],
  otherLabel: "E per il resto",
  other: ["CSV di qualsiasi banca o broker", "Conti manuali", "Operazioni a mano"],
} as const;

export type SheetSectionId = "spese" | "investimenti" | "debiti" | "pensione" | "futuro";

/** Sezione «prima / ora»: la formula che si scriveva nel foglio accanto alla schermata dell'app. */
export interface BeforeAfter {
  id: SheetSectionId;
  /** Riferimento di cella mostrato sopra il titolo, come il nome di un foglio. */
  ref: string;
  tab: string;
  title: string;
  formula: string;
  before: string;
  /** Il costo di farlo a mano, in breve. */
  cost: string;
  shot: ScreenId;
  /** Testo sotto la schermata; `strong` è la frase in evidenza con la cifra d'esempio. */
  after: { lead: string; strong: string; tail: string };
}

export const BEFORE_AFTER: readonly BeforeAfter[] = [
  {
    id: "spese", ref: "Spese!A1", tab: "Spese", title: "Le spese del mese, senza copiare l'estratto conto.",
    formula: '=SOMMA.SE(Movimenti!C:C;"Spesa";Movimenti!D:D)',
    before: "Scarichi il CSV, incolli, sistemi le colonne, scrivi la categoria riga per riga.", cost: "circa un'ora al mese",
    shot: "analisi",
    after: { lead: "I movimenti arrivano dalla banca in sola lettura.", strong: "Le regole che confermi riconoscono i negozi le volte dopo,", tail: "e le spese si dividono in quattro gruppi: Dovute, Volute, Te futuro, Saltuarie." },
  },
  {
    id: "investimenti", ref: "Investimenti!A1", tab: "Investimenti", title: "Le tasse di una vendita, prima di vendere.",
    formula: "=SE(ANNO(OGGI())-ANNO(E2)>4;0;MIN(F2;G2))*0,26",
    before: "Una formula per lo zainetto, un'altra per i BTP al 12,5%, una per il bollo. E il dubbio di aver sbagliato.", cost: "#RIF! al primo cambio",
    shot: "tasse",
    after: { lead: "Importi i file del tuo broker.", strong: "Vendendo l'ETF oggi pagheresti 145,93 €", tail: "su 561,28 € di guadagno, con zainetto e aliquota già considerati." },
  },
  {
    id: "debiti", ref: "Mutuo!A1", tab: "Debiti", title: "Il piano del mutuo, con l'estinzione già calcolata.",
    formula: "=RATA(2,9%/12;120;-35000)",
    before: "Il piano sta in un PDF della banca. Per sapere cosa cambia versando di più, va rifatto da capo.", cost: "un pomeriggio",
    shot: "simulatore",
    after: { lead: "Con 200 € in più al mese", strong: "finisci 2 anni e 7 mesi prima e risparmi 1094 €", tail: "di interessi. TAEG, penali e surroga compresi." },
  },
  {
    id: "pensione", ref: "Pensione!A1", tab: "Pensione", title: "Il fondo pensione, confrontato con il TFR.",
    formula: "=TIR.X(B2:B40;A2:A40)",
    before: "Il fondo ti dà contributi e controvalore. Il rendimento e il confronto con il TFR li ricostruisci tu.", cost: "di solito non si fa",
    shot: "pensione",
    after: { lead: "Inserisci due numeri ogni tanto o importi lo storico.", strong: "+11,7% sui contributi versati,", tail: "e quanto ti resterebbe prelevando oggi al netto delle tasse." },
  },
  {
    id: "futuro", ref: "FIRE!A1", tab: "Futuro", title: "L'anno in cui puoi smettere di lavorare.",
    formula: "=NPER(4%;-5122;-29343;756614)",
    before: "Una cella con un'ipotesi fissa, che nessuno riapre.", cost: "una stima mai aggiornata",
    shot: "analitiche",
    after: { lead: "Quattro cursori su risparmio, spesa, rendimento e prelievo.", strong: "Ai ritmi di oggi: 2066.", tail: "Sposta un cursore e l'anno si sposta con lui." },
  },
];

export type DetailId = "banca" | "categorie" | "broker" | "rischio" | "tasse" | "debiti" | "limiti";

/** Scheda della sezione «Nel dettaglio»: le risposte che si cercano prima di iscriversi, compreso ciò che l'app non fa. */
export interface DetailTab {
  id: DetailId;
  tab: string;
  title: string;
  lede: string;
  specs: readonly (readonly [label: string, text: string])[];
  shot?: ScreenId;
}

export const DETAILS = {
  ref: "Dettagli!A1",
  title: "Banche, broker, rischio: la scheda tecnica.",
  lede: "Quello che controlleresti prima di iscriverti, compreso quello che l'app non fa.",
  tabs: [
    {
      id: "banca", tab: "Banche e conti", shot: "conti",
      title: "Collegare la banca",
      lede: "Il conto si collega con l'Open Banking, lo stesso sistema regolato dalla PSD2 che usano le app delle banche.",
      specs: [
        ["Paesi", "Italia, Germania, Francia, Spagna, Regno Unito. Cerchi la tua banca per nome quando colleghi il conto."],
        ["Accesso", "Solo lettura di saldi e movimenti, tramite un fornitore autorizzato. Le credenziali le inserisci sul sito della banca, mai da noi."],
        ["Consenso", "Dura 90 giorni. Sette giorni prima ti avvisiamo per email e in app, e rinnovi con un clic."],
        ["Aggiornamento", "Ogni 12 ore, più un pulsante per aggiornare subito."],
        ["Storico", "Tutti i movimenti che la banca mette a disposizione al primo collegamento."],
        ["Se la banca non c'è", "Conto manuale, oppure carichi il CSV della banca: lo leggiamo anche se il formato è nuovo e lo ricordiamo per le volte dopo."],
      ],
    },
    {
      id: "categorie", tab: "Categorie", shot: "categorie",
      title: "Mettere i movimenti in categoria",
      lede: "Le categorie le confermi tu. L'app impara dalle tue scelte e non cambia nulla da sola.",
      specs: [
        ["Regole", "Confermi un negozio e scegli se ricordarlo. Le regole sono in una lista che puoi leggere, modificare e cancellare."],
        ["Nomi leggibili", "Da «POS 1234 ESSELUNGA SPA MI» ricava «Esselunga», e riconosce lo stesso negozio anche con codici o filiali diversi."],
        ["Assistente AI", "Spento finché non lo attivi. Propone una categoria per i negozi nuovi, una carta alla volta. Riceve solo il nome pulito del negozio: niente importi, date o IBAN."],
        ["Gruppi di spesa", "Ogni categoria sta in uno di quattro gruppi: Dovute, Volute, Te futuro, Saltuarie. Ciò che resta è l'avanzo."],
        ["Spese condivise", "Dividi un movimento a metà, a un terzo o di un importo, o escludi rimborsi e giroconti dai conti del mese."],
        ["Budget", "Un tetto per categoria, con quanto ne hai usato e, se lo vuoi, un'email all'80% e al 100%."],
      ],
    },
    {
      id: "broker", tab: "Broker e strumenti", shot: "investimenti",
      title: "Portare dentro gli investimenti",
      lede: "Le operazioni arrivano dai file che il broker ti fa già scaricare. Nessun accesso al tuo conto titoli.",
      specs: [
        ["Interactive Brokers", "Activity Statement in CSV, con liquidità e cambi."],
        ["DEGIRO", "Il file Account.csv, con commissioni e cambi."],
        ["Trade Republic", "Il file Transaction export.csv, anche carta, bonifici e interessi."],
        ["Fineco", "Il file Excel delle operazioni, con dividendi e cedole."],
        ["Altri", "Un portafoglio esportato da Yahoo Finance, un CSV qualsiasi con le colonne indicate da te, o le operazioni inserite a mano."],
        ["Strumenti", "ETF, azioni, BTP e altri titoli di Stato, fondi e crypto. Più broker nello stesso portafoglio, e ogni import si cancella da solo."],
        ["Prezzi", "Chiusure di fine giornata, aggiornate tre volte al giorno da più fonti gratuite che si sostituiscono a vicenda. Cambi dalla BCE."],
      ],
    },
    {
      id: "rischio", tab: "Rendimento e rischio", shot: "performance",
      title: "Capire come sta andando",
      lede: "Numeri da gestore di fondi, ognuno spiegato con una frase in italiano normale.",
      specs: [
        ["Rendimento", "Quello del portafoglio e quello dei tuoi soldi, che tiene conto di quando hai versato. Per qualsiasi periodo e per broker, anche al netto dell'inflazione."],
        ["Confronto", "Con un indice a scelta a parità di versamenti: «oggi avresti X invece di Y»."],
        ["Livello di rischio", "Basso, medio, alto o molto alto, da quanto oscilla il portafoglio in un anno: sotto l'8%, fino al 15%, fino al 25%, oltre."],
        ["Dettagli", "La perdita peggiore dal massimo, se il rischio preso è stato ripagato e quanto il portafoglio segue l'indice."],
        ["Diversificazione", "Per area geografica e settore, guardando dentro gli ETF, con i titoli che si sovrappongono."],
        ["Costi", "Commissioni e imposte pagate, e quanto varresti se fossero rimaste investite."],
      ],
    },
    {
      id: "tasse", tab: "Tasse", shot: "tasse",
      title: "Le tasse italiane sugli investimenti",
      lede: "Stime pensate per decidere. Il conteggio definitivo resta all'intermediario o a un professionista.",
      specs: [
        ["Aliquote", "26% in generale, 12,5% sui titoli di Stato, applicata operazione per operazione."],
        ["Zainetto fiscale", "Le minusvalenze anno per anno, con quanto scade e quando (quattro anni dopo)."],
        ["ETF e fondi", "I guadagni sono redditi di capitale e non si compensano con le perdite: l'app li tiene separati."],
        ["Bollo", "Stimato sul valore del deposito titoli."],
        ["Regime", "Amministrato, se il broker fa da sostituto d'imposta, o dichiarativo."],
        ["Prima di vendere", "Scegli un titolo e le quote: vedi incasso, plusvalenza e imposta prima di dare l'ordine."],
      ],
    },
    {
      id: "debiti", tab: "Debiti e pensione", shot: "debiti",
      title: "Mutuo, prestiti e fondo pensione",
      lede: "Le due voci che pesano di più sul patrimonio e che le app di spese di solito lasciano fuori.",
      specs: [
        ["Finanziamenti", "Mutui e prestiti, inseriti dall'inizio o dalla situazione di oggi, con il piano rata per rata."],
        ["Dati mancanti", "Da tre fra capitale, rata, numero di rate e tasso ricava il quarto, con il TAEG."],
        ["Simulazioni", "Extra ogni mese, estinzione parziale con penale, surroga: quanto risparmi e quando finisci."],
        ["Fondo pensione", "Contributi e controvalore ogni tanto, a mano o da CSV ed Excel. Rendimento e guadagno sui versamenti."],
        ["TFR", "Gli stessi versamenti nel fondo o in azienda, e quanto ti resterebbe prelevando oggi al netto delle tasse."],
      ],
    },
    {
      id: "limiti", tab: "Cosa non fa",
      title: "Cosa BuddyBudget non fa",
      lede: "Meglio saperlo prima di iscriversi.",
      specs: [
        ["Consigli", "Non dice cosa comprare o vendere. Non è consulenza finanziaria."],
        ["Pagamenti", "Non sposta denaro e non fa ordini al broker: legge e calcola."],
        ["Tempo reale", "I prezzi sono chiusure di fine giornata, non quotazioni durante la seduta."],
        ["Broker", "Non si collega al conto titoli: le operazioni arrivano dai file che scarichi."],
        ["Lingua e valuta", "Per ora italiano ed euro. Le tasse calcolate sono quelle italiane."],
        ["App store", "Si usa dal browser e si installa sulla schermata Home, senza passare dagli store."],
      ],
    },
  ] satisfies readonly DetailTab[],
} as const;

export const CLOSING = {
  formula: '=CHIUDI("Conti_2026_DEFINITIVO_v3.xlsx")',
  title: "Chiudi il foglio. Collega il primo conto.",
  note: "Accedi con un link via email o con Google. Nessuna password da ricordare.",
} as const;
