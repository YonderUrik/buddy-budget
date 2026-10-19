"use client";

/**
 * Detail of one transaction, opened by tapping it in any list (Movimenti, Categorizza, a subscription). A bottom sheet
 * on the phone and a window on desktop, like every dialog in the app. Inside it the user can change the category,
 * split, write a note and, for transactions typed by hand, edit or delete; another transaction from the same merchant
 * opens in the same window. `placeholder` is the row the list already has, shown at once while the rest arrives.
 */

import * as React from "react";
import { PencilIcon, SplitIcon, Trash2Icon, XIcon } from "lucide-react";
import { TransactionEditPanel } from "@/components/domain/expenses";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { track, type TransactionDetailSource } from "@/lib/analytics";
import { authClient } from "@/lib/auth/client";
import { useLocalization } from "@/lib/localization/provider";
import { useCategoriesQuery, useCategoryUsageQuery } from "@/lib/queries/categories";
import {
  TransactionNotFoundError,
  useDeleteTransactionMutation,
  useTransactionDetailQuery,
  useUpdateTransactionMutation,
  type ListedTransaction,
  type TransactionDetail,
} from "@/lib/queries/transactions";
import { MovementDetailView } from "./movement-detail-view";
import { SplitPanel } from "./split-panel";

export interface MovementDetailDialogProps {
  /** Transaction to show; `null` = closed. */
  transactionId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Where it was opened from, for the product event. */
  from: TransactionDetailSource;
  /** The row already in the list, shown while the detail loads. */
  placeholder?: ListedTransaction;
}

type Mode = "dettaglio" | "dividi" | "modifica";

/** Body of the open dialog for one transaction; remounted (`key`) when another one opens. */
function DetailBody({ id, placeholder, onOpenMovement, onClose }: { id: string; placeholder?: ListedTransaction; onOpenMovement: (id: string) => void; onClose: () => void }) {
  const { t: tr } = useLocalization();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const query = useTransactionDetailQuery(id, placeholder);
  const categories = useCategoriesQuery().data ?? [];
  const usage = useCategoryUsageQuery().data;
  const update = useUpdateTransactionMutation();
  const remove = useDeleteTransactionMutation();
  const [mode, setMode] = React.useState<Mode>("dettaglio");
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  if (query.isError && !query.data) {
    const gone = query.error instanceof TransactionNotFoundError;
    return (
      <div className="flex flex-col gap-4 py-2">
        <DialogTitle className="text-xl">{gone ? tr("Questo movimento non c'è più") : tr("Impossibile caricare il movimento")}</DialogTitle>
        <p className="text-sm text-text-2">{gone ? tr("Forse è stato eliminato o sostituito da un nuovo import.") : tr("Controlla la connessione e riprova.")}</p>
        <div className="flex gap-2">
          {gone ? null : <Button className="h-11 px-5" onClick={() => query.refetch()}>{tr("Riprova")}</Button>}
          <Button variant="outline" className="h-11 px-5" onClick={onClose}>{tr("Chiudi")}</Button>
        </div>
      </div>
    );
  }
  if (!query.data) {
    return (
      <div className="flex min-h-[28rem] flex-col gap-4" aria-busy="true">
        <DialogTitle className="sr-only">{tr("Dettaglio del movimento")}</DialogTitle>
        <span className="size-14 animate-pulse rounded-full bg-muted" />
        <span className="h-9 w-3/4 animate-pulse rounded-full bg-muted" />
        <span className="h-10 w-1/2 animate-pulse rounded-full bg-muted" />
        <span className="h-16 w-full animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const detail: TransactionDetail = query.data;
  const transaction = detail.transaction;
  const full = Math.abs(Number(transaction.amount));
  const isManual = transaction.source === "manuale";
  const isTransfer = categories.find((c) => c.id === transaction.categoryId)?.type === "trasferimento";

  if (mode === "dividi") {
    return (
      <div className="flex flex-col gap-3">
        <DialogTitle className="text-xl">{tr("Dividi {0}", { 0: transaction.description })}</DialogTitle>
        <SplitPanel
          title={transaction.description}
          total={full}
          excluded={Math.abs(Number(transaction.excludedAmount))}
          currency={currency}
          isIncome={Number(transaction.amount) > 0}
          saving={update.isPending}
          onSave={(excludedAmount) => update.mutate({ id: transaction.id, input: { excludedAmount } }, { onSuccess: () => setMode("dettaglio") })}
          onCancel={() => setMode("dettaglio")}
          className="m-0 bg-transparent p-0"
        />
      </div>
    );
  }
  if (mode === "modifica") {
    return (
      <div className="flex flex-col gap-3">
        <DialogTitle className="text-xl">{tr("Modifica movimento")}</DialogTitle>
        <TransactionEditPanel transaction={transaction} currency={currency} onClose={() => setMode("dettaglio")} className="border-0 bg-transparent p-0" />
      </div>
    );
  }

  const actions = (
    <>
      {isTransfer ? null : (
        <Button type="button" variant="outline" className="h-11 px-4" onClick={() => setMode("dividi")}>
          <SplitIcon aria-hidden="true" />{tr("Dividi")}</Button>
      )}
      {isManual ? (
        <>
          <Button type="button" variant="outline" className="h-11 px-4" onClick={() => setMode("modifica")}>
            <PencilIcon aria-hidden="true" />{tr("Modifica")}</Button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger render={<Button type="button" variant="destructive" className="h-11 px-4" />}>
              <Trash2Icon aria-hidden="true" />{tr("Elimina")}</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{tr("Eliminare questo movimento?")}</AlertDialogTitle>
                <AlertDialogDescription>{"«"}{transaction.description}{tr("» verrà eliminato definitivamente.")}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{tr("Annulla")}</AlertDialogCancel>
                <AlertDialogAction disabled={remove.isPending} onClick={() => remove.mutate(transaction.id, { onSuccess: () => { setConfirmOpen(false); onClose(); } })}>
                  {remove.isPending ? tr("Eliminazione…") : tr("Elimina")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}
    </>
  );

  return (
    <MovementDetailView
      detail={detail}
      partial={query.isPlaceholderData}
      categories={categories}
      usage={usage}
      currency={currency}
      onOpenMovement={onOpenMovement}
      actions={actions}
    />
  );
}

export function MovementDetailDialog({ transactionId, onOpenChange, from, placeholder }: MovementDetailDialogProps) {
  const { t: tr } = useLocalization();
  // Another transaction of the same merchant opens in place: the window stays, only its content changes.
  const [shownId, setShownId] = React.useState(transactionId);
  const [openedId, setOpenedId] = React.useState(transactionId);
  // On close the last one stays in place, so the window does not empty while it slides away.
  if (openedId !== transactionId && transactionId !== null) {
    setOpenedId(transactionId);
    setShownId(transactionId);
  }

  React.useEffect(() => {
    if (transactionId) track("transaction_detail_opened", { from });
  }, [transactionId, from]);

  function openMovement(id: string) {
    track("transaction_detail_opened", { from: "esercente" });
    setShownId(id);
  }

  return (
    <Dialog open={transactionId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg sm:max-h-[90dvh] sm:overflow-y-auto">
        <DialogClose
          aria-label={tr("Chiudi")}
          className="absolute top-4 right-4 z-10 hidden size-9 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:grid"
        >
          <XIcon className="size-5" aria-hidden="true" />
        </DialogClose>
        {shownId ? (
          <DetailBody key={shownId} id={shownId} placeholder={shownId === transactionId ? placeholder : undefined} onOpenMovement={openMovement} onClose={() => onOpenChange(false)} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
