/**
 * Le domande della home: ogni risposta ha una situazione concreta, una cifra (se c'è una cifra vera da mostrare) e la
 * schermata dell'app che la risolve. Le cifre sono calcolate qui con le stesse funzioni degli strumenti pubblici, mai scritte a mano.
 */
import { simulateEarlyRepayment } from "@/lib/tools/ammortamento";
import type { ScreenId } from "./screens";
import { CONTENT_PATHS } from "./seo-pages";

/** Id stabili delle domande (finiscono negli eventi Umami: tipo chiuso). */
export type QuestionId = "patrimonio" | "tasse" | "spese" | "pensione" | "mutuo" | "fire";

export interface QuestionFigure {
  value: number;
  /** `eur` aggiunge "€"; `numero` lascia il valore nudo. */
  unit: "eur" | "numero";
  note: string;
}

export interface Question {
  id: QuestionId;
  /** Come la direbbe chi la fa. */
  question: string;
  headline: string;
  text: string;
  /** Il caso concreto, in una o due frasi. */
  situation: string;
  figure?: QuestionFigure;
  /** Limite o precisazione, sempre dichiarata dove ci sono stime. */
  note: string;
  screen: ScreenId;
  /** Strumento gratuito collegato, se esiste. */
  tool?: { href: string; label: string };
}

/** Plusvalenza di 2.000 € con 1.200 € di minusvalenze nello zainetto: 26% su 800 € = 208 € invece di 520 €. */
const ZAINO_SAVING = Math.round(2000 * 0.26 - (2000 - 1200) * 0.26);

/** Mutuo di 120.000 € al 3% su 240 rate, 20.000 € estinti dopo 5 anni senza penale, a rata invariata. */
const EARLY_REPAYMENT = simulateEarlyRepayment({ principal: 120000, annualRatePct: 3, months: 240, afterMonths: 60, extra: 20000, penaltyPct: 0 });
const EARLY_REPAYMENT_SAVING = Math.round(EARLY_REPAYMENT.netSaving);

/** Spesa annua 30.000 € con tasso di prelievo del 3,5%: 30.000 ÷ 0,035. */
const FIRE_NUMBER = Math.round(30000 / 0.035);

export const QUESTIONS: readonly Question[] = [
  {
    id: "patrimonio",
    question: "Quanto ho, in tutto?",
    headline: "Il patrimonio netto, con i debiti già tolti.",
    text: "Liquidità, investimenti e fondo pensione sommati in un numero solo, con l'andamento negli ultimi mesi. Il debito residuo è sottratto.",
    situation: "Hai un conto corrente, un deposito, qualche ETF, un fondo pensione e un mutuo. Ognuno ha la sua app o il suo estratto.",
    note: "Account demo con dati di esempio, aggiornato con i movimenti della banca ogni 12 ore.",
    screen: "panoramica",
  },
  {
    id: "tasse",
    question: "Se vendo questi ETF, quanto pago?",
    headline: "L'imposta, prima di vendere.",
    text: "Plusvalenze, minusvalenze nello zainetto fiscale a quattro anni e imposta di bollo, calcolate dalle tue operazioni. Vedi quanto pagheresti vendendo oggi.",
    situation: "Hai venduto un ETF con 2.000 € di guadagno e hai 1.200 € di minusvalenze degli anni scorsi.",
    figure: { value: ZAINO_SAVING, unit: "eur", note: "di imposta in meno: 208 € invece di 520 €." },
    note: "Stima al 26%. Il conteggio definitivo lo fa il tuo intermediario.",
    screen: "tasse",
    tool: { href: CONTENT_PATHS.zainetto, label: "Prova il calcolatore dello zainetto fiscale" },
  },
  {
    id: "spese",
    question: "Dove sono finiti i soldi questo mese?",
    headline: "Ogni movimento, con la sua categoria.",
    text: "I movimenti arrivano dalla banca. Confermi un negozio una volta e dalla volta dopo viene riconosciuto. Le spese sono divise in quattro gruppi: Dovute, Volute, Te futuro, Saltuarie.",
    situation: "A fine mese l'estratto conto è una lista di righe con il testo grezzo dei pagamenti, e non sai quanto è andato in cosa.",
    note: "Le regole di categorizzazione le vedi e le puoi modificare.",
    screen: "categorie",
  },
  {
    id: "pensione",
    question: "Il fondo pensione rende più del TFR?",
    headline: "Fondo e TFR, a confronto.",
    text: "Inserisci contributi netti e controvalore, o importa lo storico da CSV o Excel. BuddyBudget ricava il rendimento, stima cosa ti resterebbe prelevando oggi e confronta gli stessi versamenti nel fondo e in azienda.",
    situation: "Il fondo pensione ti manda un estratto con due numeri: i contributi versati e il valore di oggi.",
    figure: { value: 2, unit: "numero", note: "numeri da inserire. Il resto lo ricava BuddyBudget." },
    note: "Le regole fiscali sono stime.",
    screen: "pensione-scenari",
  },
  {
    id: "mutuo",
    question: "Conviene estinguere una parte del mutuo?",
    headline: "Rata più bassa o durata più corta.",
    text: "Inserisci le condizioni e vedi piano di ammortamento, TAEG, interessi risparmiati e penale. Puoi confrontare anche una surroga.",
    situation: "Hai un mutuo di 120.000 € al 3% e 20.000 € fermi sul conto, dopo cinque anni di rate.",
    figure: { value: EARLY_REPAYMENT_SAVING, unit: "eur", note: `di interessi risparmiati, tenendo la stessa rata: ${EARLY_REPAYMENT.monthsLeftSameInstallment} rate rimaste invece di 180.` },
    note: "Mutuo prima casa, senza penale.",
    screen: "simulatore",
    tool: { href: CONTENT_PATHS.ammortamento, label: "Prova il calcolatore del piano di ammortamento" },
  },
  {
    id: "fire",
    question: "Quanto mi serve per smettere di lavorare?",
    headline: "Il numero FIRE, al netto delle tasse.",
    text: "Un anno di arrivo che si sposta mentre muovi risparmio, spesa, rendimento e prelievo, e quattro risposte: quanta strada hai fatto, quando puoi smettere, se il patrimonio dura, quanto costa. I dettagli (scenari di mercato, regole di prelievo, rischio) si aprono in «Per esperti». Parte da ipotesi che scegli tu.",
    situation: "Spendi 30.000 € l'anno e con un prelievo del 3,5% il conto è semplice: 30.000 ÷ 0,035.",
    figure: { value: FIRE_NUMBER, unit: "eur", note: "il capitale necessario, in euro di oggi." },
    note: "Una stima, non una previsione.",
    screen: "analitiche",
  },
];

export { ZAINO_SAVING, EARLY_REPAYMENT_SAVING, FIRE_NUMBER };
