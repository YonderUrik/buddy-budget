"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Piano di ammortamento rata per rata. Di default mostra le ultime rate passate e le prossime; "Mostra tutte" le apre.
 * Ogni rata non saldata ha il suo "Segna pagata".
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { LoanPlanRow } from "@/lib/calc/debt-plan";

import { cn } from "@/lib/utils";
import { INSTALLMENT_STATUS_CLASS, INSTALLMENT_STATUS_LABELS } from "./debt-status";

/** Rate passate e future mostrate prima di "Mostra tutte". */
export const PLAN_VISIBLE_PAST = 2;
export const PLAN_VISIBLE_FUTURE = 8;

export interface DebtPlanTableProps {
  rows: LoanPlanRow[];
  currency: string;
  /** Data di oggi (ISO): separa passate e future. */
  today: string;
  onPay: (row: LoanPlanRow) => void;
}

/** Indici delle righe da mostrare di default: le ultime passate e le prime future. */
export function visibleRowRange(rows: LoanPlanRow[], today: string): [number, number] {
  const firstFuture = rows.findIndex((r) => r.dueDate >= today);
  const pivot = firstFuture === -1 ? rows.length : firstFuture;
  return [Math.max(0, pivot - PLAN_VISIBLE_PAST), Math.min(rows.length, pivot + PLAN_VISIBLE_FUTURE)];
}

export function DebtPlanTable({ rows, currency, today, onPay }: DebtPlanTableProps) {
  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency, formatDateWithYear } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
  const [showAll, setShowAll] = React.useState(false);
  const [start, end] = visibleRowRange(rows, today);
  const visible = showAll ? rows : rows.slice(start, end);
  const hidden = rows.length - visible.length;
  const money = (v: number) => formatCurrency(v, currency);

  return (
    <div className="flex flex-col gap-2">
      {/* Telefono: una scheda per rata, senza scroll laterale. */}
      <ul className="divide-y sm:hidden">
        {visible.map((row) => (
          <li key={row.number} className={cn("flex flex-col gap-1.5 py-3", row.status === "pagata" && "text-muted-foreground")}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium tabular-nums">{tr("Rata")}{" "}{row.number} · {formatDateWithYear(row.dueDate)}
              </span>
              <span className="font-heading text-base font-medium tabular-nums">{money(row.payment?.amount ?? row.installment)}</span>
            </div>
            <p className="text-xs text-muted-foreground">{tr("Capitale")}{" "}{money(row.capital)}{" "}{tr("· interessi")}{" "}{money(row.interest)}{" "}{tr("· residuo")}{" "}{money(row.residual)}
            </p>
            <div className="flex items-center gap-2">
              {row.status === "pagata" ? (
                <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs", INSTALLMENT_STATUS_CLASS.pagata)}>{INSTALLMENT_STATUS_LABELS.pagata}</span>
              ) : (
                <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => onPay(row)}>{tr("Segna pagata")}</Button>
              )}
              {row.status !== "pagata" && row.status !== "da_pagare" ? (
                <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs", INSTALLMENT_STATUS_CLASS[row.status])}>{tr(INSTALLMENT_STATUS_LABELS[row.status])}</span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[34rem] text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-2 font-medium">{tr("Rata")}</th>
              <th className="px-2 py-2 font-medium">{tr("Scadenza")}</th>
              <th className="px-2 py-2 text-right font-medium">{tr("Importo")}</th>
              <th className="px-2 py-2 text-right font-medium">{tr("Capitale")}</th>
              <th className="px-2 py-2 text-right font-medium">{tr("Interessi")}</th>
              <th className="px-2 py-2 text-right font-medium">{tr("Residuo")}</th>
              <th className="py-2 pl-2 text-right font-medium">{tr("Stato")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.number} className={cn("border-b last:border-0", row.status === "pagata" && "text-muted-foreground")}>
                <td className="py-2 pr-2 tabular-nums">{row.number}</td>
                <td className="px-2 py-2">{formatDateWithYear(row.dueDate)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(row.payment?.amount ?? row.installment)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(row.capital)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(row.interest)}</td>
                <td className="px-2 py-2 text-right tabular-nums">{money(row.residual)}</td>
                <td className="py-2 pl-2 text-right">
                  {row.status === "pagata" ? (
                    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs", INSTALLMENT_STATUS_CLASS.pagata)}>{INSTALLMENT_STATUS_LABELS.pagata}</span>
                  ) : (
                    <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onPay(row)}>{tr("Segna pagata")}</Button>
                  )}
                  {row.status !== "pagata" && row.status !== "da_pagare" ? (
                    <span className={cn("ml-1.5 inline-block rounded-full px-2 py-0.5 text-xs", INSTALLMENT_STATUS_CLASS[row.status])}>
                      {tr(INSTALLMENT_STATUS_LABELS[row.status])}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > visible.length || showAll ? (
        <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll((v) => !v)}>
          {showAll ? tr("Mostra meno") : tr("Mostra tutte le {0} rate (altre {1})", {0: rows.length, 1: hidden})}
        </Button>
      ) : null}
    </div>
  );
}
