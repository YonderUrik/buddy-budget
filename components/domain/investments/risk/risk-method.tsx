/** «Come è calcolato» per chi vuole approfondire: i passaggi del calcolo del rischio in parole semplici, con le soglie vere del codice. */

import { MIN_RELATION_OBSERVATIONS, MIN_VOLATILITY_OBSERVATIONS } from "@/lib/calc/risk";
import { RISK_LEVEL_HIGH, RISK_LEVEL_LOW, RISK_LEVEL_MEDIUM } from "@/lib/investments/risk-insights";

const pctRound = (value: number) => `${Math.round(value * 100)}%`;

interface Step {
  title: string;
  body: string;
}

/** Passaggi del calcolo, nell'ordine in cui compaiono nella scheda. */
const STEPS: Step[] = [
  {
    title: "1. Rendimento di ogni giorno",
    body: `Si parte dal rendimento giornaliero del portafoglio senza l'effetto dei versamenti e dei prelievi (il TWR, lo stesso dei rendimenti). Si scartano i giorni senza nulla di investito e i weekend fermi: con i mercati chiusi non c'è movimento e abbasserebbero il rischio. Servono almeno ${MIN_VOLATILITY_OBSERVATIONS} giorni.`,
  },
  {
    title: "2. Quanto oscilla",
    body: "È la deviazione standard dei rendimenti giornalieri, portata a un anno moltiplicandola per la radice dei giorni di borsa in un anno (circa 252). Il ± dice quanto ci si muove di solito: in circa due anni su tre il valore resta dentro quell'intervallo.",
  },
  {
    title: "3. Il livello",
    body: `Si legge l'oscillazione annua: sotto ${pctRound(RISK_LEVEL_LOW)} basso (per esempio obbligazioni), fino a ${pctRound(RISK_LEVEL_MEDIUM)} medio, fino a ${pctRound(RISK_LEVEL_HIGH)} alto (l'azionario mondiale sta intorno al 15%), oltre molto alto. Sono soglie di lettura scelte da noi, non una classificazione ufficiale.`,
  },
  {
    title: "4. Perdita peggiore",
    body: "Si costruisce un indice che parte da 1 e segue i rendimenti giornalieri (così i versamenti non lo fanno salire). La perdita peggiore è la distanza massima da un picco al punto più basso successivo; «tornato al massimo» è il giorno in cui l'indice rivede quel picco.",
  },
  {
    title: "5. Rischio ripagato (Sharpe)",
    body: `Rendimento medio giornaliero meno quello di un conto senza rischio (il tasso €STR, solo per l'euro), diviso per la deviazione standard e portato a un anno. Sotto 0 hai reso meno di un conto deposito, tra 0 e 0,5 poco, tra 0,5 e 1 discreto, sopra 1 bene. Serve almeno ${MIN_RELATION_OBSERVATIONS} giorni di dati.`,
  },
  {
    title: "6. Quanto segue l'indice",
    body: "Con un indice di confronto si usano solo i giorni in cui ci sono entrambi i prezzi. La correlazione (da −1 a 1) dice se vanno nella stessa direzione; il beta quanto si muove il portafoglio per ogni 1% dell'indice.",
  },
];

export function RiskMethod() {
  return (
    <dl className="flex flex-col gap-3">
      {STEPS.map((step) => (
        <div key={step.title} className="flex flex-col gap-0.5">
          <dt className="text-sm font-medium text-foreground">{step.title}</dt>
          <dd className="text-sm leading-snug text-muted-foreground">{step.body}</dd>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Il passato non dice come andrà in futuro: con meno di un anno di dati i numeri sono solo indicativi.</p>
    </dl>
  );
}
