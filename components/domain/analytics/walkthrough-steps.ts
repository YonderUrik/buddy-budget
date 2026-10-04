/** Passi della guida iniziale di Analitiche: un concetto per passo, in parole semplici. */

export interface WalkthroughStep {
  title: string;
  body: string[];
}

export const WALKTHROUGH_STEPS: readonly WalkthroughStep[] = [
  {
    title: "Quattro domande, una risposta ciascuna",
    body: [
      "Analitiche è la parte di Buddy Budget per chi vuole ragionare sui numeri. È una sola pagina da leggere dall'alto: ogni sezione risponde a una domanda con una frase e un grafico.",
      "Ogni risultato è una stima basata su ipotesi che decidi tu. Non è una previsione e non è una consulenza: serve a capire quali scelte contano di più.",
    ],
  },
  {
    title: "Quanta strada ho fatto?",
    body: [
      "Il numero FIRE è il capitale che ti servirebbe per vivere con il solo patrimonio: la spesa annua divisa per il tasso di prelievo, al netto delle imposte sulle plusvalenze se lo scegli.",
      "Qui vedi quanto ne hai già e da dove è arrivata la crescita degli ultimi 12 mesi: dal tuo risparmio o dal mercato.",
    ],
  },
  {
    title: "Quando posso smettere di lavorare?",
    body: [
      "Il grafico mostra come sale il patrimonio fino al numero FIRE e l'anno in cui lo raggiungi. Sotto, due «e se…»: spendere un po' meno o risparmiare un po' di più.",
      "Se un'ipotesi cambia molto la data, fidati meno del risultato.",
    ],
  },
  {
    title: "Il patrimonio reggerà?",
    body: [
      "Un calcolo con un solo rendimento «medio» nasconde il rischio. La simulazione genera migliaia di futuri possibili e conta in quanti il patrimonio dura fino alla fine della pensione.",
      "Vedi anche come cambia la risposta con quattro modi di prelevare. Rischio e dettagli stanno in «Per esperti».",
    ],
  },
  {
    title: "Quanto mi costa il portafoglio?",
    body: [
      "Costi dei fondi e bollo, quanto erodono nel tempo e quanta imposta pagheresti vendendo tutto oggi. Il costo dei fondi (TER) lo inserisci tu in «Per esperti».",
    ],
  },
  {
    title: "Le ipotesi e «Per esperti»",
    body: [
      "In cima trovi «Le tue ipotesi» con il riepilogo sempre visibile: spesa e risparmio, se li lasci vuoti, vengono dai tuoi movimenti degli ultimi 12 mesi. Cambiale quando vuoi: tutte le risposte si aggiornano insieme.",
      "In fondo a ogni domanda, «Per esperti» apre l'analisi completa con la guida passo passo, la formula e i limiti. Puoi riaprire questa guida dal pulsante «Guida».",
    ],
  },
];
