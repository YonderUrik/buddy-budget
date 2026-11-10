import "server-only";
import { parseBrokerStatement } from "@/lib/investments/import/parse-statement";
import { detectImportProvider, getImportProvider, type ImportProviderId } from "@/lib/investments/import/providers";
import { finecoMapping, parseFinecoTable } from "@/lib/investments/import/fineco";
import { initialMapping } from "@/lib/investments/import/presets";
import { normalizeRows, type ImportIdentity } from "@/lib/investments/import/normalize";
import { parseCsv } from "@/lib/investments/import/csv";
import { runStatementImport } from "@/lib/investments/import/execute-statement";
import { runImport, type ImportDeps } from "@/lib/investments/import/execute";
import type { ImportMatch, ImportResult } from "@/lib/investments/import/types";
import type { RunImportInput } from "@/lib/validation/investments-import";
import { brokerFallbackSource } from "./broker-fallback";
import { ImportError } from "./contract";
import { TransientError } from "./errors";

/** Brokers whose own export a built-in reader imports, without AI and (for statements) with cash reconciliation. */
export type NativeProvider = Exclude<ImportProviderId, "generic">;
const STATEMENTS: NativeProvider[] = ["interactive-brokers", "degiro", "trade-republic"];

/**
 * What the built-in readers did with a file:
 * - `none`: not a known broker export, the AI reads it;
 * - `fallback`: a known broker, but its reader cannot read this file's structure, so the AI may;
 * - `imported`: saved by the reader (`result` as the broker import returns it);
 * - `failed`: readable but refused (reconciliation, overlap, instruments): the worker hands it to the AI with the
 *   reader's message, and support gets that message.
 */
export type NativeOutcome =
  | { kind: "none" }
  | { kind: "fallback"; provider: NativeProvider }
  | { kind: "imported"; provider: NativeProvider; name: string; result: ImportResult }
  | { kind: "failed"; provider: NativeProvider; name: string; message: string };

type Instruments = RunImportInput["instruments"];
type Entry = Instruments[number];

/**
 * The instrument choice the broker wizard would propose, taken without asking: a known instrument, the market
 * proposal, or else a manual instrument with the file's own name, ISIN and currency (prices can be linked later).
 */
export function entryFor(identity: ImportIdentity, match: ImportMatch): Entry | null {
  if (match.kind === "known") return { key: identity.key, instrumentId: match.instrument.id };
  if (match.kind === "proposal") return { key: identity.key, create: match.input };
  const name = identity.name ?? identity.symbol ?? identity.isin;
  if (!name || !identity.currency) return null;
  return { key: identity.key, create: { source: "manuale", name: name.slice(0, 200), type: identity.type ?? "azione", currency: identity.currency, ...(identity.isin ? { isin: identity.isin } : {}) } };
}

/**
 * Refusals that come from a source being down, not from the file: the job is retried later instead of handing the
 * file to the AI or, worse, saving a security without prices for good.
 */
const OUTAGE_MESSAGES = [/Fonte prezzi non raggiungibile/, /^Cambio storico non disponibile/, /^Cambio non disponibile/];

function throwIfOutage(message: string | undefined): void {
  if (message && OUTAGE_MESSAGES.some((pattern) => pattern.test(message))) throw new TransientError(message);
}

async function resolveAll(identities: ImportIdentity[], resolve: (identity: ImportIdentity) => Promise<ImportMatch>): Promise<Instruments | string> {
  const entries: Instruments = [];
  for (const identity of identities) {
    const match = await resolve(identity);
    // The market sources did not answer (after the patient retries): a manual instrument now would stay without prices.
    if (match.kind === "none" && match.reason === "unavailable") throw new TransientError("Fonte prezzi non raggiungibile");
    const entry = entryFor(identity, match);
    if (!entry) return `Non riesco a riconoscere lo strumento ${identity.symbol ?? identity.isin ?? identity.key}`;
    entries.push(entry);
  }
  return entries;
}

/**
 * Tries the built-in reader of the broker the file comes from. Detection is by content (`detectImportProvider`),
 * whatever source name the user typed. Statements are re-read and reconciled by `runStatementImport`; Fineco and
 * Yahoo exports use their automatic column mapping and go through `runImport` into the default portfolio.
 */
export async function importNatively(userId: string, csv: string, deps: { importDeps: ImportDeps; resolve: (identity: ImportIdentity) => Promise<ImportMatch> }): Promise<NativeOutcome> {
  const provider = detectImportProvider(csv);
  if (!provider) return { kind: "none" };
  const name = getImportProvider(provider).name;
  // The same server check as the old wizard's AI fallback: only a structural failure may go to the AI.
  try {
    const failure = brokerFallbackSource(csv);
    return failure.requiresReconciliation ? { kind: "failed", provider, name, message: `Il rendiconto ${name} non si riconcilia: controlla che sia completo e non modificato.` } : { kind: "fallback", provider };
  } catch (error) {
    if (!(error instanceof ImportError)) throw error;
  }
  const today = deps.importDeps.todayKey;
  // A dry run first: a file the reader refuses (overlap, reconciliation, a row it cannot import) leaves nothing behind,
  // not even the securities it would have created.
  let run: (dryRun: boolean) => Promise<ImportResult>;
  if (STATEMENTS.includes(provider)) {
    const parsed = parseBrokerStatement(csv, today);
    const instruments = await resolveAll(parsed.identities, deps.resolve);
    if (typeof instruments === "string") return { kind: "failed", provider, name, message: instruments };
    run = dryRun => runStatementImport(userId, { dryRun, statementCsv: csv, preset: provider, instruments, operations: [] }, deps.importDeps);
  } else {
    const table = provider === "fineco" ? parseFinecoTable(csv) : parseCsv(csv);
    const mapping = provider === "fineco" ? finecoMapping(table) : initialMapping(table).mapping;
    const rows = normalizeRows(table, mapping, today);
    const ok = rows.flatMap(row => row.status === "ok" ? [row] : []);
    if (!ok.length) return { kind: "fallback", provider };
    // A row the reader cannot read (a date, a number, a missing price) is never dropped: the AI reads the whole file.
    // Rows it skips on purpose (stamp duty, operations that are not trades) stay skipped.
    const unreadable = rows.filter(row => row.status === "error");
    if (unreadable.length) return { kind: "failed", provider, name, message: `${unreadable.length} righe del file ${name} non si leggono (prima: riga ${unreadable[0].line}, ${unreadable[0].status === "error" ? unreadable[0].message : ""})` };
    const identities = [...new Map(ok.map(row => [row.identity.key, row.identity])).values()];
    const instruments = await resolveAll(identities, deps.resolve);
    if (typeof instruments === "string") return { kind: "failed", provider, name, message: instruments };
    run = dryRun => runImport(userId, { dryRun, preset: provider, instruments, operations: ok.map(row => ({ key: row.identity.key, line: row.line, ...row.operation })) }, deps.importDeps);
  }
  for (const dryRun of [true, false]) {
    const result = await run(dryRun);
    throwIfOutage(result.error);
    if (result.error) return { kind: "failed", provider, name, message: result.error };
    if (result.counts.error > 0) {
      const first = result.rows.find(row => row.status === "error");
      throwIfOutage(first && "message" in first ? first.message : undefined);
      return { kind: "failed", provider, name, message: `${result.counts.error} righe del file ${name} non si possono importare: nessuna operazione salvata.` };
    }
    if (!dryRun) return { kind: "imported", provider, name, result };
  }
  throw new Error("unreachable");
}
