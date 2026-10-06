import type { ActivityStatement } from "./interactive-brokers";

export const IMPORT_BATCH_MAX_FILES = 20;
export const IMPORT_BATCH_MAX_BYTES = 25 * 1024 * 1024;
export interface PreparedStatementFile { name: string; text: string; parsed: ActivityStatement }

/** Validate the whole selection before reading files or starting any import. */
export function validateImportFiles(files: readonly { size: number }[]): void {
  if (files.length > IMPORT_BATCH_MAX_FILES) throw new Error(`Seleziona al massimo ${IMPORT_BATCH_MAX_FILES} file alla volta.`);
  if (files.some((f) => f.size > 5 * 1024 * 1024)) throw new Error("Ogni file deve essere più piccolo di 5 MB.");
  if (files.reduce((sum, f) => sum + f.size, 0) > IMPORT_BATCH_MAX_BYTES) throw new Error("La selezione supera 25 MB. Seleziona meno file.");
}

/** Import IBKR histories first, then DEGIRO into the existing portfolio; chronological within each account. */
export function orderStatementFiles(files: PreparedStatementFile[]): PreparedStatementFile[] {
  for (const file of files) {
    if (!file.parsed.operations.length && !file.parsed.cashMovements?.length) throw new Error(`${file.name}: nessuna operazione da importare. Carica un rendiconto con acquisti, vendite o proventi.`);
    if (!file.parsed.statement) throw new Error(`${file.name}: serve un rendiconto completo.`);
    const errors = [...file.parsed.statement.issues, ...file.parsed.issues.filter((i) => i.severity === "error").map((i) => i.message)];
    if (errors.length) throw new Error(`${file.name}: ${errors[0]}`);
  }
  return [...files].sort((a, b) => {
    const provider = Number(a.parsed.preset === "degiro") - Number(b.parsed.preset === "degiro");
    const left = a.parsed.statement!, right = b.parsed.statement!;
    return provider || left.account.localeCompare(right.account) || left.from.localeCompare(right.from) || left.to.localeCompare(right.to);
  });
}
