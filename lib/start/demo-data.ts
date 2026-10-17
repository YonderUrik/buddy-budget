/**
 * Example data for «Esplora con dati d'esempio»: two accounts and six months of transactions, deterministic (no
 * random generator) and built on the default categories. Account names and descriptions are written in the user's
 * interface language; amounts and dates are the same in every language. Pure: knows nothing about DB or user.
 */
import type { Language } from "@/lib/localization/config";

export const DEMO_MONTHS = 6;

/** Text keys of the demo: every user-visible string the demo writes into the user's accounts and transactions. */
export type DemoTextKey =
  | "checking" | "savings" | "salary" | "saving" | "rent" | "energy" | "broadband" | "groceries"
  | "fuel" | "dinner" | "streaming" | "gym" | "online";

/** Demo texts per interface language (user-facing, so Italian is the base). */
export const DEMO_TEXTS: Record<Language, Record<DemoTextKey, string>> = {
  it: {
    checking: "Conto corrente · demo", savings: "Risparmi · demo", salary: "Stipendio", saving: "Versamento sui risparmi",
    rent: "Affitto", energy: "Luce e gas", broadband: "Fibra e mobile", groceries: "Supermercato", fuel: "Carburante",
    dinner: "Cena fuori", streaming: "Streaming video", gym: "Palestra", online: "Acquisto online",
  },
  en: {
    checking: "Current account · demo", savings: "Savings · demo", salary: "Salary", saving: "Transfer to savings",
    rent: "Rent", energy: "Electricity and gas", broadband: "Broadband and mobile", groceries: "Supermarket", fuel: "Fuel",
    dinner: "Dinner out", streaming: "Video streaming", gym: "Gym", online: "Online purchase",
  },
  de: {
    checking: "Girokonto · Demo", savings: "Ersparnisse · Demo", salary: "Gehalt", saving: "Einzahlung aufs Sparkonto",
    rent: "Miete", energy: "Strom und Gas", broadband: "Internet und Handy", groceries: "Supermarkt", fuel: "Tanken",
    dinner: "Abendessen auswärts", streaming: "Video-Streaming", gym: "Fitnessstudio", online: "Online-Einkauf",
  },
};
const CHECKING_OPENING = 1850;
const SAVINGS_BALANCE = 7200;

export interface DemoTransaction {
  /** Stable key of the default category it belongs to (`DefaultCategory.key`), independent of the language. */
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
  text: DemoTextKey;
  day: number;
  amounts: readonly number[];
}

const RECURRING: readonly Recurring[] = [
  { category: "affitto", text: "rent", day: 5, amounts: [-720] },
  { category: "bollette", text: "energy", day: 12, amounts: [-82.4, -96.1, -71.8] },
  { category: "bollette", text: "broadband", day: 9, amounts: [-34.9] },
  { category: "spesa", text: "groceries", day: 3, amounts: [-54.2, -38.7, -66.9] },
  { category: "spesa", text: "groceries", day: 17, amounts: [-47.5, -72.3, -41.1] },
  { category: "trasporti", text: "fuel", day: 8, amounts: [-48, -52.6] },
  { category: "ristoranti", text: "dinner", day: 14, amounts: [-38, -52.5, -29.9] },
  { category: "abbonamenti", text: "streaming", day: 18, amounts: [-13.99] },
  { category: "benessere", text: "gym", day: 7, amounts: [-39] },
  { category: "shopping", text: "online", day: 22, amounts: [-64, -35.9, -112] },
];

const SALARY = 2050;
const MONTHLY_SAVING = 250;

const round2 = (n: number) => Math.round(n * 100) / 100;
const pad = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Builds the example data ending at `today` (transactions after today are dropped), with texts in `language`. */
export function buildDemoData(today: Date, language: Language = "it"): DemoData {
  const text = DEMO_TEXTS[language];
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
    push(27, "stipendio", text.salary, SALARY);
    push(28, "risparmio", text.saving, -MONTHLY_SAVING);
    for (const r of RECURRING) push(r.day, r.category, text[r.text], r.amounts[index % r.amounts.length]);
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
    if (t.category === "risparmio") savingsByDate.set(t.date, (savingsByDate.get(t.date) ?? 0) + MONTHLY_SAVING);
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
    checking: { name: text.checking, type: "Conto corrente", color: "blue", icon: "landmark", balance: checkingToday },
    savings: { name: text.savings, type: "Conto deposito", color: "emerald", icon: "piggy-bank", balance: savingsToday },
    transactions,
    liquidityHistory: history,
  };
}

const DEMO_TEXT_KEYS = Object.keys(DEMO_TEXTS.it) as DemoTextKey[];

/**
 * Rewrites a demo text written in any supported language into `language`. Returns null for anything that is not a
 * demo text (for example a description the user edited), so callers never touch text they did not write.
 */
export function translateDemoText(value: string, language: Language): string | null {
  const key = DEMO_TEXT_KEYS.find((k) => Object.values(DEMO_TEXTS).some((texts) => texts[k] === value));
  return key ? DEMO_TEXTS[language][key] : null;
}
