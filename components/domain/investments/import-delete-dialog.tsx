"use client";

/**
 * Conferma di eliminazione di una o più importazioni: dice chiaramente cosa viene eliminato (con l'elenco dei caricamenti
 * coinvolti), cosa resta e come tornare indietro, e rende il pulsante esplicito su ciò che farà.
 */

import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export interface ImportDeleteDialogProps {
  open: boolean;
  title: string;
  /** Una frase sul perché si vede questa conferma (es. caricamenti successivi che dipendono dai saldi). */
  intro?: string;
  /** Caricamenti che verranno eliminati, uno per riga. */
  items: string[];
  /** Cosa viene eliminato, in frasi brevi. */
  removes: string[];
  /** Cosa resta intatto. */
  keeps: string[];
  pending: boolean;
  error?: string | null;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ImportDeleteDialog({ open, title, intro, items, removes, keeps, pending, error, confirmLabel, onConfirm, onCancel }: ImportDeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next && !pending) onCancel(); }}>
      <AlertDialogContent className="max-h-[85dvh] overflow-y-auto data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{intro ?? "Controlla cosa viene eliminato prima di confermare."}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-4 text-sm">
          <div className="flex flex-col gap-1.5">
            <p className="font-medium text-foreground">Viene eliminato</p>
            <ul className="flex flex-col gap-1 text-muted-foreground">
              {items.map((item) => <li key={item} className="font-medium text-foreground">{item}</li>)}
              {removes.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </div>
          <div className="flex flex-col gap-1.5">
            <p className="font-medium text-foreground">Resta com&apos;è</p>
            <ul className="flex flex-col gap-1 text-muted-foreground">{keeps.map((line) => <li key={line}>{line}</li>)}</ul>
          </div>
        </div>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Annulla</AlertDialogCancel>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>{pending ? "Eliminazione…" : confirmLabel}</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
