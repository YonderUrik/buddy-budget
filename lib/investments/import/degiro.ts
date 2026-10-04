import { parseCsvRecords } from "./csv";
import { parseDate } from "./values";
import { IMPORT_MAX_IDENTITIES, IMPORT_MAX_OPERATIONS } from "@/lib/validation/investments-import";
import { isValidIsin } from "@/lib/validation/investments";
import { IBKR_MAX_FILE_BYTES, type ActivityStatement, type ActivityOperation, type ActivityRecord } from "./interactive-brokers";
import type { ImportIdentity } from "./normalize";
import type { BrokerCashEntry } from "./broker-statement";

const HEADERS = ["Data", "Ora", "Data Valore", "Prodotto", "ISIN", "Descrizione", "Borsa", "Variazioni", "", "Saldo", "", "ID Ordine"];
const number = (raw: string) => {
  if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/.test(raw)) throw new Error("Numero DEGIRO non valido");
  const result = Number(raw.replaceAll(".", "").replace(",", "."));
  if (!Number.isFinite(result)) throw new Error("Numero DEGIRO non finito");
  return result;
};
const fee = (s: string) => s === "DEGIRO costi di transazione e/o di terze parti";
const tax = (s: string) => s.startsWith("Imposta ");
const internal = (s: string) => s === "Degiro Cash Sweep Transfer" || s.startsWith("Trasferisci ");

/** Italian DEGIRO Account.csv, including its duplicate unnamed amount columns. */
export function looksLikeDegiro(text: string): boolean {
  try { return JSON.stringify(parseCsvRecords(text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0], ",", true)[0]?.cells) === JSON.stringify(HEADERS); }
  catch { return false; }
}

