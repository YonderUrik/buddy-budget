"use client";

/**
 * The body of an analysis card in «Cerca»: a split as bars with names (categories, merchants, accounts), a time split as
 * a small bar chart (months, weeks, years, weekdays), or the movements themselves. Drawn with plain elements (no chart
 * library: the panel stays light). Every row opens what it is about: Movimenti filtered, or the movement's detail.
 */

import { ReceiptTextIcon } from "lucide-react";
import { MerchantLogo } from "@/components/domain/categorization/light";
import { formatCurrency, formatShortDate } from "@/lib/format";
import { useLocalization } from "@/lib/localization/provider";
import { barTick, formatFigure, rowLabel, type AnalysisAnswer } from "@/lib/search/analysis-text";
import type { AnalysisLinkedRow } from "@/lib/search/types";
import { cn } from "@/lib/utils";

export interface AnalysisRowsProps {
  answer: AnalysisAnswer;
  currency: string;
  phone: boolean;
  onOpenRow: (row: AnalysisLinkedRow) => void;
}

/** Height of the time chart, as a Tailwind class (the bars fill it in proportion). */
const CHART_HEIGHT = "h-24";

export function AnalysisRows({ answer, currency, phone, onOpenRow }: AnalysisRowsProps) {
  const { result } = answer;
  if (result.rowsKind === "serie") return <AnalysisBars answer={answer} currency={currency} onOpenRow={onOpenRow} />;
  if (result.rowsKind === "gruppi") return <AnalysisSplit answer={answer} currency={currency} phone={phone} onOpenRow={onOpenRow} />;
  if (result.rowsKind === "movimenti") return <AnalysisMovements answer={answer} currency={currency} phone={phone} onOpenRow={onOpenRow} />;
  return null;
}

/** Names with a bar each, biggest first, and «Altri» for the rest. */
function AnalysisSplit({ answer, currency, phone, onOpenRow }: AnalysisRowsProps) {
  const { t: tr, locale } = useLocalization();
  const { rows, others } = answer.result;
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), others?.value ?? 0, 1);
  return (
    <ul className="flex flex-col">
      {rows.map((row, index) => (
        <li key={row.key}>
          <button type="button" tabIndex={-1} onClick={() => onOpenRow(row)} className={cn("flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left hover:bg-foreground/5", phone ? "min-h-12 py-1.5" : "min-h-10 py-1")}>
            {row.logoPath !== null || row.text !== undefined ? <MerchantLogo name={row.label} logoPath={row.logoPath} size="sm" className="size-7" /> : null}
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate">{rowLabel(row.label, row.labelKind, locale, tr)}</span>
                <span className="shrink-0 font-heading tabular-nums">{formatFigure(answer, row.value, currency, locale, tr)}</span>
              </span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-foreground/[0.07]">
                <span className={cn("block h-full rounded-full", index === 0 ? "bg-sun" : "bg-foreground/25")} style={{ width: `${Math.max(2, (Math.abs(row.value) / max) * 100)}%` }} />
              </span>
            </span>
          </button>
        </li>
      ))}
      {others ? (
        <li className="flex items-baseline justify-between gap-3 px-2 py-1.5 text-sm text-text-3">
          <span>{tr("Altri {0}", { 0: String(others.groups) })}</span>
          <span className="font-heading tabular-nums">{formatFigure(answer, others.value, currency, locale, tr)}</span>
        </li>
      ) : null}
    </ul>
  );
}

/** A small bar chart in time order: the highest bar in yellow, a tick under each, the value in its tooltip. */
function AnalysisBars({ answer, currency, onOpenRow }: Omit<AnalysisRowsProps, "phone">) {
  const { t: tr, locale } = useLocalization();
  const { rows } = answer.result;
  const max = Math.max(...rows.map((row) => Math.abs(row.value)), 1);
  // The winner of a «which month» question, else the highest bar.
  const topIndex = answer.result.top ? rows.findIndex((row) => row.key === answer.result.top!.key) : -1;
  const highest = topIndex >= 0 ? topIndex : rows.reduce((best, row, index) => (row.value > (rows[best]?.value ?? 0) ? index : best), 0);
  // Every tick fits up to 13 bars; beyond, every other one (the tooltip still names each).
  const tickEvery = rows.length > 13 ? 2 : 1;
  return (
    <div className="px-2">
      <div className={cn("flex items-end gap-1", CHART_HEIGHT)}>
        {rows.map((row, index) => {
          const label = rowLabel(row.label, row.labelKind, locale, tr);
          const value = formatFigure(answer, row.value, currency, locale, tr);
          return (
            <button
              key={row.key}
              type="button"
              tabIndex={-1}
              title={`${label}: ${value}`}
              aria-label={`${label}: ${value}`}
              onClick={() => onOpenRow(row)}
              className="group flex h-full min-w-0 flex-1 cursor-pointer items-end"
            >
              <span
                className={cn("block w-full rounded-t-md transition-colors group-hover:bg-foreground/45", index === highest && row.value !== 0 ? "bg-sun group-hover:bg-sun-hover" : "bg-foreground/20", row.value < 0 && answer.query.direction === "netto" && "bg-neg/60")}
                style={{ height: `${row.value === 0 ? 2 : Math.max(4, (Math.abs(row.value) / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1 text-[11px] text-text-3">
        {rows.map((row, index) => (
          <span key={row.key} className="min-w-0 flex-1 truncate text-center">
            {index % tickEvery === 0 ? barTick(row.label, row.labelKind, locale) : ""}
          </span>
        ))}
      </div>
      {rows[highest] && rows[highest].value !== 0 && topIndex < 0 ? (
        <p className="mt-2 text-xs text-text-3">
          {tr("Il più alto: {0} · {1}", { 0: rowLabel(rows[highest].label, rows[highest].labelKind, locale, tr), 1: formatFigure(answer, rows[highest].value, currency, locale, tr) })}
        </p>
      ) : null}
    </div>
  );
}

/** The movements a list or a «biggest» question found: logo, name, day, amount; a tap opens the movement. */
function AnalysisMovements({ answer, currency, phone, onOpenRow }: AnalysisRowsProps) {
  const { locale } = useLocalization();
  const sign = answer.query.direction === "uscite" ? -1 : 1;
  return (
    <ul className="flex flex-col">
      {answer.result.rows.map((row) => (
        <li key={row.key}>
          <button type="button" tabIndex={-1} onClick={() => onOpenRow(row)} className={cn("flex w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left hover:bg-foreground/5", phone ? "min-h-12 py-1.5" : "min-h-10 py-1")}>
            <MerchantLogo
              name={row.label}
              logoPath={row.logoPath}
              size="sm"
              className="size-7"
              fallback={
                <span className="flex size-full items-center justify-center rounded-full bg-foreground/[0.07] text-primary">
                  <ReceiptTextIcon className="size-3.5" aria-hidden="true" />
                </span>
              }
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{row.label}</span>
              <span className="block text-xs text-text-3">{row.date ? formatShortDate(row.date, locale) : ""}</span>
            </span>
            <span className={cn("shrink-0 font-heading text-sm tabular-nums", sign > 0 && "text-pos")}>{formatCurrency(sign * row.value, currency, { locale })}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
