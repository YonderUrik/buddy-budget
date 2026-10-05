"use client";

/** Dettaglio di una linea di credito: utilizzo, cifre, andamento, addebiti degli interessi, registro e azioni. */

import * as React from "react";
import { ArrowDownToLineIcon, ArrowUpFromLineIcon, PercentIcon, ReceiptTextIcon, SettingsIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
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
import type { CreditLineView } from "@/lib/debts/view";
import { useDeleteDebtEventMutation, useDeleteDebtMutation } from "@/lib/queries/debts";
import { CreditLineChart } from "./credit-line-chart";
import { CreditLineCharges } from "./credit-line-charges";
import { CreditLineFacts } from "./credit-line-facts";
import { CreditLineRateSim } from "./credit-line-rate-sim";
import { CreditLineSettingsDialog } from "./credit-line-settings-dialog";
import { CreditLineUsage } from "./credit-line-usage";
import { DebtEventDialog, type DebtEventDialogKind } from "./debt-event-dialog";
import { DebtEventsList } from "./debt-events-list";

export interface CreditLineDetailProps {
  line: CreditLineView;
  currency: string;
  /** Chiamata dopo l'eliminazione (la pagina sceglie un'altra linea da mostrare). */
  onDeleted: () => void;
}

export function CreditLineDetail({ line, currency, onDeleted }: CreditLineDetailProps) {
  const [eventKind, setEventKind] = React.useState<DebtEventDialogKind | null>(null);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const deleteEvent = useDeleteDebtEventMutation();
  const deleteLine = useDeleteDebtMutation();

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle className="font-heading text-lg font-medium text-foreground">{line.name}</CardTitle>
          <p className="text-xs text-muted-foreground">Linea di credito · interessi {line.interestFrequency === "monthly" ? "ogni mese" : "ogni trimestre"}{line.capitalizeInterest ? ", sommati al capitale" : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setEventKind("draw")}>
            <ArrowUpFromLineIcon aria-hidden="true" />
            Utilizzo
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEventKind("repay")}>
            <ArrowDownToLineIcon aria-hidden="true" />
            Rimborso
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEventKind("interest_charged")}>
            <ReceiptTextIcon aria-hidden="true" />
            Interessi addebitati
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEventKind("rate_change")}>
            <PercentIcon aria-hidden="true" />
            Cambio indice
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEventKind("balance_correction")}>
            <SlidersHorizontalIcon aria-hidden="true" />
            Correggi saldo
          </Button>
          <Button size="sm" variant="outline" onClick={() => setSettingsOpen(true)}>
            <SettingsIcon aria-hidden="true" />
            Impostazioni
          </Button>
          <Button size="sm" variant="ghost" className="text-neg" onClick={() => setConfirmDelete(true)}>
            <Trash2Icon aria-hidden="true" />
            Elimina
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <CreditLineUsage line={line} currency={currency} />
        <CreditLineFacts line={line} currency={currency} />
        <CreditLineRateSim line={line} currency={currency} />
        <section aria-label="Andamento dell'utilizzato" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quanto hai utilizzato nel tempo</h3>
          <CreditLineChart line={line} currency={currency} />
        </section>
        <section aria-label="Addebiti degli interessi" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Interessi addebitati</h3>
          <CreditLineCharges charges={line.plan.charges} currency={currency} />
        </section>
        <section aria-label="Eventi" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cosa hai registrato</h3>
          <DebtEventsList
            events={line.events}
            currency={currency}
            creditLine
            onDelete={(eventId) => deleteEvent.mutate({ debtId: line.id, eventId }, { onError: (e) => toast.error(e.message) })}
          />
        </section>
      </CardContent>

      <DebtEventDialog debtId={line.id} creditLine kind={eventKind} onOpenChange={(open) => !open && setEventKind(null)} />
      <CreditLineSettingsDialog line={line} open={settingsOpen} onOpenChange={setSettingsOpen} />
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare «{line.name}»?</AlertDialogTitle>
            <AlertDialogDescription>Spariscono l&apos;andamento e tutto ciò che hai registrato su questa linea.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteLine.mutate(line.id, { onSuccess: onDeleted, onError: (e) => toast.error(e.message) })}>Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
