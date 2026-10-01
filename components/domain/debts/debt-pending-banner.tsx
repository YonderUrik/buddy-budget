"use client";

/** Avviso sulle rate passate non ancora segnate (da confermare o scadute), con il bottone per segnarle tutte pagate. */

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LoanPlan } from "@/lib/calc/debt-plan";

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
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/50 p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2 text-sm text-foreground">
        <TriangleAlert size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {text}
      </p>
      <Button size="sm" variant="outline" disabled={pending} onClick={() => onMarkAll(unsettled[unsettled.length - 1].number)}>
        Segna tutte come pagate
      </Button>
    </div>
  );
}
