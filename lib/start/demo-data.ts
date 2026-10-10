/**
 * Dati d'esempio per «Esplora con dati d'esempio»: due conti e sei mesi di movimenti, deterministici (nessun
 * generatore casuale) e costruiti sulle categorie di default. Puro: non conosce DB né utente.
 */

export const DEMO_MONTHS = 6;
export const DEMO_CHECKING_NAME = "Conto corrente · demo";
export const DEMO_SAVINGS_NAME = "Risparmi · demo";
const CHECKING_OPENING = 1850;
const SAVINGS_BALANCE = 7200;

export interface DemoTransaction {
  /** Nome della categoria di default a cui appartiene. */
  category: string;
  description: string;
  amount: number;
  /** Data `YYYY-MM-DD`. */
  date: string;
}

export interface DemoData {
  checking: { name: string; type: string; color: string; icon: string; balance: number };
  savings: { name: string; type: string; color: string; icon: string; balance: number };
  transactions: DemoTransaction[];
  /** Liquidità complessiva a fine di ogni giorno, dal primo movimento a oggi (per il grafico del patrimonio). */
  liquidityHistory: { date: string; amount: number }[];
}

interface Recurring {
  category: string;
  description: string;
  day: number;
  amounts: readonly number[];
}

const RECURRING: readonly Recurring[] = [
  { category: "Affitto & Mutuo", description: "Affitto", day: 5, amounts: [-720] },
  { category: "Bollette & Utenze", description: "Luce e gas", day: 12, amounts: [-82.4, -96.1, -71.8] },
  { category: "Internet & Telefono", description: "Fibra e mobile", day: 9, amounts: [-34.9] },
  { category: "Spesa alimentare", description: "Supermercato", day: 3, amounts: [-54.2, -38.7, -66.9] },
  { category: "Spesa alimentare", description: "Supermercato", day: 17, amounts: [-47.5, -72.3, -41.1] },
  { category: "Trasporti & Carburante", description: "Carburante", day: 8, amounts: [-48, -52.6] },
  { category: "Ristoranti & Bar", description: "Cena fuori", day: 14, amounts: [-38, -52.5, -29.9] },
  { category: "Abbonamenti & Streaming", description: "Streaming video", day: 18, amounts: [-13.99] },
  { category: "Sport & Benessere", description: "Palestra", day: 7, amounts: [-39] },
  { category: "Shopping & Tecnologia", description: "Acquisto online", day: 22, amounts: [-64, -35.9, -112] },
];

const SALARY = 2050;
const MONTHLY_SAVING = 250;

const round2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Costruisce i dati d'esempio finiti a `today` (i movimenti futuri rispetto a oggi vengono scartati). */
export function buildDemoData(today: Date): DemoData {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayKey = dateKey(end);
  const transactions: DemoTransaction[] = [];
  for (let back = DEMO_MONTHS; back >= 0; back--) {
    const month = new Date(end.getFullYear(), end.getMonth() - back, 1);
    const index = DEMO_MONTHS - back;
    const push = (day: number, category: string, description: string, amount: number) => {
      const date = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
      if (date <= todayKey) transactions.push({ category, description, amount, date });
    };
    push(27, "Stipendio", "Stipendio", SALARY);
    push(28, "Risparmio per obiettivi", "Versamento sui risparmi", -MONTHLY_SAVING);
    for (const r of RECURRING) push(r.day, r.category, r.description, r.amounts[index % r.amounts.length]);
  }
  transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const net = transactions.reduce((sum, t) => sum + t.amount, 0);
  const savingsToday = SAVINGS_BALANCE;
  const checkingToday = round2(CHECKING_OPENING + net);

  // Storico: parte dal saldo di oggi e va a ritroso togliendo i movimenti; i risparmi crescono con i versamenti mensili.
  const byDate = new Map<string, number>();
  const savingsByDate = new Map<string, number>();
  for (const t of transactions) {
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + t.amount);
    if (t.category === "Risparmio per obiettivi") savingsByDate.set(t.date, (savingsByDate.get(t.date) ?? 0) + MONTHLY_SAVING);
  }
  const first = transactions.length ? transactions[0].date : todayKey;
  const history: { date: string; amount: number }[] = [];
  let checking = checkingToday;
  let savings = savingsToday;
  for (let d = new Date(end); dateKey(d) >= first; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)) {
    const key = dateKey(d);
    history.push({ date: key, amount: round2(checking + savings) });
    checking -= byDate.get(key) ?? 0;
    savings -= savingsByDate.get(key) ?? 0;
  }
  history.reverse();

  return {
    checking: { name: DEMO_CHECKING_NAME, type: "Conto corrente", color: "blue", icon: "landmark", balance: checkingToday },
    savings: { name: DEMO_SAVINGS_NAME, type: "Conto deposito", color: "emerald", icon: "piggy-bank", balance: savingsToday },
    transactions,
    liquidityHistory: history,
  };
}
