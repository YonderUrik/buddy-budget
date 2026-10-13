/**
 * Testi della home «Il foglio» (decisione 2026-10-11, `docs/decisioni/2026-10-11-landing-il-foglio.md`): si parte dal
 * foglio di calcolo che molti tengono a mano e si mostra cosa fa l'app al suo posto. Solo fatti verificabili nel codice
 * (paesi della banca in `connect-bank-flow.tsx`, file dei broker in `lib/investments/import/providers.ts`, soglie del
 * rischio in `lib/investments/risk-insights.ts`). Le cifre sono quelle dei dati d'esempio degli screenshot.
 */
import type { HomeIcon } from "./home";
import type { ScreenId } from "./screens";
import { CONTENT_PATHS } from "./seo-pages";

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
  title: "Tutti i tuoi soldi in un posto, senza aggiornarli",
  /** Parole evidenziate come una cella selezionata, in coda al titolo. */
  titleMark: "a mano",
  lede: "I movimenti arrivano dalla banca già divisi per categoria: vedi quanto spendi, quanto metti da parte e quando arrivi a un obiettivo. Investimenti, mutuo e fondo pensione stanno nello stesso posto, con le tasse italiane già calcolate.",
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
  appFile: "app.buddybudget.io/panoramica",
  appAge: "aggiornato stamattina",
  appFormula: "29.343,45 € · patrimonio netto, si aggiorna da solo",
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

/** Paese delle banche collegabili, con la bandiera di `public/flags/` (codice ISO 3166-1 alfa-2 in minuscolo). */
export interface BankCountry {
  code: "it" | "de" | "fr" | "es" | "gb";
  name: string;
}

export const SUPPORTED = {
  kicker: "Fonti supportate",
  title: "Funziona con quello che usi già.",
  brokersLabel: "Broker con l'import già pronto",
  brokers: [
    { name: "Interactive Brokers", detail: "Activity Statement CSV", logo: { src: "/logos/interactive-brokers.svg", width: 271, height: 527 } },
    { name: "DEGIRO", detail: "Account.csv", logo: { src: "/logos/degiro.svg", width: 722, height: 102 } },
    { name: "Trade Republic", detail: "Transaction export.csv", logo: { src: "/logos/trade-republic.svg", width: 501, height: 44 } },
    { name: "Fineco", detail: "Excel delle operazioni", logo: { src: "/logos/fineco.png", width: 640, height: 261 } },
    { name: "Yahoo Finance", detail: "Portafoglio esportato", logo: { src: "/logos/yahoo.svg", width: 512, height: 143 } },
  ] satisfies readonly SupportedSource[],
  /** Ultima card dei broker: chiarisce che l'elenco sopra non è l'unico modo di importare. */
  moreBrokers: { name: "E tutti gli altri", detail: "Carichi il CSV del tuo broker o della tua banca: lo leggiamo e ricordiamo il formato per le volte dopo." },
  banksLabel: "Le banche di questi paesi, con l'Open Banking in sola lettura",
  countries: [
    { code: "it", name: "Italia" },
    { code: "de", name: "Germania" },
    { code: "fr", name: "Francia" },
    { code: "es", name: "Spagna" },
    { code: "gb", name: "Regno Unito" },
  ] satisfies readonly BankCountry[],
  /** Sotto le banche: chi arriva qui vuole collegarne una. */
  connect: { cta: "Collega la tua banca", how: "Come funziona, in tre passi" },
  otherLabel: "E per il resto",
  other: [
        { icon: "wallet", label: "Conti manuali e contanti" },
    { icon: "pencil", label: "Operazioni inserite a mano" },
  ] satisfies readonly { icon: HomeIcon; label: string }[],
} as const;

export type TourId = "conti" | "investimenti" | "tasse" | "debiti" | "pensione" | "futuro" | "limiti";

/**
 * Una scheda del giro dell'app: la formula che si scriveva nel foglio, cosa fa l'app al suo posto (con la cifra
 * d'esempio della schermata), la schermata intera e la scheda tecnica con i fatti da controllare prima di iscriversi.
 */
export interface TourTab {
  id: TourId;
  tab: string;
  icon: HomeIcon;
  title: string;
  /** Il foglio di prima: formula, fatica e quanto costava. Assente nella scheda «Cosa non fa». */
  before?: { formula: string; text: string; cost: string };
  /** Cosa fa l'app; `strong` è la frase con la cifra d'esempio che si vede nella schermata. */
  after: { lead: string; strong?: string; tail?: string };
  shot?: ScreenId;
  /** Calcolatore gratuito da provare senza account, sotto «Con BuddyBudget». */
  link?: { href: string; label: string };
  specs: readonly (readonly [label: string, text: string])[];
}

