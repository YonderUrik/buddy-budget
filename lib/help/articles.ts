/**
 * The help BuddyBudget can give about itself: short answers to «how do I…» and «what is…» questions, written by us and
 * shown as they are. The «Aiuto» page lists them, «Cerca» finds them by their words, and «Chiedi all'AI» may only pick
 * some of them by id (it never writes an answer), so a reply can never describe a feature that does not exist.
 * Texts are Italian source keys, translated by the catalogs; a link leads to the page or the «Aggiungi» form that does it.
 * Data only, safe on the client and the server.
 */

export interface HelpArticle {
  /** Stable id (kebab-case): the model returns it, Umami counts it. */
  id: string;
  question: string;
  answer: string;
  /** Page that does it (pathname, with a query when needed); also decides whether the user's country has it. */
  href?: string;
  /** «Aggiungi» form that does it (`lib/quick-add/actions.ts` id), opened in place of a page. */
  quickAdd?: string;
  /** Other words people type for it, in any of the three languages («csv», «giroconto», «dark»). */
  keywords: readonly string[];
}

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    id: "import-csv",
    question: "Come importo i movimenti o le operazioni da un file?",
    answer:
      "Tocca «Aggiungi» (il + accanto alla barra in basso, o in cima al menu sul computer) e scegli «Importa un file»: trascina l'estratto conto della banca o il rendiconto del broker, anche più file insieme, e scegli la banca. Il resto succede in background e i movimenti già importati si saltano.",
    quickAdd: "file",
    keywords: ["csv", "excel", "estratto conto", "rendiconto", "broker", "importare", "caricare", "upload", "file", "datei", "kontoauszug"],
  },
  {
    id: "import-sbagliato",
    question: "Come cancello un import sbagliato?",
    answer:
      "Per gli investimenti apri Investimenti › Operazioni, «Gestisci importazioni», ed elimina il file con quello che ha portato. Per un conto nato da un file, «Elimina il conto» in Liquidità › Conti toglie anche i suoi movimenti.",
    href: "/investimenti/operazioni",
    keywords: ["annullare", "eliminare", "cancellare", "importazione", "doppio", "duplicati", "undo", "delete", "löschen"],
  },
  {
    id: "collegare-banca",
    question: "Posso collegare la mia banca?",
    answer:
      "Il collegamento Open Banking per le nuove banche arriva presto: in Liquidità › Conti, con «Nuovo conto», tocca «Tienimi aggiornato» e ti scriviamo quando è pronto. Trade Republic si collega già direttamente; per le altre banche importi l'estratto conto.",
    href: "/liquidita/conti",
    keywords: ["open banking", "collegamento", "sincronizzare", "sincronizzazione", "trade republic", "connect", "bank", "verbinden"],
  },
  {
    id: "banca-scaduta",
    question: "Il collegamento con la banca non si aggiorna più",
    answer:
      "Il consenso Open Banking dura al massimo 90 giorni e poi va rinnovato. Vai in Liquidità → Conti e scegli «Rinnova» sul conto: ti avvisiamo anche per email prima della scadenza.",
    href: "/liquidita/conti",
    keywords: ["scaduto", "rinnovare", "consenso", "aggiorna", "sync", "expired", "abgelaufen"],
  },
  {
    id: "cerca",
    question: "Come trovo un movimento, chiedo quanto ho speso o aggiungo qualcosa scrivendo una frase?",
    answer:
      "Usa «Cerca»: sul computer il campo in alto a destra o ⌘K (Ctrl K su Windows), sul telefono tira giù la pagina dall'alto o tocca «Cerca» in «Altro». Trovi movimenti, conti, titoli e impostazioni; chiedi «quanto ho speso da Netflix nel 2026?» o «saldo»; scrivi «pagato 12 € al bar ieri» e si apre il modulo già compilato. Con l'assistente AI acceso puoi chiedere anche medie e confronti: l'AI legge solo la frase, i conti li fa l'app.",
    keywords: ["cercare", "ricerca", "trovare", "spotlight", "domanda", "search", "suchen"],
  },
  {
    id: "categoria-sbagliata",
    question: "Una transazione ha la categoria sbagliata",
    answer:
      "Tocca l'icona del movimento in Liquidità e scegli la categoria: se vuoi, la ricordiamo con una regola per i prossimi movimenti dello stesso esercente.",
    href: "/liquidita",
    keywords: ["categoria", "cambiare", "correggere", "sbagliata", "category", "kategorie"],
  },
  {
    id: "regole",
    question: "Come faccio a dare sempre la stessa categoria a un esercente?",
    answer:
      "Quando scegli la categoria di un movimento, ricordala con una regola: i prossimi movimenti dello stesso esercente la prendono da soli, anche negli import. Le regole le vedi e le cancelli in Liquidità › Categorie e regole.",
    href: "/liquidita/categorie",
    keywords: ["regola", "regole", "automatica", "sempre", "esercente", "rule", "regel"],
  },
  {
    id: "dividi",
    question: "Come conto solo la mia parte di una spesa condivisa?",
    answer:
      "Tocca «Dividi» sul movimento e scegli Metà, Un terzo o un importo: la parte esclusa non conta nelle spese. Funziona anche per rimborsi e giroconti.",
    href: "/liquidita",
    keywords: ["dividere", "condivisa", "metà", "rimborso", "escludere", "split", "teilen"],
  },
  {
    id: "giroconti",
    question: "Un giroconto tra i miei conti conta come spesa?",
    answer:
      "No, se gli dai la categoria «Trasferimenti tra i miei conti»: resta tra i movimenti ma è escluso da entrate e spese.",
    href: "/liquidita",
    keywords: ["giroconto", "trasferimento", "bonifico", "miei conti", "escluso", "esclusi", "transfer", "umbuchung"],
  },
  {
    id: "budget",
    question: "Come imposto un budget?",
    answer:
      "In Liquidità › Budget trovi i budget proposti dai tuoi mesi: li accetti con un tocco o cambi l'importo di ogni categoria. Vedi quanto puoi ancora spendere oggi e dove arriva il mese.",
    href: "/liquidita/budget",
    keywords: ["budget", "limite", "spendere", "mese", "budgetieren"],
  },
  {
    id: "budget-avanzo",
    question: "Cosa succede a quello che non spendo del budget?",
    answer:
      "Di base il budget ricomincia ogni mese. Se in Liquidità → Budget accendi «Porta l'avanzo al mese dopo» su una categoria, quello che avanza (o che sfori) passa al mese successivo: per le spese saltuarie è acceso da subito, così i soldi messi da parte ci sono quando arriva la spesa.",
    href: "/liquidita/budget",
    keywords: ["avanzo", "rollover", "mese dopo", "saltuarie", "übertrag"],
  },
  {
    id: "abbonamenti",
    question: "Come vedo i miei abbonamenti?",
    answer:
      "In Liquidità › Abbonamenti trovi gli addebiti ricorrenti presi dai tuoi movimenti: li confermi o li scarti, e vedi il costo al mese e all'anno, il prossimo addebito e gli aumenti di prezzo.",
    href: "/liquidita/abbonamenti",
    keywords: ["abbonamento", "ricorrenti", "netflix", "spotify", "subscription", "abo"],
  },
  {
    id: "operazione",
    question: "Come registro un acquisto di ETF o azioni?",
    answer:
      "Tocca «Aggiungi» e scegli «Un'operazione», oppure scrivi in «Cerca» una frase come «comprato 3 VWCE a 110 € oggi». Se hai il file del broker, importalo con «Importa un file».",
    quickAdd: "operazione",
    keywords: ["acquisto", "comprare", "vendita", "etf", "azioni", "operazione", "investimento", "buy", "kaufen"],
  },
  {
    id: "prezzi",
    question: "Perché il prezzo di un titolo non è quello di adesso?",
    answer: "I prezzi sono quelli di chiusura del giorno, aggiornati tre volte al giorno: non sono in tempo reale.",
    href: "/investimenti",
    keywords: ["prezzo", "quotazione", "aggiornato", "tempo reale", "price", "kurs"],
  },
  {
    id: "mutuo",
    question: "Come aggiungo un mutuo o un prestito?",
    answer:
      "Tocca «Aggiungi» e, in «Ogni tanto», scegli «Un mutuo o un prestito»: calcoliamo il piano delle rate e gli interessi. Le rate pagate le segni tu.",
    quickAdd: "debito",
    keywords: ["mutuo", "prestito", "finanziamento", "rata", "debito", "mortgage", "loan", "kredit"],
  },
  {
    id: "obiettivo",
    question: "Come creo un obiettivo di risparmio?",
    answer:
      "Tocca «Aggiungi» e, in «Ogni tanto», scegli «Un obiettivo di risparmio»: dici quanto ti serve e quali soldi metti da parte, e vedi quando ci arrivi.",
    quickAdd: "obiettivo",
    keywords: ["obiettivo", "risparmio", "risparmiare", "casa", "viaggio", "goal", "sparziel"],
  },
  {
    id: "pensione",
    question: "Come aggiungo il fondo pensione?",
    answer:
      "Tocca «Aggiungi» e, in «Ogni tanto», scegli «Il fondo pensione»: inserisci i versamenti e il valore di oggi, e lo trovi nel patrimonio.",
    quickAdd: "pensione",
    href: "/pensione",
    keywords: ["fondo pensione", "previdenza", "tfr", "pension"],
  },
  {
    id: "nascondi-importi",
    question: "Come nascondo gli importi?",
    answer:
      "Sul computer apri il menu del tuo account in fondo alla barra laterale e scegli «Nascondi gli importi»; sul telefono lo trovi in «Altro». Utile quando mostri lo schermo a qualcuno.",
    keywords: ["nascondere", "importi", "privacy", "cifre", "hide", "ausblenden"],
  },
  {
    id: "lingua-tema",
    question: "Come cambio lingua, valuta o tema?",
    answer: "In Impostazioni › Aspetto e uso scegli lingua, valuta, paese e tema chiaro o scuro.",
    href: "/impostazioni?sezione=aspetto",
    keywords: ["lingua", "valuta", "tema", "scuro", "inglese", "tedesco", "language", "dark", "sprache"],
  },
  {
    id: "notifiche",
    question: "Come ricevo il riepilogo o gli avvisi per email?",
    answer:
      "In Impostazioni › Notifiche e AI accendi il riepilogo (mensile o settimanale), gli avvisi sul budget e quelli sulle prossime rate. In ogni email c'è il link per disiscriverti.",
    href: "/impostazioni?sezione=notifiche",
    keywords: ["email", "notifiche", "riepilogo", "avvisi", "newsletter", "benachrichtigung"],
  },
  {
    id: "assistente-ai",
    question: "Cosa vede l'AI dei miei dati?",
    answer:
      "Niente, finché non accendi «Assistente AI» in Impostazioni. Per proporre le categorie riceve il nome pulito dell'esercente, se è un'entrata o un'uscita e le tue categorie, mai importi, date, IBAN o note; in «Cerca» riceve solo la frase che scrivi. Sempre con zero data retention.",
    href: "/impostazioni?sezione=notifiche",
    keywords: ["ai", "intelligenza artificiale", "assistente", "privacy", "dati", "ki", "datenschutz"],
  },
  {
    id: "dati-miei",
    question: "Posso scaricare o cancellare i miei dati?",
    answer: "Sì, da Impostazioni: esporti tutto in un file ZIP, azzeri i dati o elimini l'account quando vuoi.",
    href: "/impostazioni?sezione=privacy",
    keywords: ["esportare", "scaricare", "zip", "backup", "cancellare", "eliminare account", "export", "löschen"],
  },
  {
    id: "dati-d-esempio",
    question: "Posso provare l'app con dati d'esempio?",
    answer:
      "Sì: in Panoramica, tra i «Primi passi», scegli «Esplora con dati d'esempio». Li azzeri con un tocco e non si mescolano mai con i tuoi.",
    href: "/panoramica",
    keywords: ["esempio", "demo", "prova", "provare", "sample", "beispiel"],
  },
  {
    id: "telefono",
    question: "C'è l'app per il telefono?",
    answer: "Funziona dal browser del telefono e si mette sulla schermata Home come un'app.",
    keywords: ["telefono", "iphone", "android", "app", "smartphone", "handy"],
  },
  {
    id: "stime-fiscali",
    question: "Le stime fiscali sono una consulenza?",
    answer:
      "No. Imposte, aliquote e proiezioni sono stime a scopo informativo: per decisioni fiscali o di investimento rivolgiti a un professionista abilitato.",
    keywords: ["tasse", "imposte", "consulenza", "consiglio", "commercialista", "steuer", "beratung"],
  },
];

export const HELP_ARTICLE_IDS = HELP_ARTICLES.map((article) => article.id) as [string, ...string[]];

const BY_ID = new Map(HELP_ARTICLES.map((article) => [article.id, article]));

/** The article with that id, if there is one. */
export function helpArticle(id: string): HelpArticle | undefined {
  return BY_ID.get(id);
}
