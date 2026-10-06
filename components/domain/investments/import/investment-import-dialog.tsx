"use client";

/**
 * Dialog di import in blocco delle operazioni da un file CSV, in quattro passi: file, colonne, strumenti,
 * riepilogo. Lo stato vive in `useInvestmentImport`; chiudere il dialog lo azzera (il contenuto si smonta).
 */

import { useState } from "react";
import { orderStatementFiles, type PreparedStatementFile } from "@/lib/investments/import/batch";
import { detectImportProvider } from "@/lib/investments/import/providers";
import { useParseStatementMutation } from "@/lib/queries/investments";
import { track } from "@/lib/analytics";
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

function ImportWizard({ currency, onClose, onFiles, initialFile, finishLabel = "Chiudi" }: { currency: string; onClose: () => void; onFiles?: (files: File[]) => Promise<void>; initialFile?: PreparedStatementFile; finishLabel?: string }) {
  const s = useInvestmentImport(initialFile);
  const cashCount = s.statement?.cashMovements?.length ?? 0;
  const validRows = s.rows.filter((r) => r.status === "ok").length + cashCount;
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
          <ImportFileStep provider={s.provider} onProviderChange={s.selectProvider} onLoad={s.loadText} onFiles={onFiles} reading={s.reading} />
        ) : null}
        {s.step === "mapping" && s.statement?.preset === "degiro" && s.portfolios.length > 0 ? <label className="mb-3 block text-sm">Portafoglio di destinazione <select className="ml-2 rounded border bg-background p-2" value={s.portfolioId || (s.portfolios.length === 1 ? s.portfolios[0].id : "")} onChange={(e) => s.setPortfolioId(e.target.value)}>{s.portfolios.length > 1 ? <option value="">Scegli un portafoglio</option> : null}{s.portfolios.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label> : null}
        {s.step === "mapping" && s.statement ? (
          <ImportStatementStep
            fileName={s.fileName}
            providerName={getImportProvider(s.statement.preset).name}
            rows={s.rows}
            warnings={s.warnings}
            cashMovements={s.statement.cashMovements}
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
        {s.step === "instruments" && s.identities.length === 0 ? <p className="text-sm text-muted-foreground">Questo file contiene solo movimenti del conto: non ci sono strumenti da abbinare. Prosegui al riepilogo per importarli tutti.</p> : null}
        {s.step === "instruments" && s.identities.length > 0 ? (
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
            {finishLabel}
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={s.step === "file" ? onClose : s.back} disabled={s.running || (!!initialFile && s.step === "mapping")}>
              {s.step === "file" ? "Annulla" : "Indietro"}
            </Button>
            {s.step === "mapping" ? (
              <Button onClick={s.goToInstruments} disabled={s.missing.length > 0 || validRows === 0 || s.resolving}>
                {s.resolving ? "Cerco gli strumenti…" : "Avanti"}
              </Button>
            ) : null}
            {s.step === "instruments" ? (
              <Button onClick={s.preview} disabled={(included.length === 0 && cashCount === 0) || s.running}>
                {s.running ? "Controllo…" : "Avanti"}
              </Button>
            ) : null}
            {s.step === "summary" && s.result ? (
              <Button onClick={s.result.counts.new === 0 && initialFile ? onClose : s.confirm} disabled={(s.result.counts.new === 0 && !initialFile) || s.result.counts.error > 0 || s.running}>
                {s.running
                  ? "Importo…"
                  : s.result.counts.new === 0
                    ? initialFile ? "Già importato · continua" : "Niente di nuovo da importare"
                    : `Importa ${s.result.counts.new} ${s.result.counts.new === 1 ? "operazione" : "operazioni"}`}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Keep every selected statement separate, including previews, failures and completed-file progress. */
function ImportSession({ currency, onClose }: { currency: string; onClose: () => void }) {
  const [files, setFiles] = useState<PreparedStatementFile[]>([]);
  const [index, setIndex] = useState(0);
  const parse = useParseStatementMutation();
  async function loadFiles(selected: File[]) {
    const prepared: PreparedStatementFile[] = [];
    for (const file of selected) {
      const text = await file.text();
      const provider = detectImportProvider(text);
      if (provider !== "interactive-brokers" && provider !== "degiro" && provider !== "trade-republic") throw new Error(`${file.name}: l'import multiplo supporta rendiconti IBKR, DEGIRO e Trade Republic. Importa gli altri CSV singolarmente.`);
      try { prepared.push({ name: file.name, text, parsed: await parse.mutateAsync(text) }); }
      catch (e) { throw new Error(`${file.name}: ${e instanceof Error ? e.message : "File non valido"}`); }
    }
    const ordered = orderStatementFiles(prepared);
    for (const file of ordered) track("investments_import_file_read", { provider: file.parsed.preset, chosen: false });
    setFiles(ordered); setIndex(0);
  }
  if (files.length && index === files.length) return <div className="space-y-4"><p role="status">Tutti i {files.length} file sono stati elaborati. I file già importati sono stati saltati senza creare doppioni.</p><Button onClick={onClose}>Chiudi</Button></div>;
  return <>
    {files.length ? <div className="space-y-2 text-sm"><p role="status">File {index + 1} di {files.length}: {files[index].name}</p><p className="text-muted-foreground">Controlla e conferma ogni rendiconto. Ogni file è salvato separatamente: se interrompi, quelli già completati restano importati.</p><ol className="max-h-24 overflow-y-auto">{files.map((file, i) => <li key={i}>{i < index ? "✓ Elaborato" : i === index ? "In corso" : "In attesa"} · {file.name}</li>)}</ol></div> : null}
    <ImportWizard key={files.length ? index : "single"} currency={currency} initialFile={files[index]} onFiles={loadFiles} onClose={files.length ? () => setIndex((i) => i + 1) : onClose} finishLabel={files.length ? "File successivo" : "Chiudi"} />
  </>;
}

export function InvestmentImportDialog({ open, onOpenChange, currency }: InvestmentImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <DialogHeader>
          <DialogTitle>Importa operazioni</DialogTitle>
          <DialogDescription>Scegli da dove arriva il file: Interactive Brokers, DEGIRO, Trade Republic, Yahoo Finance o un altro CSV.</DialogDescription>
        </DialogHeader>
        {open ? <ImportSession currency={currency} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
