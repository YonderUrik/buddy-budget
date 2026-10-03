"use client";

/**
 * Dialog di import in blocco delle operazioni da un file CSV, in quattro passi: file, colonne, strumenti,
 * riepilogo. Lo stato vive in `useInvestmentImport`; chiudere il dialog lo azzera (il contenuto si smonta).
 */

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getImportProvider } from "@/lib/investments/import/providers";
import { cn } from "@/lib/utils";
import { ImportFileStep } from "./import-file-step";
import { ImportInstrumentsStep } from "./import-instruments-step";
import { ImportMappingStep } from "./import-mapping-step";
import { ImportStatementStep } from "./import-statement-step";
import { ImportSummaryStep } from "./import-summary-step";
import { IMPORT_STEPS, importStepLabel, type ImportStep } from "./investment-import.state";
import { useInvestmentImport } from "./use-investment-import";

export interface InvestmentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Valuta dell'utente, proposta per crypto e strumenti manuali creati durante l'abbinamento. */
  currency: string;
}

function Stepper({ current, structured }: { current: ImportStep; structured: boolean }) {
  const index = IMPORT_STEPS.indexOf(current);
  return (
    <ol className="flex gap-1.5" aria-label="Passi dell'import">
      {IMPORT_STEPS.map((step, i) => (
        <li key={step} className="flex flex-1 flex-col gap-1" aria-current={i === index ? "step" : undefined}>
          <span className={cn("h-1 rounded-full", i <= index ? "bg-primary" : "bg-muted")} />
          <span className={cn("text-xs", i === index ? "font-medium text-foreground" : "text-muted-foreground")}>
            {importStepLabel(step, structured)}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ImportWizard({ currency, onClose }: { currency: string; onClose: () => void }) {
  const s = useInvestmentImport();
  const validRows = s.rows.filter((r) => r.status === "ok").length;
  const included = s.identities.filter((i) => {
    const choice = s.choices[i.key];
    return choice && choice.kind !== "skip" && !s.excluded.has(i.key);
  });
  const newInstruments = included.filter((i) => s.choices[i.key]?.kind === "create").length;

  return (
    <div className="flex min-h-0 flex-col gap-4">
      {!s.done ? <Stepper current={s.step} structured={s.statement !== null} /> : null}

      <div className="min-h-0 overflow-y-auto">
        {s.step === "file" ? (
          <ImportFileStep provider={s.provider} onProviderChange={s.selectProvider} onLoad={s.loadText} reading={s.reading} />
        ) : null}
        {s.step === "mapping" && s.statement ? (
          <ImportStatementStep
            fileName={s.fileName}
            providerName={getImportProvider("interactive-brokers").name}
            rows={s.rows}
            warnings={s.warnings}
          />
        ) : null}
        {s.step === "mapping" && s.table && s.mapping ? (
          <ImportMappingStep
            fileName={s.fileName}
            table={s.table}
            preset={s.preset}
            mapping={s.mapping}
            rows={s.rows}
            missing={s.missing}
            onChange={s.updateMapping}
          />
        ) : null}
        {s.step === "instruments" ? (
          <ImportInstrumentsStep
            identities={s.identities}
            choices={s.choices}
            excluded={s.excluded}
            defaultCurrency={currency}
            onChoose={s.chooseInstrument}
            onToggleExcluded={s.toggleExcluded}
          />
        ) : null}
        {s.step === "summary" && s.result ? (
          <ImportSummaryStep result={s.result} rows={s.rows} newInstruments={newInstruments} done={s.done} />
        ) : null}
      </div>

      {s.error ? <p className="text-sm text-destructive">{s.error}</p> : null}

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
            {s.step === "mapping" ? (
              <Button onClick={s.goToInstruments} disabled={s.missing.length > 0 || validRows === 0 || s.resolving}>
                {s.resolving ? "Cerco gli strumenti…" : "Avanti"}
              </Button>
            ) : null}
            {s.step === "instruments" ? (
              <Button onClick={s.preview} disabled={included.length === 0 || s.running}>
                {s.running ? "Controllo…" : "Avanti"}
              </Button>
            ) : null}
            {s.step === "summary" && s.result ? (
              <Button onClick={s.confirm} disabled={s.result.counts.new === 0 || s.result.counts.error > 0 || s.running}>
                {s.running
                  ? "Importo…"
                  : s.result.counts.new === 0
                    ? "Niente di nuovo da importare"
                    : `Importa ${s.result.counts.new} ${s.result.counts.new === 1 ? "operazione" : "operazioni"}`}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

export function InvestmentImportDialog({ open, onOpenChange, currency }: InvestmentImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Importa operazioni</DialogTitle>
          <DialogDescription>Scegli da dove arriva il file: Interactive Brokers, Yahoo Finance o un altro CSV.</DialogDescription>
        </DialogHeader>
        {open ? <ImportWizard currency={currency} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
