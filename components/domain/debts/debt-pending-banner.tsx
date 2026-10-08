"use client";

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
  const unsettled = plan.rows.filter((r) => r.status === "da_confermare" || r.status === "scaduta");
  if (unsettled.length === 0) return null;
  const overdue = plan.totals.overdueCount;
  const text =
    overdue > 0
      ? `${overdue === 1 ? "Una rata è scaduta" : `${overdue} rate sono scadute`} e non l'hai segnata come pagata.`
      : `Il piano conta ${unsettled.length === 1 ? "una rata già passata" : `${unsettled.length} rate già passate`}: se le hai pagate, confermale.`;
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
      <Button size="sm" variant="outline" disabled={pending} onClick={() => onMarkAll(unsettled[unsettled.length - 1].number)}>
        Segna tutte come pagate
      </Button>
    </div>
  );
}
