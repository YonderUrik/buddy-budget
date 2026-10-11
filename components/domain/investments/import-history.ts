/**
 * Elenco delle importazioni fatte, pronto da mostrare: unisce rendiconti dei broker e CSV personali in righe con titolo,
 * periodo, data di caricamento, dettagli e stato, raggruppate per origine. Solo presentazione: non tocca i dati.
 */

import { getImportProvider } from "@/lib/investments/import/providers";
import type { BrokerStatement } from "@/lib/investments/import/broker-statement";
import { personalImportLabels, type PersonalImportListing } from "@/lib/queries/personal-imports";

export type ImportStatusTone = "ok" | "warning" | "error" | "pending";

export interface ImportHistoryItem {
  /** Chiave stabile (tipo + id). */
  key: string;
  kind: "broker" | "personal";
  id: string;
  /** Origine mostrata come titolo del gruppo (es. «DEGIRO»). */
  source: string;
  /** Periodo coperto dal rendiconto, già leggibile; assente per i CSV personali. */
  period: string | null;
  createdAt: string;
  /** Dettagli brevi dopo la data (posizioni, movimenti di cassa). */
  details: string[];
  status: { label: string; tone: ImportStatusTone };
}

export interface ImportHistoryGroup {
  source: string;
  items: ImportHistoryItem[];
}

const DATE = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", year: "numeric" });

/** `2025-01-31` → `31 gen 2025`; un valore che non è una data resta com'è. */
export function formatImportDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : DATE.format(date);
}

/** Periodo leggibile; un solo giorno si scrive una volta. */
export function formatImportPeriod(from: string, to: string): string {
  return from === to ? formatImportDate(from) : `${formatImportDate(from)} – ${formatImportDate(to)}`;
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function brokerSource(statement: BrokerStatement): string {
  if (statement.provider === "trade-republic") return getImportProvider("trade-republic").name;
  if (statement.provider === "degiro") return getImportProvider("degiro").name;
  return `${getImportProvider("interactive-brokers").name} · conto …${statement.account.slice(-4)}`;
}

function personalStatus(status: string): ImportHistoryItem["status"] {
  const label = personalImportLabels[status] ?? status;
  if (status === "imported") return { label, tone: "ok" };
  if (status === "failed" || status === "review_failed") return { label, tone: "error" };
  if (status === "expired") return { label, tone: "warning" };
  return { label, tone: "pending" };
}

/** Righe dell'elenco, dalla più recente; raggruppate poi da `groupImports`. */
export function buildImportHistory(
  statements: { id: string; createdAt: string; statement: BrokerStatement }[],
  personal: PersonalImportListing | undefined,
): ImportHistoryItem[] {
  const formatNames = new Map(personal?.formats.map((f) => [f.id, f.name]) ?? []);
  const broker = statements.map<ImportHistoryItem>(({ id, createdAt, statement }) => {
    const warnings = statement.issues.length;
    return {
      key: `broker:${id}`,
      kind: "broker",
      id,
      source: brokerSource(statement),
      period: formatImportPeriod(statement.from, statement.to),
      createdAt,
      details: [
        ...(statement.positions.length > 0 ? [plural(statement.positions.length, "posizione", "posizioni")] : []),
        ...(statement.ledger.length > 0 ? [plural(statement.ledger.length, "movimento di cassa", "movimenti di cassa")] : []),
      ],
      status: warnings > 0 ? { label: plural(warnings, "avviso", "avvisi"), tone: "warning" } : { label: "Importato", tone: "ok" },
    };
  });
  const custom = (personal?.jobs ?? []).map<ImportHistoryItem>((job) => ({
    key: `personal:${job.id}`,
    kind: "personal",
    id: job.id,
    source: formatNames.get(job.formatId) ?? "CSV personale",
    period: null,
    createdAt: job.createdAt,
    details: ["CSV personale"],
    status: personalStatus(job.status),
  }));
  return [...broker, ...custom].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Raggruppa per origine mantenendo l'ordine di recenza (il gruppo con l'importazione più recente è primo). */
export function groupImports(items: ImportHistoryItem[]): ImportHistoryGroup[] {
  const groups = new Map<string, ImportHistoryItem[]>();
  for (const item of items) groups.set(item.source, [...(groups.get(item.source) ?? []), item]);
  return [...groups.entries()].map(([source, grouped]) => ({ source, items: grouped }));
}
