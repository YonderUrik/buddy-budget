import { BITPANDA_RECONCILIATION_ERROR, validateBitpandaSettlements } from "./validate-bitpanda";
import { validateSourceAmounts } from "./validate-source-amounts";
import { parserSchema, type Outcome, type PersonalParser, type PersonalTable } from "./contract";
import { undeclaredColumns } from "./declared-columns";
import { ModelInputError, ModelOutputError, TransientError } from "./errors";
import { ZodError } from "zod";

/** Why one attempt of the ladder was rejected. */
export type AttemptReason = "unrecognized_rows" | "undeclared_columns" | "invalid_parser" | "model_output_invalid" | "model_output_truncated";
/** One rejected attempt, as stored on the job and sent to support: no file text, values or code. */
export type AttemptRecord = { step: number; model: string; reason: AttemptReason; detail?: string; count?: number; rows?: number[] };
export type AnalysisFailure = { phase: "parse" | "generate" | "fx" | "save"; reason: string; detail?: string; rows?: number[]; count?: number; fallback: boolean; attempts?: AttemptRecord[] };
export type GeneratedParser = { parser: PersonalParser; model: string };

/** What the model is told about a rejected attempt: its parser (when there was one), why, and the lines it got wrong. */
export interface ParserFeedback {
  parser?: PersonalParser;
  reason: AttemptReason;
  detail?: string;
  /** Zero-based line numbers with their raw text, at most `ladderStep.lines`. */
  lines: { row: number; text: string }[];
  moreLines: number;
  columns: { index: number; name: string }[];
}
/** One call to the model: which step, its budget, the earlier parser of this source and the feedback to act on. */
export interface GenerationRequest {
  step: number;
  reasoning: boolean;
  maxTokens: number;
  timeoutMs: number;
  /** The source's saved parser, when it no longer reads this file: a layout change is usually a small edit. */
  reference?: { parser: PersonalParser; failure: string };
  feedback: ParserFeedback[];
}

/**
 * The recovery ladder after the saved parser: Flash fresh, Flash with the last rejection, then Flash with every
 * rejection, more failing lines, reasoning on and a 128k output budget. Decided on 2026-10-31.
 */
export const LADDER_STEPS = [
  { step: 1, feedback: "none", lines: 0, reasoning: false, maxTokens: 32768, timeoutMs: 240_000 },
  { step: 2, feedback: "last", lines: 50, reasoning: false, maxTokens: 32768, timeoutMs: 240_000 },
  { step: 3, feedback: "all", lines: 200, reasoning: true, maxTokens: 131072, timeoutMs: 900_000 },
] as const;
const SAVED_STEP = 0;
const LINE_TEXT_MAX = 500;

