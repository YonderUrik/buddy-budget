"use client";

/** Confirmations of the group: leaving it, evening it out («Pareggiate»), removing someone added by name. */

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
import { useLocalization } from "@/lib/localization/provider";

export interface LeaveHouseholdDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  /** «Giulia ti deve 64,20 €» when the group is not even: a reason to settle first. */
  pendingBalance: string | null;
  /** The viewer is the last one in: leaving deletes the group. */
  last: boolean;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
}

export function LeaveHouseholdDialog({ open, onOpenChange, name, pendingBalance, last, pending, error, onConfirm }: LeaveHouseholdDialogProps) {
  const { t: tr } = useLocalization();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tr("Uscire da «{0}»?", { 0: name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {last
              ? tr("Sei l'ultimo nel gruppo: uscendo il gruppo sparisce, con i suoi inviti.")
              : tr("Gli altri smettono subito di vedere quello che facevi vedere, e tu il loro. I tuoi conti e movimenti restano come sono.")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {pendingBalance ? <p className="rounded-2xl bg-highlight px-4 py-3 text-sm">{tr("Prima di uscire: {0}. Pareggiate, se serve: dopo il saldo non si vede più.", { 0: pendingBalance })}</p> : null}
        {error ? <p className="text-sm text-destructive">{tr(error)}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{tr("Annulla")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending} variant="destructive">
            {pending ? tr("Uscita…") : tr("Esci dal gruppo")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface SettleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One line per payment («Giulia dà a te 64,20 €»). */
  lines: string[];
  pending: boolean;
  onConfirm: () => void;
}

export function SettleDialog({ open, onOpenChange, lines, pending, onConfirm }: SettleDialogProps) {
  const { t: tr } = useLocalization();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tr("Vi siete dati i soldi?")}</AlertDialogTitle>
          <AlertDialogDescription>{tr("Segno questi pagamenti come fatti e il saldo torna a zero. Le spese in comune da qui in poi ripartono da capo.")}</AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="flex flex-col gap-1.5 rounded-2xl bg-foreground/[0.04] px-4 py-3 text-sm">
          {lines.map((line) => (
            <li key={line} className="font-medium">{line}</li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel>{tr("Non ancora")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending}>
            {pending ? tr("Salvataggio…") : tr("Sì, pareggiate")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface RemovePersonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** First name of the person added by name. */
  name: string;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
}

/** Removing someone added by name: what happens to the expenses written for them. */
export function RemovePersonDialog({ open, onOpenChange, name, pending, error, onConfirm }: RemovePersonDialogProps) {
  const { t: tr } = useLocalization();
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{tr("Togliere {0} dal gruppo?", { 0: name })}</AlertDialogTitle>
          <AlertDialogDescription>
            {tr("Le spese pagate da {0} spariscono dal conto tra voi. Quelle fatte anche per {0} si dividono tra chi resta.", { 0: name })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-sm text-destructive">{tr(error)}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{tr("Annulla")}</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending} variant="destructive">
            {pending ? tr("Un attimo…") : tr("Togli {0}", { 0: name })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