/** Parse the complete cash-account export, retaining every source row and reconciling each currency balance. */
export function parseDegiroAccount(text: string, today: string): ActivityStatement {
  if (new TextEncoder().encode(text).length > IBKR_MAX_FILE_BYTES) throw new Error("File troppo grande (massimo 5 MB)");
  const csv = parseCsvRecords(text.replace(/^\uFEFF/, ""), ",", true).filter((r) => r.cells.some(Boolean));
  if (JSON.stringify(csv[0]?.cells) !== JSON.stringify(HEADERS)) throw new Error("Serve l'estratto conto DEGIRO Account.csv in italiano");
  const rows = csv.slice(1).map((r) => {
    if (r.cells.length !== HEADERS.length) throw new Error(`Riga ${r.line}: numero colonne non valido`);
    const v = r.cells; const date = parseDate(v[0], "dmy");
    if (!date || date > today || !/^\d{2}:\d{2}$/.test(v[1])) throw new Error(`Riga ${r.line}: data o ora non valida`);
    if (!/^[A-Z]{3}$/.test(v[9]) || (v[8] && !/^[A-Z]{3}$/.test(v[7]))) throw new Error(`Riga ${r.line}: valuta non valida`);
    return { line: r.line, v, date, timestamp: `${date} ${v[1]}`, description: v[5], currency: v[7], amount: v[8] ? number(v[8]) : 0, balance: number(v[10]), balanceCurrency: v[9], order: v[11], isin: v[4] };
  });
  if (!rows.length) throw new Error("Estratto conto vuoto");
  // Reverse-file order resolves same-minute entries exactly as reported by DEGIRO.
  const chronological = [...rows].sort((a, b) => a.timestamp.localeCompare(b.timestamp) || b.line - a.line);
  const from = chronological[0].date, to = chronological.at(-1)!.date;
  const issues: ActivityStatement["issues"] = [];
  const ledger: BrokerCashEntry[] = [];
  const balances = new Map<string, { opening: number; closing: number; calculated: number }>();
  for (const r of chronological) {
    if (internal(r.description)) continue; // Separate flatex sweep sub-ledger, not an additional cash movement.
    if (r.currency && r.currency !== r.balanceCurrency) throw new Error(`Riga ${r.line}: valuta movimento diversa dal saldo`);
    const previous = balances.get(r.balanceCurrency);
    const opening = previous?.opening ?? r.balance - r.amount;
    const expected = (previous?.closing ?? opening) + r.amount;
    if (Math.abs(expected - r.balance) > 0.011) issues.push({ line: r.line, section: "DEGIRO", severity: "error", message: "Saldo non riconciliato: mancano movimenti o il file non è completo" });
    balances.set(r.balanceCurrency, { opening, closing: r.balance, calculated: (previous?.calculated ?? opening) + r.amount });
    if (r.currency) ledger.push({ line: r.line, date: r.date, currency: r.currency, amount: r.amount, kind: r.description.startsWith("Acquisto ") || r.description.startsWith("Vendita ") ? "trade" : r.description, description: r.description });
  }
  const identities = new Map<string, ImportIdentity>(); const operations: ActivityOperation[] = [];
  const tradeRows = rows.filter((r) => /^(Acquisto|Vendita) /.test(r.description));
  const usedCosts = new Set<number>();
  const groupKey = (r: typeof rows[number]) => `${r.order}:${r.date}:${r.isin}`;
  const identity = (r: typeof rows[number], currency: string) => {
    if (!isValidIsin(r.isin)) throw new Error(`Riga ${r.line}: ISIN non valido`);
    const key = `isin:${r.isin}:${currency}`;
    identities.set(key, { key, symbol: r.isin, isin: r.isin, name: r.v[3], currency, symbolIsYahoo: false });
    return key;
  };
  for (const r of tradeRows) {
    const match = /^(Acquisto|Vendita) ([\d.,]+) .+@([\d.,]+) ([A-Z]{3}) \(([A-Z0-9]{12})\)$/.exec(r.description);
    if (!match || match[5] !== r.isin || !r.order) throw new Error(`Riga ${r.line}: operazione DEGIRO non riconosciuta`);
    const quantity = number(match[2]); const price = number(match[3]) / (match[4] === "GBX" ? 100 : 1);
    const currency = match[4] === "GBX" ? "GBP" : match[4];
    if (currency !== r.currency || quantity <= 0 || price <= 0 || Math.abs(quantity * price - Math.abs(r.amount)) > 0.011 || (match[1] === "Acquisto" ? r.amount >= 0 : r.amount <= 0)) throw new Error(`Riga ${r.line}: controvalore o valuta non coerenti`);
    const siblings = tradeRows.filter((t) => groupKey(t) === groupKey(r));
    const total = siblings.reduce((s, t) => s + Math.abs(t.amount), 0);
    const costs = rows.filter((t) => groupKey(t) === groupKey(r) && (fee(t.description) || tax(t.description)));
    if (costs.some((t) => t.currency !== "EUR" || t.amount > 0)) throw new Error(`Riga ${r.line}: valuta costi o rimborso commissioni non supportato`);
    costs.forEach((c) => usedCosts.add(c.line));
    const allocate = (predicate: (s: string) => boolean) => {
      const cents = Math.round(-costs.filter((c) => predicate(c.description)).reduce((s, c) => s + c.amount, 0) * 100);
      const index = siblings.indexOf(r);
      const before = siblings.slice(0, index).reduce((s, t) => s + Math.abs(t.amount), 0);
      return (Math.round(cents * (before + Math.abs(r.amount)) / total) - Math.round(cents * before / total)) / 100;
    };
    const fx = rows.filter((t) => groupKey(t) === groupKey(r) && ["Prelievo FX", "Credito FX"].includes(t.description));
    const nativeFx = fx.filter((t) => t.currency === currency).reduce((s, t) => s + t.amount, 0);
    const euroFx = fx.filter((t) => t.currency === "EUR").reduce((s, t) => s + t.amount, 0);
    const nativeTrades = siblings.reduce((s, t) => s + t.amount, 0);
    const brokerFxToEur = currency !== "EUR" && nativeFx * euroFx < 0 && Math.abs(nativeFx + nativeTrades) < 0.011 ? Math.abs(euroFx / nativeFx) : undefined;
    operations.push({ key: identity(r, currency), line: r.line, date: r.date, type: match[1] === "Acquisto" ? "acquisto" : "vendita", quantity, price: Math.abs(r.amount) / quantity, grossAmount: null, fees: allocate(fee), taxes: allocate(tax), sourceCurrency: currency, costCurrency: "EUR", brokerFxToEur, note: null });
  }
  const dividendsSeen = new Set<string>();
  for (const r of rows.filter((r) => r.description === "Dividendo")) {
    const group = `${r.date}:${r.isin}:${r.currency}`;
    if (dividendsSeen.has(group)) continue;
    dividendsSeen.add(group);
    const matching = rows.filter((t) => t.description === "Ritenuta sul dividendo" && t.date === r.date && t.isin === r.isin && t.currency === r.currency);
    const grossAmount = rows.filter((t) => t.description === "Dividendo" && t.date === r.date && t.isin === r.isin && t.currency === r.currency).reduce((s, t) => s + t.amount, 0);
    const taxes = -matching.reduce((s, t) => s + t.amount, 0);
    matching.forEach((t) => usedCosts.add(t.line));
    if (Math.abs(grossAmount) < 0.000001 && Math.abs(taxes) < 0.000001) continue; // Fully reversed and rebooked cash rows stay in the ledger.
    if (grossAmount <= 0 || taxes < 0) throw new Error(`Riga ${r.line}: rettifica dividendo netta non supportata`);
    operations.push({ key: identity(r, r.currency), line: r.line, date: r.date, type: "dividendo", quantity: 0, price: 0, grossAmount, fees: 0, taxes, sourceCurrency: r.currency, note: null });
  }
  for (const r of rows) if ((fee(r.description) || tax(r.description) || r.description === "Ritenuta sul dividendo") && !usedCosts.has(r.line)) issues.push({ line: r.line, section: "DEGIRO", severity: "error", message: "Costo o ritenuta non abbinabile a un'operazione" });
  const cashOnly = /^(Prelievo FX|Credito FX|Degiro Cash Sweep Transfer|Trasferisci |Flatex Interest|Processed Flatex Withdrawal|Prelievo flatex|Deposito(?: flatex)?$|DEGIRO commissione per corporate action|DEGIRO Costi di connessione|ADR\/GDR Commissione Pass-Through|Conversione Fondo Comune Monetario:)/;
  for (const r of rows) if (!/^(Acquisto |Vendita |Dividendo$|Ritenuta sul dividendo$)/.test(r.description) && !fee(r.description) && !tax(r.description) && !cashOnly.test(r.description)) issues.push({ line: r.line, section: "DEGIRO", severity: "error", message: "Tipo di movimento non supportato: verifica necessaria" });
  const records: ActivityRecord[] = csv.map((r, i) => ({ line: r.line, section: "DEGIRO Account", kind: i ? "Data" : "Header", headers: HEADERS, values: r.cells }));
  const cash = [...balances].map(([currency, b]) => ({ currency, ...b, difference: b.calculated - b.closing }));
  if (operations.length > IMPORT_MAX_OPERATIONS || identities.size > IMPORT_MAX_IDENTITIES) throw new Error("Il file supera i limiti di operazioni o strumenti per import");
  if (cash.some((c) => Math.abs(c.difference) > 0.011)) issues.push({ line: chronological.at(-1)!.line, section: "DEGIRO", severity: "error", message: "Totale cassa non riconciliato" });
  return { preset: "degiro", operations, identities: [...identities.values()], records, issues, statement: {
    provider: "degiro", account: "DEGIRO", currency: "EUR", from, to, valuationAvailable: false, positionsReported: false,
    nav: [{ label: "Cash", prior: balances.get("EUR")?.opening ?? 0, value: balances.get("EUR")?.closing ?? 0 }], cash, positions: [], ledger, performance: [], issues: [],
  } };
}
