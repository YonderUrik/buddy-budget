"use client";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { useLocalization } from "@/lib/localization/provider";
import { useAccountDeletionPreviewQuery, useDeleteAccountMutation, type AccountDeletionPreview } from "@/lib/queries/accounts";

export interface AccountDeleteConfirmProps {
  accountId: string;
  accountName: string;
  /** A linked bank account is «unlinked», a manual one «deleted»: only the wording changes. */
  isAuto: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the account is gone, to close the details around it. */
  onDeleted: () => void;
}

/** True when the deletion takes investments or imports with it, not only the account and its movements. */
export function deletionTouchesInvestments(preview: AccountDeletionPreview): boolean {
  return preview.investmentCount > 0 || preview.portfolios.length > 0 || preview.imports > 0;
}

/**
 * Confirmation of an account's deletion. It first asks the server what goes with it: for an account an import created
 * (a broker's cash, a file's account) that is its portfolio, the operations and the imports, listed before confirming.
 */
export function AccountDeleteConfirm({ accountId, accountName, isAuto, open, onOpenChange, onDeleted }: AccountDeleteConfirmProps) {
  const { t: tr } = useLocalization();
  const preview = useAccountDeletionPreviewQuery(accountId, open);
  const deletion = useDeleteAccountMutation();
  const data = preview.data;
  const full = data ? deletionTouchesInvestments(data) : false;

  function confirm() {
    if (!data) return;
    deletion.mutate({ id: accountId, token: data.token }, {
      onSuccess: () => {
        track("account_removed", { kind: isAuto ? "collegato" : "manuale" });
        onOpenChange(false);
        onDeleted();
      },
    });
  }

  const removes = data ? [
    ...(data.cashCount > 0 ? [tr("{0} movimenti del conto", { 0: data.cashCount })] : []),
    ...(full ? [tr("{0} operazioni di investimento", { 0: data.investmentCount })] : []),
    ...data.portfolios.map((name) => tr("Il portafoglio «{0}»", { 0: name })),
    ...(data.imports > 0 ? [tr("{0} importazioni (rendiconti e file caricati)", { 0: data.imports })] : []),
  ] : [];

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!deletion.isPending) { deletion.reset(); onOpenChange(next); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{isAuto ? tr("Scollegare questo conto?") : tr("Eliminare questo conto?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {full
              ? tr("«{0}» viene eliminato definitivamente insieme a tutto quello che ha portato:", { 0: accountName })
              : isAuto
                ? tr("\"{0}\" verrà scollegato. L'azione non è reversibile.", { 0: accountName })
                : tr("\"{0}\" verrà eliminato definitivamente, insieme al suo saldo registrato.", { 0: accountName })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {preview.isPending ? <p role="status" className="text-sm text-text-2">{tr("Verifico cosa verrebbe eliminato…")}</p> : null}
        {preview.error ? <p role="alert" className="text-sm text-destructive">{tr(preview.error.message)}</p> : null}
        {data && (full || data.cashCount > 0) ? (
          <ul className="list-disc pl-5 text-sm">
            {removes.map((line) => <li key={line}>{line}</li>)}
          </ul>
        ) : null}
        {full ? <p className="text-sm text-text-2">{tr("Puoi riportare tutto importando di nuovo i file originali.")}</p> : null}
        {deletion.error ? <p role="alert" className="text-sm text-destructive">{tr(deletion.error.message)}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletion.isPending}>{tr("Annulla")}</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={!data || deletion.isPending}>
            {deletion.isPending ? tr("Elimino…") : isAuto ? tr("Scollega") : full ? tr("Elimina tutto") : tr("Elimina")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
