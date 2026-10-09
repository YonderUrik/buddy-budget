"use client";

/** Dati del fondo che non cambiano nel tempo: nome e data di prima adesione (decide l'aliquota in uscita), con eliminazione. */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { LandmarkIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PensionSection } from "./pension-section";
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

export interface PensionProfileCardProps {
  name: string;
  adhesionDate: string;
  /** Data massima selezionabile per l'adesione (oggi). */
  today: string;
  /** Salva le modifiche; la promessa rifiutata porta il messaggio d'errore da mostrare. */
  onSave: (profile: { name: string; adhesionDate: string }) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function PensionProfileCard({ name, adhesionDate, today, onSave, onDelete }: PensionProfileCardProps) {
  const [draftName, setDraftName] = React.useState(name);
  const [draftDate, setDraftDate] = React.useState(adhesionDate);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const changed = draftName.trim() !== name || draftDate !== adhesionDate;
  const valid = draftName.trim() !== "" && draftDate !== "";

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operazione non riuscita");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PensionSection icon={LandmarkIcon} title="Dati del fondo" color="var(--swatch-slate)" description="Nome e data di prima adesione: quest'ultima decide l'aliquota in uscita.">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex min-w-0 flex-col gap-1.5 text-sm text-text-2">
            Nome del fondo
            <Input value={draftName} maxLength={80} onChange={(e) => setDraftName(e.target.value)} />
          </label>
          <label className="flex min-w-0 flex-col gap-1.5 text-sm text-text-2">
            Prima adesione a una forma pensionistica
            <Input type="date" value={draftDate} max={today} onChange={(e) => setDraftDate(e.target.value)} />
            <span className="text-xs">Conta la prima in assoluto, anche in un&apos;altra azienda: decide l&apos;aliquota in uscita.</span>
          </label>
        </div>
        {error ? <p role="alert" className="text-sm text-neg">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button disabled={!changed || !valid || busy} onClick={() => run(() => onSave({ name: draftName.trim(), adhesionDate: draftDate }))}>
            Salva le modifiche
          </Button>
          <AlertDialog>
            <AlertDialogTrigger className="min-h-8 text-sm text-text-2 underline-offset-2 hover:text-destructive hover:underline">Elimina questo fondo</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare questo fondo?</AlertDialogTitle>
                <AlertDialogDescription>Verranno cancellate anche tutte le sue fotografie e sparirà dal patrimonio netto. L&apos;operazione non si può annullare.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annulla</AlertDialogCancel>
                <AlertDialogAction onClick={() => run(onDelete)} disabled={busy}>Elimina</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </PensionSection>
  );
}
