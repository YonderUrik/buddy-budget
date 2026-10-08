"use client";

/** Dettaglio di un finanziamento: cifre, avviso sulle rate da confermare, piano rata per rata, registro eventi e azioni. */

import * as React from "react";
import { CalendarRangeIcon, HistoryIcon, PercentIcon, PiggyBankIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { PanelSection } from "@/components/domain/investments";
import type { LoanPlanRow } from "@/lib/calc/debt-plan";
import { todayIso } from "@/lib/debts/dates";
import type { DebtView } from "@/lib/debts/view";
import { cn } from "@/lib/utils";
import { useBulkPayDebtMutation, useDeleteDebtEventMutation, useDeleteDebtMutation } from "@/lib/queries/debts";
import { DebtEventDialog, type DebtEventDialogKind } from "./debt-event-dialog";
import { DebtEventsList } from "./debt-events-list";
import { DebtFacts } from "./debt-facts";
import { DebtSimulationPanel } from "./debt-simulation-panel";
import { DebtPendingBanner } from "./debt-pending-banner";
import { DebtPlanTable } from "./debt-plan-table";
import { EarlyRepaymentDialog } from "./early-repayment-dialog";
import { PayInstallmentDialog } from "./pay-installment-dialog";
import { START_MODE_LABELS } from "./debt-status";
import { DEBTS_COLORS } from "./debts-theme";

export interface DebtDetailProps {
  debt: DebtView;
  currency: string;
  /** Chiamata dopo l'eliminazione del debito (la pagina sceglie un altro debito da mostrare). */
  onDeleted: () => void;
}

export function DebtDetail({ debt, currency, onDeleted }: DebtDetailProps) {
  const today = todayIso();
  const [payRow, setPayRow] = React.useState<LoanPlanRow | null>(null);
  const [eventKind, setEventKind] = React.useState<DebtEventDialogKind | null>(null);
  const [earlyOpen, setEarlyOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const bulk = useBulkPayDebtMutation();
  const deleteEvent = useDeleteDebtEventMutation();
  const deleteDebt = useDeleteDebtMutation();

  return (
    <div className="flex flex-col gap-8 sm:gap-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-medium text-foreground">{debt.name}</h2>
          <p className="text-xs text-muted-foreground">{START_MODE_LABELS[debt.startMode]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" disabled={debt.plan.totals.finished} onClick={() => setEarlyOpen(true)}>
            <PiggyBankIcon aria-hidden="true" />
            Estinzione anticipata
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEventKind("rate_change")}>
            <PercentIcon aria-hidden="true" />
            Cambio tasso
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEventKind("balance_correction")}>
            <SlidersHorizontalIcon aria-hidden="true" />
            Correggi residuo
          </Button>
          <Button size="sm" variant="ghost" className="text-neg" onClick={() => setConfirmDelete(true)}>
            <Trash2Icon aria-hidden="true" />
            Elimina
          </Button>
        </div>
      </header>
      <DebtFacts debt={debt} currency={currency} />
      <DebtPendingBanner
        plan={debt.plan}
        pending={bulk.isPending}
        onMarkAll={(upTo) =>
          bulk.mutate(
            { debtId: debt.id, upToInstallment: upTo },
            { onSuccess: ({ count }) => toast.success(count === 1 ? "Una rata segnata come pagata" : `${count} rate segnate come pagate`), onError: (e) => toast.error(e.message) }
          )
        }
      />
      <div className="grid grid-cols-1 items-start gap-x-10 gap-y-10 lg:grid-cols-5">
        {debt.plan.totals.finished ? null : (
          <div className="min-w-0 lg:col-span-3">
            <DebtSimulationPanel debt={debt} currency={currency} onOpenEarly={() => setEarlyOpen(true)} />
          </div>
        )}
        <div className={cn("min-w-0", debt.plan.totals.finished ? "lg:col-span-5" : "lg:col-span-2")}>
          <PanelSection icon={HistoryIcon} title="Cosa hai registrato" color={DEBTS_COLORS.events}>
            <DebtEventsList
              events={debt.events}
              currency={currency}
              onDelete={(eventId) => deleteEvent.mutate({ debtId: debt.id, eventId }, { onError: (e) => toast.error(e.message) })}
            />
          </PanelSection>
        </div>
      </div>
      <PanelSection icon={CalendarRangeIcon} title="Piano delle rate" color={DEBTS_COLORS.plan}>
        <DebtPlanTable rows={debt.plan.rows} currency={currency} today={today} onPay={setPayRow} />
      </PanelSection>

      <PayInstallmentDialog debtId={debt.id} row={payRow} currency={currency} onOpenChange={(open) => !open && setPayRow(null)} />
      <EarlyRepaymentDialog debt={debt} currency={currency} open={earlyOpen} onOpenChange={setEarlyOpen} />
      <DebtEventDialog debtId={debt.id} kind={eventKind} onOpenChange={(open) => !open && setEventKind(null)} />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare «{debt.name}»?</AlertDialogTitle>
            <AlertDialogDescription>Spariscono il piano e tutto ciò che hai registrato su questo debito. Le transazioni collegate restano dove sono.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteDebt.mutate(debt.id, { onSuccess: onDeleted, onError: (e) => toast.error(e.message) })}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
