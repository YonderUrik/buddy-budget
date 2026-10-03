/** Passi della guida iniziale di Analitiche: un concetto per passo, in parole semplici. */

export interface WalkthroughStep {
  title: string;
  body: string[];
}

export const WALKTHROUGH_STEPS: readonly WalkthroughStep[] = [
  {
    title: "A cosa serve questa sezione",
    body: [
      "Analitiche è la parte di Buddy Budget per chi vuole ragionare sui numeri: indipendenza finanziaria (FIRE), scenari futuri, rischio e costi. Non ripete ciò che trovi già nelle altre sezioni.",
      "Ogni risultato è una stima basata su ipotesi che decidi tu. Non è una previsione e non è una consulenza: serve a capire quali scelte contano di più.",
      "In cima a ogni scheda trovi la «Guida passo passo», che ti accompagna sui tuoi numeri uno alla volta; sotto ogni analisi il riquadro «Come leggerla e come è calcolata» spiega formula e limiti, così nessun numero resta un mistero.",
    ],
  },
  {
    title: "Le ipotesi: il punto di partenza",
    body: [
      "In cima a ogni scheda c'è «Le tue ipotesi»: tasso di prelievo, rendimento atteso, volatilità, anni di pensione, spesa e risparmio.",
      "I valori iniziali sono prudenti e ogni campo spiega che cosa significa. Spesa e risparmio, se li lasci vuoti, vengono dai tuoi movimenti degli ultimi 12 mesi.",
      "Cambiale quando vuoi: i risultati di tutte le schede si aggiornano insieme.",
    ],
  },
  {
    title: "Obiettivo FIRE",
    body: [
      "Il numero FIRE è il capitale che ti servirebbe per vivere con il solo patrimonio: la spesa annua divisa per il tasso di prelievo.",
      "Vedi quanto ne hai già, tra quanti anni lo raggiungi, quanto cambiano gli anni se cambiano le ipotesi e il Coast FIRE: il capitale che da solo crescerebbe fino al traguardo.",
      "Il numero tiene conto delle imposte sulle plusvalenze, perché il patrimonio che puoi davvero spendere è quello dopo le tasse.",
    ],
  },
  {
    title: "Simulazione e prelievi",
    body: [
      "Un calcolo con un solo rendimento «medio» nasconde il rischio. La simulazione Monte Carlo genera migliaia di futuri possibili e conta in quanti il patrimonio dura fino alla fine.",
      "La scheda Prelievi confronta quattro modi di prelevare (fisso, percentuale, Guyton-Klinger, Vanguard dinamico) sugli stessi scenari: vedi quanto guadagni in probabilità di successo e quanto devi essere disposto a tagliare le spese nei casi peggiori.",
    ],
  },
  {
    title: "Crescita, rischio, costi e tasse",
    body: [
      "Crescita: quanto del tuo aumento di patrimonio viene dal risparmio e quanto dal mercato.",
      "Rischio: volatilità, perdite nei giorni peggiori, quali posizioni pesano di più sul rischio totale.",
      "Costi e tasse: quanto ti costa ogni anno il portafoglio (costi dei fondi, bollo), quanto erodono nel tempo e quanta imposta pagheresti vendendo tutto oggi. Il costo dei fondi (TER) lo inserisci tu.",
    ],
  },
  {
    title: "Come usarla bene",
    body: [
      "Parti dalle ipotesi più prudenti e allontanati solo se hai un motivo. Se un risultato dipende molto da una sola ipotesi, fidati meno.",
      "Puoi riaprire questa guida dal pulsante «Guida» in alto e tornare qui quando vuoi: nessuna ipotesi è definitiva.",
    ],
  },
];
