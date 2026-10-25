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
      "Tocca «Aggiungi» (il + nella barra in basso, o in cima al menu sul computer) e scegli «Movimenti da un file» per il CSV o l'Excel della banca, o «Il rendiconto del broker» per gli investimenti. Gestisci e cancella gli import da «Gestione importazioni».",
  },
  {
    id: "cerca",
    question: "Come trovo un movimento, chiedo quanto ho speso o aggiungo qualcosa scrivendo una frase?",
    answer:
      "Usa «Cerca»: sul computer il campo in alto a destra o ⌘K (Ctrl K su Windows), sul telefono tira giù la pagina dall'alto o tocca «Cerca» in «Altro». Trovi movimenti, conti, titoli, abbonamenti e impostazioni. Puoi anche chiedere «quanto ho speso da Netflix nel 2026?», «spese di ottobre», «saldo», «patrimonio», «quanto vale Apple» o «prossima rata»: la cifra la calcola l'app sui tuoi dati e il risultato apre i movimenti che somma (con le parole, conta gli ultimi 24 mesi). Se scrivi una frase come «pagato 12 € al bar ieri» si apre il modulo già compilato, da controllare e salvare. Se non capisce la frase o la domanda puoi chiederla all'AI, che riceve soltanto la frase, mai le tue cifre, e solo se hai acceso l'assistente.",
  },
  {
    id: "categoria-sbagliata",
    question: "Una transazione ha la categoria sbagliata",
    answer:
      "Tocca l'icona del movimento in Liquidità e scegli la categoria: se vuoi, la ricordiamo con una regola per i prossimi movimenti dello stesso esercente.",
  },
  {
    id: "budget-avanzo",
    question: "Cosa succede a quello che non spendo del budget?",
    answer:
      "Di base il budget ricomincia ogni mese. Se in Liquidità → Budget accendi «Porta l'avanzo al mese dopo» su una categoria, quello che avanza (o che sfori) passa al mese successivo: per le spese saltuarie è acceso da subito, così i soldi messi da parte ci sono quando arriva la spesa.",
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
