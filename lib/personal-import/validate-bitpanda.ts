import { parseCsvRecords } from "@/lib/investments/import/csv";
import { ImportError, type Outcome, type PersonalTable } from "./contract";

export const BITPANDA_RECONCILIATION_ERROR = "Il parser non riconcilia importi, quantità e commissioni del CSV Bitpanda";
const COLUMNS = ["Transaction ID", "Timestamp", "Transaction Type", "In/Out", "Amount Fiat", "Fiat", "Amount Asset", "Asset", "Asset market price", "Asset market price currency", "Asset class", "Product ID", "Fee", "Fee asset", "Fee percent", "Spread", "Spread Currency", "Tax Fiat"];

/** Verify Bitpanda's inclusive fiat settlements independently of AI code, including reused parsers. */
export function validateBitpandaSettlements(table: PersonalTable, outcomes: Outcome[]) {
  if (!table.rawCsv) return;
  const records = parseCsvRecords(table.rawCsv, ",");
  const header = records.findIndex(r => r.cells[0] === "Transaction ID" && r.cells[1] === "Timestamp");
  if (header < 0 || !records.slice(0, header).some(r => r.cells.length === 1 && r.cells[0].trim() === "Venue: Bitpanda")) return;
  const fail = () => { throw new ImportError(BITPANDA_RECONCILIATION_ERROR); };
  if (records[header].cells.join("|") !== COLUMNS.join("|")) fail();
  const byRow = new Map(outcomes.map(o => [o.row, o]));
  for (const record of records.slice(0, header + 1)) {
    const outcome = byRow.get(record.line - 1);
    if (outcome?.kind === "cash" || outcome?.kind === "investment") fail();
  }
  const number = (value: string) => {
    if (!/^\d+(?:\.\d+)?$/.test(value)) return fail();
    const n = Number(value);
    if (!Number.isFinite(n)) return fail();
    return n;
  };
  const cents = (value: number) => Math.round(value * 100);
  for (const record of records.slice(header + 1)) {
    if (record.cells.every(c => !c.trim())) continue;
    const o = byRow.get(record.line - 1), r = record.cells;
    // Unrecognized rows remain reviewable, but must never be silently ignored.
    if (o?.kind === "error") continue;
    if (!o || (o.kind !== "cash" && o.kind !== "investment")) { fail(); continue; }
    if (r.length !== COLUMNS.length) fail();
    const amount = number(r[4]), fee = number(r[12]), tax = number(r[17]);
    if (o.currency !== r[5] || o.date !== r[1].slice(0, 10) || tax !== 0 || (fee > 0 && r[13] !== r[5])) fail();
    if (r[2] === "deposit" || r[2] === "withdrawal") {
      const incoming = r[2] === "deposit";
      // Crypto transfers, charged transfers and tax semantics need separate reconciliation support.
      if (r[10] !== "Fiat" || r[7] !== r[5] || fee !== 0 || r[3] !== (incoming ? "incoming" : "outgoing")) fail();
      if (o.kind !== "cash" || cents(o.amount) !== cents(incoming ? amount : -amount)) fail();
    } else if (r[2] === "buy" || r[2] === "sell") {
      const buy = r[2] === "buy";
      if (r[10] !== "Cryptocurrency" || r[9] !== r[5] || r[3] !== (buy ? "outgoing" : "incoming")) fail();
      if (o.kind !== "investment") { fail(); continue; }
      if (o.type !== (buy ? "acquisto" : "vendita") || o.instrumentType !== "crypto" || Math.abs(o.quantity - number(r[6])) > 1e-12 || cents(o.fees) !== cents(fee) || o.taxes !== 0) fail();
      // Amount Fiat is the debit/credit, not gross principal before fees.
      const settlement = o.quantity * o.price + (buy ? o.fees : -o.fees);
      if (cents(settlement) !== cents(amount)) fail();
    } else fail();
  }
}
