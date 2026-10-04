/**
 * Glossario di Analitiche: parole e cifre che non tutti conoscono, spiegate in due righe nel popup che si apre
 * toccando il termine sottolineato. Le spiegazioni lunghe restano in `explainers.ts` («Per esperti»).
 */

export interface GlossaryEntry {
  title: string;
  /** Spiegazione breve, in parole semplici, con un esempio quando serve. */
  text: string;
  /** Forme con cui il termine compare nelle frasi (minuscole): servono a sottolinearlo da solo in `GlossedText`. */
  match?: readonly string[];
}

export const GLOSSARY = {
  "numero-fire": {
    title: "Numero FIRE",
    text: "Il capitale che basterebbe per vivere del solo rendimento del patrimonio, senza più lavorare. Si calcola come spesa annua ÷ tasso di prelievo: con 30.000 € di spesa e il 3,5%, circa 857.000 €.",
    match: ["numero fire", "fire"],
  },
  "tasso-prelievo": {
    title: "Tasso di prelievo",
    text: "La quota del patrimonio che prelevi ogni anno per vivere. Con il 3,5% prelevi 3.500 € ogni 100.000 €. Più è basso, più il patrimonio dura, ma più capitale ti serve.",
    match: ["tasso di prelievo"],
  },
  "rendimento-reale": {
    title: "Rendimento reale",
    text: "Il rendimento al netto dell'inflazione. Con un 6% nominale e un'inflazione del 2% il reale è circa 4%. Per questo tutte le cifre sono in euro di oggi.",
    match: ["rendimento reale"],
  },
  "euro-di-oggi": {
    title: "Euro di oggi",
    text: "Gli importi futuri sono espressi con il potere d'acquisto di oggi: 100.000 € tra 30 anni valgono quanto ciò che oggi comprano 100.000 €. Così il confronto è onesto.",
    match: ["euro di oggi"],
  },
  simulazione: {
    title: "Scenari simulati (Monte Carlo)",
    text: "Il computer prova migliaia di futuri possibili, con rendimenti che oscillano a caso come sui mercati veri. La percentuale dice in quanti di questi futuri il patrimonio non si esaurisce prima della fine.",
    match: ["scenari simulati", "futuri possibili", "scenari"],
  },
  "probabilita-successo": {
    title: "Probabilità di successo",
    text: "La quota di scenari simulati in cui il patrimonio dura fino all'ultimo anno. Sopra il 90% è solida; sotto il 75% in troppi casi finisce prima.",
    match: ["probabilità di successo"],
  },
  "regola-fissa": {
    title: "Spesa fissa",
    text: "Spendi ogni anno la stessa cifra (corretta per l'inflazione), qualunque cosa faccia il mercato. È la regola più prevedibile ma anche la più fragile nei periodi brutti.",
    match: ["spesa fissa"],
  },
  "regola-percentuale": {
    title: "Percentuale del patrimonio",
    text: "Ogni anno prelevi una percentuale di ciò che hai in quel momento. Il patrimonio non si esaurisce mai, ma la spesa sale e scende con il mercato.",
    match: ["percentuale del patrimonio"],
  },
  "regola-gk": {
    title: "Guyton-Klinger",
    text: "Una regola con paletti: se il prelievo diventa troppo alto rispetto al patrimonio lo tagli del 10%, se è basso puoi alzarlo. Evita i tagli drastici ma richiede flessibilità.",
    match: ["guyton-klinger"],
  },
  "regola-vanguard": {
    title: "Vanguard dinamica",
    text: "Prelievo di una percentuale del patrimonio, ma con un tetto e un minimo ai cambiamenti da un anno all'altro (circa ±5%). La spesa resta più stabile della pura percentuale.",
    match: ["vanguard dinamica", "vanguard"],
  },
  "imposte-latenti": {
    title: "Imposte sulle plusvalenze",
    text: "Sui guadagni non ancora incassati pagheresti un'imposta (in genere 26%, 12,5% sui titoli di Stato) solo vendendo. Qui è la stima di quanto sarebbe se vendessi tutto oggi.",
    match: ["imposte sulle plusvalenze", "plusvalenze", "imposte latenti"],
  },
  ter: {
    title: "TER (costo del fondo)",
    text: "Il costo annuo di un fondo o ETF, in % del valore, già tolto dal rendimento. Lo trovi nel KID. Un ETF globale è di solito 0,1-0,4%. Piccolo ogni anno, pesa su orizzonti lunghi.",
    match: ["costo del fondo", "ter"],
  },
  bollo: {
    title: "Imposta di bollo",
    text: "Lo 0,2% annuo sul valore dei titoli in deposito. Si paga anche se non vendi. Per le crypto non si applica.",
    match: ["bollo"],
  },
  erosione: {
    title: "Erosione dei costi",
    text: "Quanto in meno avresti dopo molti anni, a parità di rendimento lordo, per effetto di costi e bollo che ogni anno sottraggono una piccola quota.",
    match: ["a parità di rendimento"],
  },
  volatilita: { title: "Volatilità", text: "Quanto il valore oscilla in un anno. Il 12% significa che di solito il portafoglio sale o scende fino a 12 punti rispetto alla media; più è alta, più il percorso è ballerino." },
  "peggior-calo": { title: "Peggior calo (drawdown)", text: "La perdita più grande dal punto più alto al punto più basso successivo. Dice quanto male è andata nel peggior momento." },
  sharpe: { title: "Indice di Sharpe", text: "Il rendimento ottenuto per ogni unità di rischio corso. Sopra 1 è buono, sotto 0,5 il rischio è poco ripagato." },
  sortino: { title: "Indice di Sortino", text: "Come Sharpe, ma conta solo le oscillazioni al ribasso, che sono quelle che fanno davvero male." },
  calmar: { title: "Indice di Calmar", text: "Rendimento annuo diviso per il peggior calo. Dice quanto rendimento ottieni per ogni punto di perdita massima sopportata." },
  var: { title: "VaR 95%", text: "Valore a rischio: nel 5% dei giorni peggiori si perde almeno questa percentuale in un giorno. Nel restante 95% la perdita è minore." },
  cvar: { title: "CVaR 95%", text: "La perdita media nei giorni peggiori (quel 5%). È più severa del VaR perché guarda come vanno davvero i casi brutti." },
  "posizioni-effettive": { title: "Posizioni effettive", text: "Quanti titoli equivalenti hai davvero, tenendo conto dei pesi. 1 significa tutto su un titolo, più è alto più sei diversificato." },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryId = keyof typeof GLOSSARY;

/** Forme riconoscibili nel testo, con il termine a cui puntano: dalle più lunghe, così «tasso di prelievo» batte «prelievo». */
export const GLOSSARY_MATCHES: readonly { phrase: string; id: GlossaryId }[] = (Object.entries(GLOSSARY) as [GlossaryId, GlossaryEntry][])
  .flatMap(([id, entry]) => (entry.match ?? []).map((phrase) => ({ phrase, id })))
  .sort((a, b) => b.phrase.length - a.phrase.length);
