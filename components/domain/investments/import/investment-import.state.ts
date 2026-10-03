import type { Instrument, InstrumentType } from "@/lib/db/schema/investments";
import type { CsvTable } from "@/lib/investments/import/csv";
import { normalizeHeader, type ImportMapping } from "@/lib/investments/import/mapping";
import type { ImportIdentity, ImportRow } from "@/lib/investments/import/normalize";
import type { ImportMatch } from "@/lib/investments/import/types";
import type { CreateInstrumentInput } from "@/lib/validation/investments";
import type { RunImportInput } from "@/lib/validation/investments-import";

/** Passi del wizard di import. */
export const IMPORT_STEPS = ["file", "mapping", "instruments", "summary"] as const;
export type ImportStep = (typeof IMPORT_STEPS)[number];

/** Etichette dei passi nello stepper: per un rendiconto già strutturato il secondo passo è un controllo, non la mappatura. */
export function importStepLabel(step: ImportStep, structured: boolean): string {
  if (step === "mapping") return structured ? "Controllo" : "Colonne";
  return { file: "File", instruments: "Strumenti", summary: "Riepilogo" }[step];
}

/** Scelta dell'utente per uno strumento del file. */
export type InstrumentChoice =
  | { kind: "known"; instrument: Instrument }
  | {
      kind: "create";
      input: CreateInstrumentInput;
      label: string;
      detail: string;
      type: InstrumentType;
      confidence: "exact" | "guess";
    }
  | { kind: "skip"; reason: "not_found" | "unavailable" };

/** Scelta iniziale dall'abbinamento del server: se non l'ha trovato, lo strumento resta escluso finché non si sceglie. */
export function choiceFromMatch(match: ImportMatch): InstrumentChoice {
  if (match.kind === "known") return { kind: "known", instrument: match.instrument };
  if (match.kind === "proposal") {
    const { input, label, detail, type, confidence } = match;
    return { kind: "create", input, label, detail, type, confidence };
  }
  return { kind: "skip", reason: match.reason };
}

/**
 * Richiesta di import dalle righe valide e dalle scelte: si escludono le righe degli strumenti non trovati o esclusi
 * dall'utente. `null` se non resta nessuna operazione.
 */
export function buildImportRequest(
  rows: ImportRow[],
  choices: Record<string, InstrumentChoice>,
  excluded: ReadonlySet<string>,
  dryRun: boolean,
  preset: string | null,
): RunImportInput | null {
  const instruments: RunImportInput["instruments"] = [];
  for (const [key, choice] of Object.entries(choices)) {
    if (excluded.has(key)) continue;
    if (choice.kind === "known") instruments.push({ key, instrumentId: choice.instrument.id });
    else if (choice.kind === "create") instruments.push({ key, create: choice.input });
  }
  const included = new Set(instruments.map((i) => i.key));
  const operations = rows.flatMap((row) =>
    row.status === "ok" && included.has(row.identity.key) ? [{ key: row.identity.key, line: row.line, ...row.operation }] : [],
  );
  if (operations.length === 0) return null;
  return { dryRun, preset, instruments, operations };
}

/** Nome leggibile di uno strumento del file, per la lista di abbinamento. */
export function identityLabel(identity: ImportIdentity): string {
  return [identity.symbol, identity.isin, identity.name].filter(Boolean).join(" · ");
}

/** Chiave con cui ricordare la mappatura di un formato: le intestazioni del file. */
export function mappingStorageKey(headers: string[]): string {
  return `bb-import-mapping:${headers.map(normalizeHeader).join("|")}`;
}

/** Mappatura salvata per queste intestazioni, se valida per il file (colonne esistenti). */
export function readSavedMapping(table: CsvTable): ImportMapping | null {
  try {
    const raw = window.localStorage.getItem(mappingStorageKey(table.headers));
    if (!raw) return null;
    const saved = JSON.parse(raw) as ImportMapping;
    const valid = Object.values(saved.columns ?? {}).every((c) => Number.isInteger(c) && c >= 0 && c < table.headers.length);
    return valid && saved.dateOrder && saved.decimal ? saved : null;
  } catch {
    return null;
  }
}

/** Ricorda la mappatura per il prossimo file con le stesse intestazioni (comodità per chi importa ogni mese). */
export function saveMapping(table: CsvTable, mapping: ImportMapping): void {
  try {
    window.localStorage.setItem(mappingStorageKey(table.headers), JSON.stringify(mapping));
  } catch {
    // Solo una comodità: senza storage si rifà la mappatura.
  }
}

/** Quanto uno strumento richiede attenzione: prima i non trovati, poi le proposte incerte, poi il resto. */
export function attentionRank(choice: InstrumentChoice | undefined): number {
  if (!choice || choice.kind === "skip") return 0;
  return choice.kind === "create" && choice.confidence === "guess" ? 1 : 2;
}
