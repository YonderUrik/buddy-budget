/**
 * Import error and skip messages rewritten for the reader: what is wrong and what to do. The parsers' original words
 * stay the data (and are shown as detail); here only their presentation changes. Sources are Italian and are
 * translated into the viewer's language through the catalogs (`translateServerMessage`).
 */
import type { Language } from "@/lib/localization/config";
import { translateServerMessage } from "@/lib/localization/messages";

/** An explained problem: `text` says what is wrong, `hint` what to do (absent when there is nothing to do). */
export interface ExplainedMessage {
  text: string;
  hint?: string;
}

const CHECK_FILE = "controlla quel valore nel file, oppure riesporta il file dal broker senza modificarlo.";

/** Readable name of the fields that broker parsers cite by their technical column name. */
const FIELD_LABELS: Record<string, string> = {
  amount: "importo",
  price: "prezzo",
  shares: "quantità",
  fee: "commissione",
  tax: "imposta",
  fx_rate: "cambio",
  datetime: "data e ora",
  date: "data",
  currency: "valuta",
  isin: "ISIN",
  transaction_id: "identificativo dell'operazione",
};

/**
 * Explains the message of a row the import skips or rejects (generic normalisation or a broker parser), in `language`.
 * Unrecognised messages pass through as they were (translated when the catalog knows them), with no invented hints.
 */
export function explainRowMessage(message: string, language: Language = "it"): ExplainedMessage {
  return localizeExplained(language, explainRow(message));
}

/** A file name before the message («IBKR 2024.csv: …») is kept as is; only the message after it is translated. */
const FILE_PREFIX = /^(.+?\.(?:csv|xlsx|xls|txt)): ([\s\S]+)$/i;

/** An import message (parser, batch or server) in `language`, keeping a leading file name untouched. */
export function translateImportMessage(language: Language, message: string): string {
  if (language === "it") return message;
  const prefixed = FILE_PREFIX.exec(message);
  return prefixed ? `${prefixed[1]}: ${translateServerMessage(language, prefixed[2])}` : translateServerMessage(language, message);
}

function localizeExplained(language: Language, explained: ExplainedMessage): ExplainedMessage {
  if (language === "it") return explained;
  return { text: translateImportMessage(language, explained.text), ...(explained.hint ? { hint: translateServerMessage(language, explained.hint) } : {}) };
}

