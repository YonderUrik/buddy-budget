import type { ActivityStatement } from "./interactive-brokers";
import type { ImportRow } from "./normalize";

/**
 * Righe di anteprima dal risultato del parser di un Activity Statement: le operazioni valide diventano righe `ok`,
 * gli errori di riga righe `error`. Gli avvisi (`warning`) non sono righe: restano in `statementWarnings`.
 */
export function statementToRows(statement: ActivityStatement): ImportRow[] {
  const identities = new Map(statement.identities.map((i) => [i.key, i]));
  const rows: ImportRow[] = [];
  for (const { key, line, ...operation } of statement.operations) {
    const identity = identities.get(key);
    if (identity) rows.push({ line, status: "ok", identity, operation, warnings: [] });
  }
  for (const issue of statement.issues) {
    if (issue.severity === "error")
      rows.push({
        line: issue.line,
        status: "error",
        message: `${issue.section}: ${issue.message}`,
      });
  }
  return rows.sort((a, b) => a.line - b.line);
}

/** Avvisi del parser da mostrare all'utente: eventi che non vengono importati e vanno controllati a mano. */
export function statementWarnings(statement: ActivityStatement) {
  return statement.issues.filter((i) => i.severity === "warning");
}