export const TOUR = {
  kicker: "L'app, area per area",
  title: "Le formule che scrivevi, già fatte.",
  lede: "Per ogni area: com'era nel foglio, cosa fa BuddyBudget e i dettagli da controllare prima di iscriversi. Le cifre sono quelle dei dati d'esempio delle schermate.",
  tabs: [
    {
      id: "conti", tab: "Conti e spese", icon: "wallet", shot: "analisi",
      title: "Le spese del mese, senza copiare l'estratto conto.",
      before: { formula: '=SOMMA.SE(Movimenti!C:C;"Spesa";Movimenti!D:D)', text: "Scarichi il CSV, incolli, sistemi le colonne e scrivi la categoria riga per riga.", cost: "circa un'ora al mese" },
      after: { lead: "I movimenti arrivano dalla banca in sola lettura.", strong: "Hai speso 21.088 € quest'anno,", tail: "e vedi subito la voce che pesa di più." },
      specs: [
        ["Banche", "Italia, Germania, Francia, Spagna e Regno Unito, con l'Open Banking (PSD2) in sola lettura. Le credenziali le inserisci sul sito della banca, mai da noi."],
        ["Consenso", "Dura 90 giorni. Sette giorni prima ti avvisiamo per email e in app, e rinnovi con un clic."],
        ["Aggiornamento", "Ogni 12 ore, più un pulsante per aggiornare subito."],
        ["Se la banca non c'è", "Conto manuale, oppure carichi il CSV della banca: lo leggiamo anche se il formato è nuovo."],
        ["Categorie", "Confermi un negozio e scegli se ricordarlo. Le regole si leggono, si modificano e si cancellano."],
        ["Nomi leggibili", "Da «POS 1234 ESSELUNGA SPA MI» ricava «Esselunga», anche con codici o filiali diversi."],
        ["Assistente AI", "Spento finché non lo attivi. Propone una categoria per i negozi nuovi e riceve solo il nome pulito del negozio."],
        ["Gruppi e budget", "Dovute, Volute, Te futuro, Saltuarie; un tetto per categoria, con un'email all'80% e al 100% se la vuoi."],
      ],
    },
    {
      id: "investimenti", tab: "Investimenti", icon: "trending", shot: "investimenti",
      title: "Il portafoglio di tutti i broker, con il guadagno vero.",
      before: { formula: '=GOOGLEFINANCE("VWCE";"price")*B4', text: "Copi i prezzi, aggiorni le quote a ogni acquisto e confondi quello che hai versato con quello che hai guadagnato.", cost: "a ogni acquisto" },
      after: { lead: "Importi i file del broker e i prezzi si aggiornano da soli.", strong: "Il periodo ha reso +582 €,", tail: "separati dagli 876 € che hai versato tu." },
      specs: [
        ["Broker", "Interactive Brokers, DEGIRO, Trade Republic, Fineco, un portafoglio di Yahoo Finance o un CSV con le colonne indicate da te. Nessun accesso al conto titoli."],
        ["Strumenti", "ETF, azioni, BTP e altri titoli di Stato, fondi e crypto, da più broker nello stesso portafoglio."],
        ["Prezzi", "Chiusure di fine giornata, tre volte al giorno, da più fonti gratuite che si sostituiscono a vicenda. Cambi dalla BCE."],
        ["Rendimento", "Quello del portafoglio e quello dei tuoi soldi, per qualsiasi periodo e per broker, anche al netto dell'inflazione."],
        ["Confronto", "Con un indice a scelta a parità di versamenti: «oggi avresti X invece di Y»."],
        ["Rischio", "Basso, medio, alto o molto alto, da quanto oscilla il portafoglio in un anno: sotto l'8%, fino al 15%, fino al 25%, oltre."],
        ["Diversificazione", "Per area geografica e settore, guardando dentro gli ETF, con i titoli che si sovrappongono."],
      ],
    },
    {
      id: "tasse", tab: "Tasse", icon: "backpack", shot: "tasse",
      title: "Le tasse di una vendita, prima di vendere.",
      link: { href: CONTENT_PATHS.zainetto, label: "Prova senza account: il calcolatore dello zainetto fiscale" },
      before: { formula: "=SE(ANNO(OGGI())-ANNO(E2)>4;0;MIN(F2;G2))*0,26", text: "Una formula per lo zainetto, un'altra per i BTP al 12,5%, una per il bollo. E il dubbio di aver sbagliato.", cost: "#RIF! al primo cambio" },
      after: { lead: "Scegli il titolo e le quote.", strong: "Vendendo l'ETF oggi pagheresti 145,93 €", tail: "su 561,28 € di guadagno, con zainetto e aliquota già considerati." },
      specs: [
        ["Aliquote", "26% in generale, 12,5% sui titoli di Stato, operazione per operazione."],
        ["Zainetto fiscale", "Le minusvalenze anno per anno, con quanto scade e quando (quattro anni dopo)."],
        ["ETF e fondi", "I guadagni sono redditi di capitale e non si compensano con le perdite: l'app li tiene separati."],
        ["Bollo", "Stimato sul valore del deposito titoli."],
        ["Regime", "Amministrato, se il broker fa da sostituto d'imposta, o dichiarativo."],
        ["Sono stime", "Pensate per decidere. Il conteggio definitivo resta all'intermediario o a un professionista."],
      ],
    },
    {
      id: "debiti", tab: "Mutuo e prestiti", icon: "card", shot: "simulatore",
      title: "Il piano del mutuo, con l'estinzione già calcolata.",
      link: { href: CONTENT_PATHS.ammortamento, label: "Prova senza account: il piano di ammortamento" },
      before: { formula: "=RATA(2,9%/12;120;-35000)", text: "Il piano sta in un PDF della banca. Per sapere cosa cambia versando di più, va rifatto da capo.", cost: "un pomeriggio" },
      after: { lead: "Con 200 € in più al mese", strong: "finisci 2 anni e 7 mesi prima e risparmi 1094 €", tail: "di interessi." },
      specs: [
        ["Finanziamenti", "Mutui e prestiti, inseriti dall'inizio o dalla situazione di oggi, con il piano rata per rata."],
        ["Dati mancanti", "Da tre fra capitale, rata, numero di rate e tasso ricava il quarto, con il TAEG."],
        ["Simulazioni", "Extra ogni mese, estinzione parziale con penale, surroga: quanto risparmi e quando finisci."],
        ["Priorità", "Le prossime rate e quale debito costa di più in interessi, per sapere dove mettere un extra."],
      ],
    },
    {
      id: "pensione", tab: "Pensione", icon: "umbrella", shot: "pensione",
      title: "Il fondo pensione, confrontato con il TFR.",
      before: { formula: "=TIR.X(B2:B40;A2:A40)", text: "Il fondo ti dà contributi e controvalore. Il rendimento e il confronto con il TFR li ricostruisci tu.", cost: "di solito non si fa" },
      after: { lead: "Inserisci due numeri ogni tanto o importi lo storico.", strong: "+11,7% sui contributi versati,", tail: "e quanto ti resterebbe prelevando oggi al netto delle tasse." },
      specs: [
        ["Fotografie", "Contributi versati e controvalore quando vuoi, a mano o da CSV ed Excel."],
        ["Rendimento", "Annuo e sui contributi, separato dai versamenti."],
        ["Se ritiri oggi", "Quanto ti resterebbe al netto delle tasse, per prelievo totale o parziale."],
        ["TFR", "Gli stessi versamenti nel fondo o lasciati in azienda, rivalutati."],
      ],
    },
    {
      id: "futuro", tab: "Obiettivi e futuro", icon: "chart", shot: "analitiche",
      title: "Quando arrivi a un obiettivo, e quando puoi smettere di lavorare.",
      link: { href: CONTENT_PATHS.risparmio, label: "Prova senza account: in quanto tempo metti da parte 20.000 €?" },
      before: { formula: "=NPER(4%;-5122;-29343;756614)", text: "Una cella con un'ipotesi fissa, che nessuno riapre.", cost: "una stima mai aggiornata" },
      after: { lead: "Quattro cursori su risparmio, spesa, rendimento e prelievo.", strong: "Ai ritmi di oggi: 2066.", tail: "Sposta un cursore e l'anno si sposta con lui." },
      specs: [
        ["Dai tuoi dati", "Risparmio, spesa e rendimento partono dai tuoi conti e investimenti degli ultimi 12 o 24 mesi, o dei mesi che scegli; il patrimonio da quello della Panoramica."],
        ["Quattro risposte", "Quanta strada hai fatto, l'anno di arrivo, se il piano regge per 40 anni e quanto pesano i costi."],
        ["Ipotesi", "Volatilità, inflazione e imposte sono scritte sotto i cursori, così sai su cosa poggia la stima."],
      ],
    },
    {
      id: "limiti", tab: "Cosa non fa", icon: "ban",
      title: "Cosa BuddyBudget non fa.",
      after: { lead: "Meglio saperlo prima di iscriversi." },
      specs: [
        ["Consigli", "Non dice cosa comprare o vendere. Non è consulenza finanziaria."],
        ["Pagamenti", "Non sposta denaro e non fa ordini al broker: legge e calcola."],
        ["Tempo reale", "I prezzi sono chiusure di fine giornata, non quotazioni durante la seduta."],
        ["Broker", "Non si collega al conto titoli: le operazioni arrivano dai file che scarichi."],
        ["Lingua e valuta", "Per ora italiano ed euro. Le tasse calcolate sono quelle italiane."],
        ["App store", "Si usa dal browser e si installa sulla schermata Home, senza passare dagli store."],
      ],
    },
  ] satisfies readonly TourTab[],
} as const;

export const CLOSING = {
  formula: '=CHIUDI("Conti_2026_DEFINITIVO_v3.xlsx")',
  title: "Chiudi il foglio. Collega il primo conto.",
  note: "Accedi con un link via email o con Google. Nessuna password da ricordare.",
} as const;
