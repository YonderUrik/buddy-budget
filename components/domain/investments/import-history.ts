/**
 * Elenco delle importazioni fatte, pronto da mostrare: unisce rendiconti dei broker e CSV personali in righe con titolo,
 * periodo, data di caricamento, dettagli e stato, raggruppate per origine. Solo presentazione: non tocca i dati.
 */

import { languageOfLocale } from "@/lib/localization/config";
import { translate, type MessageValues } from "@/lib/localization/messages";
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

/** `2025-01-31` → `31 gen 2025` (it-IT) / `31 Jan 2025` (en-GB); a value that is not a date stays as it is. */
export function formatImportDate(value: string, locale = "it-IT"): string {
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** Readable period in the user's locale; a single day is written once. */
export function formatImportPeriod(from: string, to: string, locale = "it-IT"): string {
  return from === to ? formatImportDate(from, locale) : `${formatImportDate(from, locale)} – ${formatImportDate(to, locale)}`;
}

type Translate = (source: string, values?: MessageValues) => string;

/** "1 avviso" / "3 avvisi": `one` and `many` are Italian sources with `{0}` for the count. */
function plural(t: Translate, n: number, one: string, many: string): string {
  return t(n === 1 ? one : many, { 0: n });
}

function brokerSource(statement: BrokerStatement, t: Translate): string {
  if (statement.provider === "trade-republic") return getImportProvider("trade-republic").name;
  if (statement.provider === "degiro") return getImportProvider("degiro").name;
  return t("{0} · conto …{1}", { 0: getImportProvider("interactive-brokers").name, 1: statement.account.slice(-4) });
}

function personalStatus(status: string, t: Translate): ImportHistoryItem["status"] {
  const label = personalImportLabels[status] ? t(personalImportLabels[status]) : status;
  if (status === "imported") return { label, tone: "ok" };
  if (status === "failed" || status === "review_failed") return { label, tone: "error" };
  if (status === "expired") return { label, tone: "warning" };
  return { label, tone: "pending" };
}

/** List rows, newest first, with texts in the language of `locale`; grouped afterwards by `groupImports`. */
export function buildImportHistory(
  statements: { id: string; createdAt: string; statement: BrokerStatement }[],
  personal: PersonalImportListing | undefined,
  locale = "it-IT",
): ImportHistoryItem[] {
  const t: Translate = (source, values) => translate(languageOfLocale(locale), source, values);
  const formatNames = new Map(personal?.formats.map((f) => [f.id, f.name]) ?? []);
  const broker = statements.map<ImportHistoryItem>(({ id, createdAt, statement }) => {
    const warnings = statement.issues.length;
    return {
      key: `broker:${id}`,
      kind: "broker",
      id,
      source: brokerSource(statement, t),
      period: formatImportPeriod(statement.from, statement.to, locale),
      createdAt,
      details: [
        ...(statement.positions.length > 0 ? [plural(t, statement.positions.length, "{0} posizione", "{0} posizioni")] : []),
        ...(statement.ledger.length > 0 ? [plural(t, statement.ledger.length, "{0} movimento di cassa", "{0} movimenti di cassa")] : []),
      ],
      status: warnings > 0 ? { label: plural(t, warnings, "{0} avviso", "{0} avvisi"), tone: "warning" } : { label: t("Importato"), tone: "ok" },
    };
  });
  const custom = (personal?.jobs ?? []).map<ImportHistoryItem>((job) => ({
    key: `personal:${job.id}`,
    kind: "personal",
    id: job.id,
    source: formatNames.get(job.formatId) ?? t("CSV personale"),
    period: null,
    createdAt: job.createdAt,
    details: [t("CSV personale")],
    status: personalStatus(job.status, t),
  }));
  return [...broker, ...custom].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/** Raggruppa per origine mantenendo l'ordine di recenza (il gruppo con l'importazione più recente è primo). */
export function groupImports(items: ImportHistoryItem[]): ImportHistoryGroup[] {
  const groups = new Map<string, ImportHistoryItem[]>();
  for (const item of items) groups.set(item.source, [...(groups.get(item.source) ?? []), item]);
  return [...groups.entries()].map(([source, grouped]) => ({ source, items: grouped }));
}
