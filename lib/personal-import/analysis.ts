import { BITPANDA_RECONCILIATION_ERROR, validateBitpandaSettlements } from "./validate-bitpanda";
import { validateSourceAmounts } from "./validate-source-amounts";
import { parserSchema, type Outcome, type PersonalParser, type PersonalTable } from "./contract";
import { ZodError } from "zod";

export type AnalysisFailure = { phase: "parse" | "generate" | "fx" | "save"; reason: string; detail?: string; rows?: number[]; count?: number; fallback: boolean };
export type GeneratedParser = { parser: PersonalParser; model: string };
const SAFE_ERRORS = new Set([BITPANDA_RECONCILIATION_ERROR, "Importo diverso dalla colonna originale", "Il parser non rende conto di tutte le righe", "Quantità, prezzo o provento non validi", "Valore investimento fuori limite", "Importo non valido", "Parser non deterministico", "Tempo massimo del parser superato", "Risultato troppo grande", "Risultato del parser non valido", "Sandbox non disponibile", "Parser non valido", "Parser interrotto: codice non valido o limiti superati"]);
/** Report validation locations and known internal errors without copying arbitrary provider or CSV text. */
export function parserFailureDetail(error: unknown): string {
  if (error instanceof ZodError) return error.issues.slice(0, 10).map(issue => `${issue.path.map(p => typeof p === "number" ? p + 1 : p).join(".")}: ${issue.code}`).join("; ");
  if (error instanceof Error && SAFE_ERRORS.has(error.message)) return error.message;
  return "Il parser salvato non può essere letto o eseguito in modo valido.";
}
/** Validate execution twice before accepting a reusable parser. */
export async function runCheckedParser(parser: PersonalParser, table: PersonalTable, execute: (parser: PersonalParser, table: PersonalTable) => Promise<Outcome[]>) {
  const outcomes = await execute(parserSchema.parse(parser), table);
  const repeated = await execute(parser, table);
  if (JSON.stringify(outcomes) !== JSON.stringify(repeated)) throw new Error("Parser non deterministico");
  validateSourceAmounts(parser, table, outcomes);
  validateBitpandaSettlements(table, outcomes);
  return outcomes;
}

/** Retry a broken saved parser with AI once; the callback durably retires it for this job before generation. */
export async function analyzeWithFallback(params: {
  table: PersonalTable;
  saved?: () => GeneratedParser;
  generate: () => Promise<GeneratedParser>;
  execute: (parser: PersonalParser, table: PersonalTable) => Promise<Outcome[]>;
  onFallback: (failure: AnalysisFailure) => Promise<void>;
}) {
  if (params.saved) {
    let failure: AnalysisFailure;
    try {
      const generated = params.saved();
      const outcomes = await runCheckedParser(generated.parser, params.table, params.execute);
      const errors = outcomes.filter(o => o.kind === "error");
      if (!errors.length) return { ...generated, outcomes, reused: true };
      failure = { phase: "parse", reason: "unrecognized_rows", rows: errors.slice(0, 100).map(o => o.row + 1), count: errors.length, fallback: true };
    } catch (error) {
      failure = { phase: "parse", reason: "invalid_saved_parser", detail: parserFailureDetail(error), fallback: true };
    }
    await params.onFallback(failure);
  }
  const generated = await params.generate();
  return { ...generated, outcomes: await runCheckedParser(generated.parser, params.table, params.execute), reused: false };
}
