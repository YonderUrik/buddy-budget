/** Dati d'esempio mostrati nella finestra del prodotto e nei riquadri: non sono dati reali di nessun utente. */

export type GroupToken = "--a-dov" | "--a-vol" | "--a-fut" | "--a-sal" | "--a-pos";

export interface DemoMovement {
  /** Testo grezzo come arriva dalla banca. */
  raw: string;
  /** Nome pulito dopo la categorizzazione. */
  name: string;
  category: string;
  token: GroupToken;
  amount: string;
  positive: boolean;
}

export const DEMO_MOVEMENTS: readonly DemoMovement[] = [
  { raw: "PAG POS ESSELUNGA MI", name: "Esselunga", category: "Dovute", token: "--a-dov", amount: "−64,20", positive: false },
  { raw: "BONIFICO SEPA SRL STIP", name: "Stipendio", category: "Entrate", token: "--a-pos", amount: "+2.150,00", positive: true },
  { raw: "ADDEBITO PAC ETF", name: "PAC ETF azionario", category: "Te futuro", token: "--a-fut", amount: "−150,00", positive: false },
  { raw: "ACCREDITO DIVIDENDO", name: "Dividendo ETF", category: "Proventi", token: "--a-pos", amount: "+38,40", positive: true },
  { raw: "PAG POS CINEMA ODEON", name: "Cinema", category: "Volute", token: "--a-vol", amount: "−18,00", positive: false },
  { raw: "RATA FINANZIAMENTO", name: "Rata finanziamento", category: "Dovute", token: "--a-dov", amount: "−410,00", positive: false },
];

/** Movimenti della schermata Movimenti (con iniziali dell'avatar). */
export const DEMO_LIST: readonly (DemoMovement & { initials: string })[] = [
  { ...DEMO_MOVEMENTS[0], initials: "Es" },
  { ...DEMO_MOVEMENTS[1], initials: "St" },
  { ...DEMO_MOVEMENTS[2], initials: "Pa" },
  { ...DEMO_MOVEMENTS[4], initials: "Ci" },
  { raw: "BONIFICO AFFITTO OTT", name: "Affitto", category: "Dovute", token: "--a-dov", amount: "−780,00", positive: false, initials: "Af" },
];

/** Esempi "testo grezzo → nome pulito" della schermata Conti. */
export const DEMO_RAW_TO_CLEAN = [
  { raw: "PAG POS 4471 ESSELUNGA MI VIA ROMA", name: "Esselunga", category: "Dovute", token: "--a-dov" },
  { raw: "BONIFICO SEPA SRL STIP 09/25 CRO 0042", name: "Stipendio", category: "Entrate", token: "--a-pos" },
  { raw: "ADDEBITO PAC FINECO ETF 150,00", name: "PAC ETF azionario", category: "Te futuro", token: "--a-fut" },
] as const;

/** Gruppi di spesa di un mese d'esempio: quota percentuale sulla barra e importo in legenda. */
export const DEMO_GROUPS = [
  { label: "Dovute", token: "--a-dov", share: 47, amount: "1.240 €" },
  { label: "Volute", token: "--a-vol", share: 23, amount: "610 €" },
  { label: "Te futuro", token: "--a-fut", share: 20, amount: "520 €" },
  { label: "Saltuarie", token: "--a-sal", share: 10, amount: "230 €" },
] as const;
