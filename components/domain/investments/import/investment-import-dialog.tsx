"use client";

/**
 * Dialog di import in blocco delle operazioni da un file CSV, in quattro passi: file, colonne, strumenti,
 * riepilogo. Lo stato vive in `useInvestmentImport`; chiudere il dialog lo azzera (il contenuto si smonta).
 */

import * as React from "react";
import { useState } from "react";
import { orderStatementFiles, type PreparedStatementFile } from "@/lib/investments/import/batch";
import { detectImportProvider } from "@/lib/investments/import/providers";
import { useParseStatementMutation } from "@/lib/queries/investments";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getImportProvider } from "@/lib/investments/import/providers";
import { UploadIcon } from "lucide-react";
import { DialogActions, PanelDialogHeader } from "../dialog-parts";
import { ImportFileStep } from "./import-file-step";
import { ImportInstrumentsStep } from "./import-instruments-step";
import { ImportMappingStep } from "./import-mapping-step";
import { ImportStatementStep } from "./import-statement-step";
import { ImportSummaryStep } from "./import-summary-step";
import { ImportBatchProgress } from "./import-batch-progress";
import { ImportDestinationField } from "./import-destination-field";
import { ImportNotice } from "./import-notice";
import { ImportStepper } from "./import-stepper";
import { explainFileError } from "@/lib/investments/import/messages";
import { useInvestmentImport } from "./use-investment-import";

export interface InvestmentImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Valuta dell'utente, proposta per crypto e strumenti manuali creati durante l'abbinamento. */
  currency: string;
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
  const error = s.error ? explainFileError(s.error) : null;
  const errorRef = React.useRef<HTMLDivElement>(null);
  // L'errore sta in cima al contenuto: se chi legge è più in basso (es. dopo aver caricato il file) lo porta in vista.
  React.useEffect(() => {
    if (s.error) errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [s.error]);
  const portfolioField =
    s.step === "mapping" && s.statement?.preset === "degiro" && s.portfolios.length > 0 ? (
      <ImportDestinationField portfolios={s.portfolios} value={s.portfolioId} onChange={s.setPortfolioId} />
    ) : undefined;

  return (
    <div className="flex min-h-0 flex-col gap-5">
      {!s.done ? <ImportStepper current={s.step} /> : null}

      <div className="min-h-0 overflow-y-auto">
        {error ? <ImportNotice ref={errorRef} tone="error" title={error.text} hint={error.hint} detail={error.text === s.error ? undefined : s.error ?? undefined} className="mb-5" /> : null}
        {s.step === "file" ? (
          <ImportFileStep provider={s.provider} onProviderChange={s.selectProvider} onLoad={s.loadText} onFiles={onFiles} reading={s.reading} />
        ) : null}
        {s.step === "mapping" && s.statement ? (
          <ImportStatementStep
            fileName={s.fileName}
            providerName={getImportProvider(s.statement.preset).name}
            rows={s.rows}
            warnings={s.warnings}
            cashMovements={s.statement.cashMovements}
            destination={portfolioField}
          />
        ) : null}
        {s.step === "mapping" && s.table && s.mapping ? (
          <ImportMappingStep
            fileName={s.fileName}
            providerName={s.provider === "fineco" ? getImportProvider("fineco").name : null}
            table={s.table}
            preset={s.preset}
            mapping={s.mapping}
            rows={s.rows}
            missing={s.missing}
            onChange={s.updateMapping}
          />
        ) : null}
        {s.step === "instruments" && s.identities.length === 0 ? <p className="text-sm text-muted-foreground">Questo file contiene solo movimenti del conto: non ci sono strumenti da abbinare. Vai avanti per importarli tutti.</p> : null}
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
          <ImportSummaryStep result={s.result} rows={s.rows} newInstruments={newInstruments} done={s.done} hasCashMovements={cashCount > 0} keepsOriginal={s.statement !== null} onNavigate={onClose} />
        ) : null}
      </div>

      <DialogActions>
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
                  : s.result.counts.error > 0
                    ? "Correggi le righe per continuare"
                    : s.result.counts.new === 0
                    ? initialFile ? "Già importato · continua" : "Niente di nuovo da importare"
                    : `Importa ${s.result.counts.new} ${s.result.counts.new === 1 ? "operazione" : "operazioni"}`}
              </Button>
            ) : null}
          </>
        )}
      </DialogActions>
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
    {files.length ? <ImportBatchProgress files={files} index={index} /> : null}
    <ImportWizard key={files.length ? index : "single"} currency={currency} initialFile={files[index]} onFiles={loadFiles} onClose={files.length ? () => setIndex((i) => i + 1) : onClose} finishLabel={files.length ? "File successivo" : "Chiudi"} />
  </>;
}

export function InvestmentImportDialog({ open, onOpenChange, currency }: InvestmentImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col">
        <PanelDialogHeader icon={UploadIcon} title="Importa operazioni" description="Carica il file del tuo broker: lo leggo, ti mostro cosa importerei e importo solo quando confermi." color="var(--primary)" />
        {open ? <ImportSession currency={currency} onClose={() => onOpenChange(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}