const SAFE_ERRORS = new Set([BITPANDA_RECONCILIATION_ERROR, "Importo diverso dalla colonna originale", "Il parser non rende conto di tutte le righe", "Quantità, prezzo o provento non validi", "Valore investimento fuori limite", "Importo non valido", "Parser non deterministico", "Tempo massimo del parser superato", "Risultato troppo grande", "Risultato del parser non valido", "Parser non valido", "Parser interrotto: codice non valido o limiti superati"]);
/** Sandbox failures that say nothing about the parser: the attempt is retried, not climbed. */
const TRANSIENT_SANDBOX_ERRORS = new Set(["Sandbox non disponibile"]);
/** Report validation locations and known internal errors without copying arbitrary provider or CSV text. */
export function parserFailureDetail(error: unknown): string {
  if (error instanceof ZodError) return error.issues.slice(0, 10).map(issue => `${issue.path.map(p => typeof p === "number" ? p + 1 : p).join(".")}: ${issue.code}`).join("; ");
  if (error instanceof Error && SAFE_ERRORS.has(error.message)) return error.message;
  return "Il parser non può essere letto o eseguito in modo valido.";
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

type Execute = (parser: PersonalParser, table: PersonalTable) => Promise<Outcome[]>;
type Verdict = { ok: true; outcomes: Outcome[] } | { ok: false; failure: Omit<ParserFeedback, "lines" | "moreLines"> & { errorRows: number[] } };

/** A parser passes when every check passes, no line is an error and every header column is declared. */
export async function judgeParser(parser: PersonalParser, table: PersonalTable, execute: Execute): Promise<Verdict> {
  let outcomes: Outcome[];
  try { outcomes = await runCheckedParser(parser, table, execute); }
  catch (error) {
    if (error instanceof Error && TRANSIENT_SANDBOX_ERRORS.has(error.message)) throw new TransientError(error.message);
    return { ok: false, failure: { parser, reason: "invalid_parser", detail: parserFailureDetail(error), columns: [], errorRows: [] } };
  }
  const errors = outcomes.filter(o => o.kind === "error");
  if (errors.length) return { ok: false, failure: { parser, reason: "unrecognized_rows", detail: `${errors.length} righe su ${outcomes.length} non riconosciute`, columns: [], errorRows: errors.map(o => o.row) } };
  const columns = undeclaredColumns(parser, table);
  if (columns.length) return { ok: false, failure: { parser, reason: "undeclared_columns", detail: `${columns.length} colonne dell'intestazione non dichiarate nei metadati`, columns, errorRows: [] } };
  return { ok: true, outcomes };
}

/** Thrown when the saved parser and every step failed; `attempts` is what support receives. */
export class LadderExhaustedError extends Error {
  constructor(readonly attempts: AttemptRecord[]) { super("Nessun tentativo ha letto il file"); }
}

/**
 * Reads a file with the saved parser or, failing that, climbs the ladder. Steps already in `done` (a worker restarted
 * mid-ladder) are not repeated. `onAttempt` persists each rejection before the next call and throws when the job is
 * no longer ours. Transient errors propagate so the same step runs again later; `ModelInputError` ends the job.
 */
export async function runLadder(params: {
  table: PersonalTable;
  saved?: () => GeneratedParser;
  generate: (request: GenerationRequest) => Promise<GeneratedParser>;
  /** The model `generate` calls, for the record of an answer that could not be used. */
  model: string;
  execute: Execute;
  done?: AttemptRecord[];
  onAttempt: (record: AttemptRecord) => Promise<void>;
}): Promise<GeneratedParser & { outcomes: Outcome[]; reused: boolean; step: number }> {
  const attempts = [...(params.done ?? [])];
  const feedback: ParserFeedback[] = attempts.filter(a => a.step !== SAVED_STEP).map(a => ({ reason: a.reason, detail: a.detail, lines: [], moreLines: a.count ?? 0, columns: [] }));
  const reject = async (record: AttemptRecord) => { attempts.push(record); await params.onAttempt(record); };
  let reference: GenerationRequest["reference"];
  if (params.saved) {
    let generated: GeneratedParser | null = null;
    try { generated = params.saved(); } catch { /* unreadable saved parser: same as a failing one */ }
    const verdict = generated ? await judgeParser(generated.parser, params.table, params.execute) : null;
    if (generated && verdict?.ok) return { ...generated, outcomes: verdict.outcomes, reused: true, step: SAVED_STEP };
    const failure = verdict && !verdict.ok ? verdict.failure : null;
    if (generated && failure) reference = { parser: generated.parser, failure: failure.detail ?? failure.reason };
    if (!attempts.some(a => a.step === SAVED_STEP)) await reject({ step: SAVED_STEP, model: generated?.model ?? "saved", reason: failure?.reason ?? "invalid_parser", detail: failure?.detail, ...rowSummary(failure?.errorRows ?? []) });
  }
  // A Flash answer cut at its budget is retried only by the step with the larger budget.
  let needsBudget = attempts.some(a => a.reason === "model_output_truncated");
  for (const step of LADDER_STEPS) {
    if (attempts.some(a => a.step === step.step) || (needsBudget && step.maxTokens <= LADDER_STEPS[0].maxTokens)) continue;
    const context = step.feedback === "none" ? [] : step.feedback === "last" ? feedback.slice(-1) : feedback;
    const request: GenerationRequest = { step: step.step, reasoning: step.reasoning, maxTokens: step.maxTokens, timeoutMs: step.timeoutMs, reference, feedback: context.map(f => withLines(f, params.table, step.lines)) };
    let generated: GeneratedParser;
    try { generated = await params.generate(request); }
    catch (error) {
      if (error instanceof ModelInputError || error instanceof TransientError || !(error instanceof ModelOutputError)) throw error;
      const reason = error.truncated ? "model_output_truncated" : "model_output_invalid";
      needsBudget ||= error.truncated;
      feedback.push({ reason, detail: error.message, lines: [], moreLines: 0, columns: [] });
      await reject({ step: step.step, model: params.model, reason, detail: error.message });
      continue;
    }
    const verdict = await judgeParser(generated.parser, params.table, params.execute);
    if (verdict.ok) return { ...generated, outcomes: verdict.outcomes, reused: false, step: step.step };
    const { errorRows, ...rest } = verdict.failure;
    feedback.push({ ...rest, lines: errorRows.map(row => ({ row, text: "" })), moreLines: 0 });
    await reject({ step: step.step, model: generated.model, reason: rest.reason, detail: rest.detail, ...rowSummary(errorRows) });
  }
  throw new LadderExhaustedError(attempts);
}

/** Bounded, one-based row numbers for support: never the lines themselves. */
function rowSummary(rows: number[]) {
  return rows.length ? { count: rows.length, rows: rows.slice(0, 100).map(r => r + 1) } : {};
}
/** Attaches the raw text of the first `limit` failing lines (zero-based), for the model only. */
function withLines(feedback: ParserFeedback, table: PersonalTable, limit: number): ParserFeedback {
  const rows = feedback.lines.map(l => l.row);
  const kept = rows.slice(0, limit);
  return { ...feedback, lines: kept.map(row => ({ row, text: (table.rows[row]?.[0] ?? "").slice(0, LINE_TEXT_MAX) })), moreLines: feedback.moreLines + rows.length - kept.length };
}
