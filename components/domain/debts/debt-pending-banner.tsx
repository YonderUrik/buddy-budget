"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Avviso sulle rate passate non ancora segnate (da confermare o scadute), con il bottone per segnarle tutte pagate. */

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LoanPlan } from "@/lib/calc/debt-plan";
import { DEBTS_COLORS } from "./debts-theme";

export interface DebtPendingBannerProps {
  plan: LoanPlan;
  /** Segna pagate tutte le rate passate fino a quella indicata. */
  onMarkAll: (upToInstallment: number) => void;
  pending?: boolean;
}

export function DebtPendingBanner({ plan, onMarkAll, pending = false }: DebtPendingBannerProps) {
  const { t: tr } = useLocalization();
  const unsettled = plan.rows.filter((r) => r.status === "da_confermare" || r.status === "scaduta");
  if (unsettled.length === 0) return null;
  const overdue = plan.totals.overdueCount;
  const text =
    overdue > 0
      ? tr("{0} e non l'hai segnata come pagata.", { 0: overdue === 1 ? tr("Una rata è scaduta") : tr("{0} rate sono scadute", {0: overdue}) })
      : tr("Il piano conta {0}: se le hai pagate, confermale.", { 0: unsettled.length === 1 ? tr("una rata già passata") : tr("{0} rate già passate", {0: unsettled.length}) });
  return (
    <div className="flex flex-col gap-2 border-y py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-center gap-2.5 text-sm text-foreground">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-full"
          style={{ color: DEBTS_COLORS.interest, backgroundColor: `color-mix(in oklab, ${DEBTS_COLORS.interest} 16%, transparent)` }}
          aria-hidden="true"
        >
          <TriangleAlert size={16} />
        </span>
        {text}
      </p>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => onMarkAll(unsettled[unsettled.length - 1].number)}>{tr("Segna tutte come pagate")}</Button>
    </div>
  );
}
