"use client";

/**
 * Dialog di import delle fotografie di un fondo da file CSV o Excel, in tre passi: file, colonne, riepilogo.
 * Non scrive nulla finché non si conferma al riepilogo; chiudere il dialog azzera il wizard (il contenuto si smonta).
 */

import { FileUpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ExistingSnapshot } from "@/lib/pension/import/plan";
import { cn } from "@/lib/utils";
import { PensionImportFileStep } from "./pension-import-file-step";
import { PensionImportMappingStep } from "./pension-import-mapping-step";
import { PensionImportSummaryStep } from "./pension-import-summary-step";
import { PENSION_IMPORT_STEPS, usePensionImport, type PensionImportStep } from "./use-pension-import";

export interface PensionImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fundId: string;
  fundName: string;
  /** Fotografie già salvate del fondo, per capire cosa si aggiunge e cosa si aggiorna. */
  existing: ExistingSnapshot[];
  currency: string;
  /** Data di oggi `YYYY-MM-DD`. */
  today: string;
}

const STEP_LABELS: Record<PensionImportStep, string> = { file: "File", columns: "Colonne", summary: "Riepilogo" };

function Stepper({ current }: { current: PensionImportStep }) {
  const index = PENSION_IMPORT_STEPS.indexOf(current);
  return (
    <ol className="flex gap-1.5" aria-label="Passi dell'import">
      {PENSION_IMPORT_STEPS.map((step, i) => (
        <li key={step} className="flex flex-1 flex-col gap-1" aria-current={i === index ? "step" : undefined}>
          <span className={cn("h-1 rounded-full", i <= index ? "bg-primary" : "bg-foreground/10")} />
          <span className={cn("text-sm", i === index ? "font-semibold text-foreground" : "text-text-2")}>{STEP_LABELS[step]}</span>
        </li>
      ))}
    </ol>
  );
}

function Wizard({ onClose, fundId, existing, currency, today }: Omit<PensionImportDialogProps, "open" | "onOpenChange" | "fundName"> & { onClose: () => void }) {
  const s = usePensionImport(fundId, existing, today);
  const discarded = s.rows.filter((r) => r.status === "error").length;
  const nothingToWrite = s.plan.counts.new + s.plan.counts.update === 0;
  const blocked = s.plan.counts.error > 0 || Boolean(s.plan.error);

  return (
    <div className="flex min-h-0 flex-col gap-5">
      {!s.done ? <Stepper current={s.step} /> : null}
      <div key={s.step} className="min-h-0 overflow-y-auto">
        {s.step === "file" ? <PensionImportFileStep onFile={(f) => void s.loadFile(f)} onText={s.loadText} /> : null}
        {s.step === "columns" && s.table && s.mapping ? (
          <PensionImportMappingStep fileName={s.fileName} table={s.table} mapping={s.mapping} rows={s.rows} missing={s.missing} currency={currency} onChange={s.updateMapping} />
        ) : null}
        {s.step === "summary" ? <PensionImportSummaryStep plan={s.plan} currency={currency} discarded={discarded} done={s.done} /> : null}
      </div>
      {s.error ? <p className="text-sm text-neg">{s.error}</p> : null}
      <div className="flex justify-between gap-2">
        {s.done ? (
          <Button className="ml-auto" onClick={onClose}>
            Chiudi
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={s.step === "file" ? onClose : s.back} disabled={s.running}>
              {s.step === "file" ? "Annulla" : "Indietro"}
            </Button>
            {s.step === "columns" ? (
              <Button onClick={s.toSummary} disabled={s.missing.length > 0 || s.plan.rows.length === 0}>
                Avanti
              </Button>
            ) : null}
            {s.step === "summary" ? (
              <Button onClick={s.confirm} disabled={nothingToWrite || blocked || s.running}>
                {s.running ? "Importo…" : nothingToWrite ? "Niente di nuovo da importare" : `Importa ${s.plan.counts.new + s.plan.counts.update} fotografie`}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function PensionImportDialog({ open, onOpenChange, fundName, ...wizard }: PensionImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader className="flex-row items-center gap-3">
          <span
            className="grid size-10 shrink-0 place-items-center rounded-full"
            style={{ color: "var(--primary)", backgroundColor: "color-mix(in oklab, var(--primary) 16%, transparent)" }}
            aria-hidden="true"
          >
            <FileUpIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-heading text-xl font-medium">Importa le fotografie</DialogTitle>
            <DialogDescription>Da un file CSV o Excel, nel fondo «{fundName}».</DialogDescription>
          </div>
        </DialogHeader>
        {open ? <Wizard {...wizard} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
