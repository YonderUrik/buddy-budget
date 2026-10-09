/**
 * Messaggi di errore e di scarto dell'import riscritti per chi li legge: cosa non va e cosa fare. Le parole originali
 * dei parser restano il dato (e vengono mostrate come dettaglio), qui si cambia solo come si presentano.
 */

/** Un problema spiegato: `text` dice cosa non va, `hint` cosa fare (assente se non c'è nulla da fare). */
export interface ExplainedMessage {
  text: string;
  hint?: string;
}

const CHECK_FILE = "controlla quel valore nel file, oppure riesporta il file dal broker senza modificarlo.";

/** Nome leggibile dei campi che i parser dei broker citano con il nome tecnico della colonna. */
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
 * Spiega il messaggio di una riga che l'import scarta o rifiuta (normalizzazione generica o parser di un broker).
 * I messaggi che non riconosce passano com'erano, senza suggerimenti inventati.
 */
export function explainRowMessage(message: string): ExplainedMessage {
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
  // Parser dei broker: «Riga 225: amount non valido», «numero colonne non valido»...
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

/** Spiega un errore che riguarda tutto il file (formato, lettura, import rifiutato). */
export function explainFileError(message: string): ExplainedMessage {
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
  const rowIssue = explainRowMessage(message);
  return rowIssue;
}
