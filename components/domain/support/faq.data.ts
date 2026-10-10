/** Risposte rapide mostrate in «Aiuto», prima del form. Testi brevi: i dettagli stanno nelle schermate. */

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const FAQ_ITEMS: readonly FaqItem[] = [
  {
    id: "banca-scaduta",
    question: "Il collegamento con la banca non si aggiorna più",
    answer:
      "Il consenso Open Banking dura al massimo 90 giorni e poi va rinnovato. Vai in Liquidità → Conti e scegli «Rinnova» sul conto: ti avvisiamo anche per email prima della scadenza.",
  },
  {
    id: "import-csv",
    question: "Come importo i movimenti o le operazioni da un file?",
    answer:
      "Da Liquidità → Conti puoi aggiungere un conto importando un CSV, e da Investimenti → Operazioni importi gli estratti del broker. Gestisci e cancella gli import da «Gestione importazioni».",
  },
  {
    id: "categoria-sbagliata",
    question: "Una transazione ha la categoria sbagliata",
    answer:
      "Tocca l'icona del movimento in Liquidità e scegli la categoria: se vuoi, la ricordiamo con una regola per i prossimi movimenti dello stesso esercente.",
  },
  {
    id: "dati-miei",
    question: "Posso scaricare o cancellare i miei dati?",
    answer: "Sì, da Impostazioni: esporti tutto in un file ZIP, azzeri i dati o elimini l'account quando vuoi.",
  },
  {
    id: "stime-fiscali",
    question: "Le stime fiscali sono una consulenza?",
    answer:
      "No. Imposte, aliquote e proiezioni sono stime a scopo informativo: per decisioni fiscali o di investimento rivolgiti a un professionista abilitato.",
  },
];