function explainRow(message: string): ExplainedMessage {
  let m: RegExpExecArray | null;
  if ((m = /^Tipo "(.*)" ignorato$/.exec(message))) {
    return { text: `«${m[1]}» non è un acquisto, una vendita né un dividendo: la salto.` };
  }
  if ((m = /^Data "(.*)" non valida$/.exec(message))) {
    return { text: `La data «${m[1]}» non esiste.`, hint: "correggila nel file (per esempio 31/02 non è un giorno valido) oppure togli la riga." };
  }
  if (message === "Vende più quote di quelle possedute a quella data") {
    return {
      text: "Questa vendita supera le quote che avevi a quella data.",
      hint: "probabilmente mancano acquisti precedenti: importa prima lo storico completo (o aggiungi l'acquisto da «Registra») e riprova, oppure escludi lo strumento al passo Strumenti.",
    };
  }
  if (message === "Data mancante") return { text: "La riga non ha la data.", hint: "compila la data nel file oppure togli la riga." };
  if (message === "Data nel futuro") return { text: "La data è nel futuro.", hint: "controlla l'anno nel file: si importano solo operazioni già avvenute." };
  if (message === "Manca lo strumento (simbolo, ISIN o nome)") {
    return { text: "La riga non dice di quale strumento si tratta.", hint: "compila almeno uno tra simbolo, ISIN e nome." };
  }
  if ((m = /^Numero "(.*)" non valido$/.exec(message))) {
    return { text: `«${m[1]}» non è un numero.`, hint: "se il numero è giusto, controlla il separatore dei decimali in «Come leggo le colonne»; altrimenti correggilo nel file." };
  }
  if (message === "Quantità mancante o zero") return { text: "La quantità manca o è zero.", hint: "compilala nel file oppure togli la riga." };
  if (message === "Prezzo mancante") return { text: "Il prezzo manca.", hint: "compilalo nel file oppure togli la riga." };
  if (message === "Prezzo zero su una vendita") return { text: "Una vendita ha prezzo zero.", hint: "controlla il prezzo nel file: solo gli acquisti possono essere gratuiti." };
  if (message === "Importo del dividendo o della cedola mancante") {
    return { text: "Manca l'importo del dividendo o della cedola.", hint: "compila la colonna dell'importo oppure togli la riga." };
  }
  if (message === "Rapporto dello split mancante (va nella colonna delle quote)") {
    return { text: "Manca il rapporto dello split.", hint: "scrivilo nella colonna delle quantità (per esempio 2 per uno split 2 a 1)." };
  }
  // Broker parsers: «Riga 225: amount non valido», «numero colonne non valido»...
  if ((m = /^(?:Riga (\d+): )?([a-z_]+) non valido$/.exec(message)) && m[2] in FIELD_LABELS) {
    const where = m[1] ? `Alla riga ${m[1]} ` : "";
    return { text: `${where}${where ? "il" : "Il"} campo «${FIELD_LABELS[m[2]]}» non contiene un valore valido.`, hint: CHECK_FILE };
  }
  if ((m = /^(?:Riga (\d+): )?numero colonne non valido$/.exec(message))) {
    return { text: `${m[1] ? `La riga ${m[1]} ha` : "Una riga ha"} un numero di colonne diverso dalle altre.`, hint: CHECK_FILE };
  }
  if ((m = /^Riga (\d+): (.*)$/.exec(message))) return { text: `Riga ${m[1]}: ${m[2]}.`.replace(/\.\.$/, "."), hint: CHECK_FILE };
  return { text: message };
}

/** Explains an error about the whole file (format, reading, rejected import), in `language`. */
export function explainFileError(message: string, language: Language = "it"): ExplainedMessage {
  return localizeExplained(language, explainFile(message));
}

function explainFile(message: string): ExplainedMessage {
  if (message.startsWith("Questo file non sembra un export di ")) {
    return { text: message.replace(/ (Sembra invece|Scegli un altro).*$/, ""), hint: /Sembra invece un file di (.+?):/.exec(message) ? `Scegli la scheda ${/Sembra invece un file di (.+?):/.exec(message)![1]}, oppure tocca di nuovo la scheda scelta per lasciar riconoscere il formato al file.` : "Scegli il broker giusto, «Altro CSV» o lascia riconoscere il formato al file." };
  }
  if (message === "Il file non sembra un CSV con intestazioni e almeno una riga") {
    return { text: "Non riesco a leggere questo file.", hint: "serve un CSV o un Excel con una riga di intestazioni e almeno un'operazione. Non vanno bene PDF, immagini o file vuoti." };
  }
  if (message === "Nel file Fineco non ci sono movimenti da importare") {
    return { text: "Nel file di Fineco non ci sono movimenti.", hint: "riesporta i movimenti del dossier titoli con un periodo in cui ci sono operazioni." };
  }
  if (message.startsWith("Nel rendiconto non ci sono acquisti")) {
    return { text: "Nel rendiconto non ci sono acquisti, vendite o dividendi di azioni ed ETF da importare.", hint: "riesporta il rendiconto con un periodo più ampio." };
  }
  if (message.startsWith("Seleziona al massimo")) return { text: message, hint: "importa i file in più volte." };
  if (message.startsWith("Ogni file deve essere più piccolo")) return { text: message, hint: "riesporta il file con un periodo più breve." };
  if (message.startsWith("La selezione supera")) return { text: message, hint: "importa i file in più volte." };
  return explainRow(message);
}
