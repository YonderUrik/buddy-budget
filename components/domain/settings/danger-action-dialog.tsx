"use client";

/**
 * DangerActionDialog
 *
 * Riga della zona pericolosa (titolo, spiegazione, bottone) con il dialogo di conferma. Se l'accesso non è
 * recente, o il server risponde che serve un accesso recente, il dialogo mostra la verifica d'identità al posto
 * della conferma. Il contenuto della conferma (campo da scrivere, avvisi) arriva da `children`.
 */

import * as React from "react";
import { Loader2 } from "lucide-react";
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
import type { AccountActionError } from "@/lib/queries/user-settings";
import { ReauthPanel } from "./reauth-panel";

export interface DangerActionDialogProps {
  /** Titolo della riga e del dialogo. */
  title: string;
  /** Spiegazione mostrata nella riga. */
  summary: React.ReactNode;
  /** Testo del bottone nella riga. */
  triggerLabel: string;
  /** Titolo del dialogo di conferma. */
  dialogTitle: string;
  /** Spiegazione nel dialogo: cosa succede, cosa resta. */
  dialogDescription: React.ReactNode;
  /** Testo del bottone di conferma. */
  confirmLabel: string;
  /** Conferma abilitata solo quando true (es. parola scritta correttamente). */
  canConfirm: boolean;
  pending: boolean;
  error: AccountActionError | null;
  onConfirm: () => void;
  /** Chiamata alla chiusura del dialogo, per azzerare campi ed errori. */
  onClose?: () => void;
  recentLogin: boolean;
  email: string;
  googleLinked: boolean;
  children?: React.ReactNode;
}

export function DangerActionDialog({
  title,
  summary,
  triggerLabel,
  dialogTitle,
  dialogDescription,
  confirmLabel,
  canConfirm,
  pending,
  error,
  onConfirm,
  onClose,
  recentLogin,
  email,
  googleLinked,
  children,
}: DangerActionDialogProps) {
  const [open, setOpen] = React.useState(false);
  const needsReauth = !recentLogin || (error?.reauthRequired ?? false);

  function handleOpenChange(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (!next) onClose?.();
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{summary}</p>
      </div>
      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogTrigger
          render={
            <Button variant="destructive" className="w-fit shrink-0">
              {triggerLabel}
            </Button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription render={<div />}>{dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          {needsReauth ? (
            <ReauthPanel email={email} googleLinked={googleLinked} />
          ) : (
            <>
              {children}
              {error && (
                <p className="text-sm text-neg" role="alert">
                  {error.message}
                </p>
              )}
            </>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Annulla</AlertDialogCancel>
            {!needsReauth && (
              <AlertDialogAction variant="destructive" onClick={onConfirm} disabled={!canConfirm || pending}>
                {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                {confirmLabel}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
