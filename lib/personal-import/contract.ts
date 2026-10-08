import { z } from "zod";
import { parseDate } from "@/lib/investments/import/values";
import { isValidIsin } from "@/lib/validation/investments";

export class ImportError extends Error {}
export const MAX_BYTES = 25 * 1024 * 1024;
export const MAX_ROWS = 50000;
const money = z.number().finite().min(-999999999).max(999999999);
const positive = z.number().finite().min(0).max(999999999);
const base = { row: z.number().int().min(0), date: z.string().refine(v => parseDate(v, "ymd") === v && v <= new Date().toISOString().slice(0, 10), "Data non valida"), currency: z.string().regex(/^[A-Z]{3}$/), description: z.string().min(1).max(500) };
export const outcomeSchema = z.discriminatedUnion("kind", [
  z.object({ ...base, kind: z.literal("cash"), amount: money, transfer: z.boolean() }),
  z.object({ ...base, kind: z.literal("investment"), type: z.enum(["acquisto", "vendita", "dividendo", "cedola"]), name: z.string().min(1).max(200), isin: z.string().refine(isValidIsin).nullable(), instrumentType: z.enum(["azione", "etf", "fondo", "crypto", "etc", "obbligazione"]), quantity: positive, price: positive, grossAmount: positive.nullable(), fees: positive, taxes: positive }),
  z.object({ row: z.number().int().min(0), kind: z.enum(["ignore", "error"]), reason: z.string().min(1).max(300) }),
]);
export type Outcome = z.infer<typeof outcomeSchema>;
export const parserSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("javascript"), code: z.string().min(1).max(32000) }),
  z.object({ kind: z.literal("mapping"), dateColumn: z.number().int().min(0), amountColumn: z.number().int().min(0), descriptionColumn: z.number().int().min(0), currencyColumn: z.number().int().min(0).nullable(), currency: z.string().regex(/^[A-Z]{3}$/), dateOrder: z.enum(["ymd", "dmy", "mdy"]), decimal: z.enum([".", ","]) }),
]);
export type PersonalParser = z.infer<typeof parserSchema>;
export type PersonalTable = { delimiter: string; headers: string[]; rows: string[][]; layout?: "table" | "document"; rawCsv?: string; sourceLines?: number[] };
/** Preserve the file verbatim. Lines are only references for review/coverage, never CSV parsing. */
export function readRawFile(csv: string): PersonalTable {
  if (Buffer.byteLength(csv) > MAX_BYTES) throw new ImportError("Il file supera 25 MB");
  if (!csv.trim()) throw new ImportError("Il file è vuoto");
  const lines = csv.split(/\r\n|\n|\r/);
  if (lines.at(-1) === "") lines.pop();
  if (lines.length > MAX_ROWS) throw new ImportError("Il file supera 50000 righe");
  return { delimiter: "", layout: "document", headers: ["Riga originale"], rows: lines.map(line => [line]), sourceLines: lines.map((_, i) => i + 1), rawCsv: csv };
}
export function validateOutcomes(raw: unknown, table: PersonalTable): Outcome[] {
  const outcomes = z.array(outcomeSchema).max(MAX_ROWS).parse(raw);
  if (outcomes.length !== table.rows.length || new Set(outcomes.map(o => o.row)).size !== table.rows.length || outcomes.some(o => o.row >= table.rows.length)) throw new ImportError("Il parser non rende conto di tutte le righe");
  for (const o of outcomes) {
    if (o.kind === "investment") {
      if ((o.type === "acquisto" || o.type === "vendita") ? o.quantity <= 0 || o.price <= 0 : !o.grossAmount || o.quantity !== 0 || o.price !== 0) throw new ImportError("Quantità, prezzo o provento non validi");
      if (o.quantity * o.price > 999999999) throw new ImportError("Valore investimento fuori limite");
      if (o.instrumentType === "obbligazione") throw new ImportError("Le obbligazioni richiedono la verifica di nominale e rateo: usa l'importazione manuale");
    }
  }
  return outcomes.sort((a, b) => a.row - b.row);
}
