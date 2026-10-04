/** Le quattro domande a cui risponde Analitiche, nell'ordine in cui si leggono. */

export interface AnalyticsQuestion {
  /** Ancora nella pagina (e voce dell'indice). */
  id: "dove-sono" | "quando" | "reggera" | "costi";
  /** Etichetta breve dell'indice. */
  label: string;
  /** Titolo della sezione, in forma di domanda. */
  title: string;
}

export const ANALYTICS_QUESTIONS: readonly AnalyticsQuestion[] = [
  { id: "dove-sono", label: "Dove sono?", title: "Quanta strada ho fatto?" },
  { id: "quando", label: "Quando arrivo?", title: "Quando posso smettere di lavorare?" },
  { id: "reggera", label: "Reggerà?", title: "Il patrimonio reggerà nel tempo?" },
  { id: "costi", label: "Cosa mi costa?", title: "Quanto mi costa tenere il portafoglio?" },
];
