import { parseBrokerStatement } from "@/lib/investments/import/parse-statement";
import { detectImportProvider, getImportProvider, type ImportProviderId } from "@/lib/investments/import/providers";
import { finecoMapping, parseFinecoTable } from "@/lib/investments/import/fineco";
import { normalizeRows } from "@/lib/investments/import/normalize";
import { parseCsv } from "@/lib/investments/import/csv";
import { ImportError } from "./contract";

/** Verify the reading failure on the server; reconciliation errors must never become an AI bypass. */
export function brokerFallbackSource(csv: string): { provider: ImportProviderId; name: string; requiresReconciliation: boolean } {
  const provider = detectImportProvider(csv) ?? "generic";
  let failed = false;
  let requiresReconciliation = false;
  try {
    if (["interactive-brokers", "degiro", "trade-republic"].includes(provider)) {
      // A successfully parsed statement, even with financial issues, stays in the reconciled import flow.
      parseBrokerStatement(csv, new Date().toISOString().slice(0, 10));
    } else if (provider === "fineco") {
      const table = parseFinecoTable(csv);
      failed = normalizeRows(table, finecoMapping(table), new Date().toISOString().slice(0, 10)).some(row => row.status === "error");
    } else {
      const table = parseCsv(csv);
      failed = table.headers.length < 2 || !table.rows.length || provider === "generic";
    }
  } catch (error) {
    failed = true;
    const message = error instanceof Error ? error.message : "";
    // Only known structural failures can switch import engines without a financial reconciliation.
    requiresReconciliation = !/CSV non valido|Virgolette CSV|numero colonne|Intestazioni duplicate|Non trovo la tabella|Serve (il CSV|l'estratto conto)|non è un Activity Statement/.test(message);
  }
  if (!failed) throw new ImportError("Il file è leggibile: completa la procedura del broker e verifica gli eventuali errori indicati.");
  return { provider, name: provider === "generic" ? "CSV da riconoscere" : getImportProvider(provider).name, requiresReconciliation };
}
