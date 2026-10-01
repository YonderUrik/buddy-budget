"use client";

/** Dettaglio di un finanziamento: cifre, avviso sulle rate da confermare, piano rata per rata, registro eventi e azioni. */

import * as React from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LoanPlanRow } from "@/lib/calc/debt-plan";
import { todayIso } from "@/lib/debts/dates";
import type { DebtView } from "@/lib/debts/view";
import { useBulkPayDebtMutation, useDeleteDebtEventMutation, useDeleteDebtMutation } from "@/lib/queries/debts";
import { DebtEventDialog, type DebtEventDialogKind } from "./debt-event-dialog";
import { DebtEventsList } from "./debt-events-list";
import { DebtFacts } from "./debt-facts";
import { DebtPendingBanner } from "./debt-pending-banner";
import { DebtPlanTable } from "./debt-plan-table";
import { EarlyRepaymentDialog } from "./early-repayment-dialog";
import { PayInstallmentDialog } from "./pay-installment-dialog";
import { START_MODE_LABELS } from "./debt-status";

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
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="font-heading text-lg font-medium text-foreground">{debt.name}</CardTitle>
          <p className="text-xs text-muted-foreground">{START_MODE_LABELS[debt.startMode]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" disabled={debt.plan.totals.finished} onClick={() => setEarlyOpen(true)}>
            Estinzione anticipata
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEventKind("rate_change")}>
            Cambio tasso
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEventKind("balance_correction")}>
            Correggi residuo
          </Button>
          <Button size="sm" variant="ghost" className="text-neg" onClick={() => setConfirmDelete(true)}>
            Elimina
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
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
        <section aria-label="Piano delle rate" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Piano delle rate</h3>
          <DebtPlanTable rows={debt.plan.rows} currency={currency} today={today} onPay={setPayRow} />
        </section>
        <section aria-label="Eventi" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cosa hai registrato</h3>
          <DebtEventsList
            events={debt.events}
            currency={currency}
            onDelete={(eventId) => deleteEvent.mutate({ debtId: debt.id, eventId }, { onError: (e) => toast.error(e.message) })}
          />
        </section>
      </CardContent>

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
    </Card>
  );
}
