"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { useInvestmentResetPreview, useResetInvestmentsMutation } from "@/lib/queries/investments";

const CONFIRMATION = "AZZERA INVESTIMENTI";

/** Explicit recovery for duplicated legacy imports, which cannot be distinguished from manual operations. */
export function ResetInvestments() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const preview = useInvestmentResetPreview();
  const reset = useResetInvestmentsMutation();
  function review() {
    setConfirmation("");
    preview.reset();
    reset.reset();
    setOpen(true);
    preview.mutate();
  }
  async function confirm() {
    if (!preview.data || confirmation !== CONFIRMATION) return;
    try {
      await reset.mutateAsync({ revision: preview.data.revision, confirmation });
      setOpen(false);
    } catch { /* Keep the dialog open with the error and a fresh-review action. */ }
  }
  return <div className="rounded-xl border p-4">
    <h3 className="font-medium">Riparti da zero</h3>
    <p className="my-2 text-sm text-muted-foreground">Numeri duplicati dopo un vecchio import? Azzera lo storico investimenti e poi importa nuovamente i CSV completi, dal più vecchio al più recente.</p>
    <Button variant="destructive" className="h-auto whitespace-normal text-left" onClick={review}>Rimuovi tutti gli import e azzera gli investimenti</Button>
    {reset.isSuccess && !open ? <p role="status" className="mt-3 text-sm">Investimenti azzerati. Ora puoi reimportare i rendiconti completi.</p> : null}
    <AlertDialog open={open} onOpenChange={(value) => { if (!reset.isPending) setOpen(value); }}>
      <AlertDialogContent className="max-h-[85dvh] overflow-y-auto data-[size=default]:sm:max-w-xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Azzerare tutto lo storico investimenti?</AlertDialogTitle>
          <AlertDialogDescription>I vecchi import non sono distinguibili dalle operazioni manuali. Questa azione elimina tutte le operazioni di investimento, anche quelle inserite a mano, tutti i rendiconti e i prezzi personali. Cancella lo storico del valore degli investimenti e azzera la liquidità dei conti collegati agli import. Non è annullabile: per ripristinare i dati servono i CSV originali.</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm">Conti bancari e relativi movimenti, budget, debiti e pensioni restano invariati. Portafogli, strumenti e impostazioni restano disponibili.</p>
        {preview.isPending ? <p role="status">Preparazione del riepilogo…</p> : null}
        {preview.error ? <p role="alert" className="text-sm text-destructive">{preview.error.message}</p> : null}
        {preview.data ? <>
          <ul className="text-sm">
            <li>{preview.data.operations} operazioni da eliminare ({preview.data.untrackedOperations} senza origine tracciata, incluse eventuali operazioni manuali)</li>
            <li>{preview.data.statements} rendiconti da eliminare</li>
            <li>{preview.data.prices} prezzi personali da eliminare</li>
            <li>{preview.data.cashAccounts} conti di liquidità broker da azzerare</li>
          </ul>
          <label htmlFor="reset-investments-confirmation" className="text-sm">Per confermare scrivi <strong>{CONFIRMATION}</strong></label>
          <Input id="reset-investments-confirmation" autoComplete="off" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} disabled={reset.isPending} />
        </> : null}
        {reset.error ? <p role="alert" className="text-sm text-destructive">{reset.error.message}</p> : null}
        {preview.isError || reset.isError ? <Button variant="outline" onClick={review}>Aggiorna riepilogo</Button> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={reset.isPending}>Annulla</AlertDialogCancel>
          <Button variant="destructive" className="h-auto whitespace-normal" disabled={!preview.data || preview.isPending || reset.isPending || reset.isError || confirmation !== CONFIRMATION} onClick={confirm}>{reset.isPending ? "Azzeramento…" : "Azzera definitivamente gli investimenti"}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
