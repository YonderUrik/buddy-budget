"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Ultimo passo dell'import: cosa succederà alla conferma (operazioni nuove, già presenti e saltate, titoli da
 * aggiungere, errori che bloccano) e, dopo la conferma, cosa è successo e dove trovare i dati.
 */

import Link from "next/link";
import { CheckCircle2Icon, CheckIcon } from "lucide-react";
import { explainRowMessage, translateImportMessage } from "@/lib/investments/import/messages";
import type { ImportRow } from "@/lib/investments/import/normalize";
import type { ImportResult } from "@/lib/investments/import/types";
import { DialogSection, DialogSections } from "../dialog-parts";
import { ImportNotice } from "./import-notice";
import { PreviewNumbers } from "./import-preview-parts";
import { useInvestmentsActions } from "../investments-actions";

export interface ImportSummaryStepProps {
  result: ImportResult;
  /** Righe lette dal file (per contare avvisi e scarti a monte dell'anteprima). */
  rows: ImportRow[];
  /** Strumenti che verranno aggiunti al catalogo. */
  newInstruments: number;
  /** L'import è stato eseguito (non è più un'anteprima). */
  done: boolean;
  /** Il file contiene anche movimenti del conto (finiscono in Liquidità). */
  hasCashMovements?: boolean;
  /** Il file è un rendiconto di un broker: i dati originali restano conservati e gestibili da «Gestisci importazioni». */
  keepsOriginal?: boolean;
  /** Chiamata quando si segue un link di «Cosa fare ora»: serve a chiudere il dialog. */
  onNavigate?: () => void;
}

/** Errori elencati per riga. */
const MAX_LISTED_ERRORS = 5;

function plural(n: number, one: string, many: string): string {
  return n === 1 ? `1 ${one}` : `${n} ${many}`;
}

function Fact({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm text-muted-foreground">
      <CheckIcon className="mt-0.5 size-4 shrink-0 text-pos" aria-hidden="true" />
      <span>{children}</span>
    </li>
  );
}

export function ImportSummaryStep({ result, rows, newInstruments, done, hasCashMovements = false, keepsOriginal = false, onNavigate }: ImportSummaryStepProps) {
  const { t: tr, language } = useLocalization();
  const { openImportManagement } = useInvestmentsActions();
  if (done) {
    return (
      <DialogSections>
        <section className="flex flex-col items-center gap-2 py-4 text-center">
          <CheckCircle2Icon className="size-10 text-pos" aria-hidden="true" />
          <p className="font-heading text-3xl font-medium tabular-nums text-foreground">{result.inserted}</p>
          <p className="text-sm text-muted-foreground">{result.inserted === 1 ? tr("operazione importata") : tr("operazioni importate")}</p>
        </section>
        <DialogSection title={tr("Cosa è successo")}>
          <ul className="flex flex-col gap-1.5">
            {result.replacement ? <Fact>{plural(result.replacement.statements, tr("rendiconto precedente sostituito"), tr("rendiconti precedenti sostituiti"))} {"("}{result.replacement.operations}{" "}{tr("operazioni, dal")}{" "}{result.replacement.from}{" "}{tr("al")}{" "}{result.replacement.to}{")."}</Fact> : null}
            {result.instrumentsCreated > 0 ? <Fact>{plural(result.instrumentsCreated, tr("strumento nuovo aggiunto"), tr("strumenti nuovi aggiunti"))}{" "}{tr("ai tuoi strumenti.")}</Fact> : null}
            {result.counts.duplicate > 0 ? <Fact>{plural(result.counts.duplicate, tr("operazione era già presente ed è stata saltata"), tr("operazioni erano già presenti e sono state saltate"))}{tr(": nessun doppione.")}</Fact> : null}
            {keepsOriginal ? <Fact>{tr("I dati originali del file sono conservati, così puoi sostituirli o cancellarli da «Gestisci importazioni».")}</Fact> : null}
          </ul>
        </DialogSection>
        <DialogSection title={tr("Cosa fare ora")}>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li>{tr("Trovi le operazioni in")}{" "}
              <Link href="/investimenti/operazioni" onClick={onNavigate} className="font-medium text-primary hover:underline">{tr("Investimenti → Operazioni")}</Link>{"."}</li>
            {hasCashMovements ? (
              <li>{tr("I movimenti del conto sono in")}{" "}
                <Link href="/liquidita" onClick={onNavigate} className="font-medium text-primary hover:underline">{tr("Liquidità → Movimenti")}</Link>{tr(", da categorizzare.")}</li>
            ) : null}
            {keepsOriginal ? (
              <li>{tr("Il file è nella lista delle importazioni: da")}{" "}
                <button type="button" onClick={() => { onNavigate?.(); openImportManagement(); }} className="font-medium text-primary hover:underline">{tr("Gestisci importazioni")}</button>{" "}{tr("puoi vederlo, sostituirlo o cancellarlo.")}</li>
            ) : null}
            <li>{tr("I prezzi storici si scaricano in background: il grafico si completa entro qualche minuto.")}</li>
          </ul>
        </DialogSection>
      </DialogSections>
    );
  }

  const errors = result.rows.filter((r) => r.status === "error");
  const discarded = rows.filter((r) => r.status !== "ok").length;
  const freeShares = rows.filter((r) => r.status === "ok" && r.operation.price === 0 && r.operation.type === "acquisto").length;

  return (
    <DialogSections>
      <DialogSection>
        {errors.length === 0 ? (
          <PreviewNumbers
            items={[
              { value: result.counts.new, label: result.counts.new === 1 ? "operazione da importare" : "operazioni da importare" },
              { value: result.counts.duplicate, label: "già presenti, saltate" },
              { value: newInstruments, label: newInstruments === 1 ? "strumento nuovo" : "strumenti nuovi" },
            ]}
          />
        ) : null}
        {result.counts.new === 0 && errors.length === 0 ? <ImportNotice tone="info" title={tr("Non c'è niente di nuovo da importare")}>{tr("Tutte le operazioni di questo file sono già presenti: puoi caricarlo di nuovo senza creare doppioni.")}</ImportNotice> : null}
        {result.replacement ? (
          <ImportNotice tone="info" title={tr("Sostituisco {0} ({1} operazioni)", {0: plural(result.replacement.statements, "rendiconto", "rendiconti"), 1: result.replacement.operations})}>{tr("Il nuovo file copre il periodo")}{" "}{result.replacement.from} {"–"}{result.replacement.to}{" "}{tr("e prende il posto di quello che c'era. I periodi fuori da questo intervallo restano invariati. Se un controllo fallisce, non viene sostituito nulla.")}</ImportNotice>
        ) : null}
        <ul className="flex flex-col gap-1.5">
          {result.counts.duplicate > 0 ? <Fact>{tr("Le operazioni già presenti vengono saltate: puoi reimportare lo stesso file senza creare doppioni.")}</Fact> : null}
          {freeShares > 0 ? <Fact>{plural(freeShares, tr("acquisto a prezzo zero"), tr("acquisti a prezzo zero"))}{" "}{tr("(quote ricevute gratis, per esempio staking): abbassano il prezzo medio.")}</Fact> : null}
          {discarded > 0 ? <Fact>{plural(discarded, tr("riga del file non viene importata"), tr("righe del file non vengono importate"))}{tr(": le hai viste nell'anteprima.")}</Fact> : null}
        </ul>
      </DialogSection>
      {errors.length > 0 ? (
        <DialogSection title={errors.length === 1 ? tr("1 riga da correggere") : tr("{0} righe da correggere", {0: errors.length})} description={tr("Finché ci sono errori non importo nulla, così non resta un import a metà.")}>
          <div className="flex flex-col gap-3">
            {errors.slice(0, MAX_LISTED_ERRORS).map((row) => {
              const e = explainRowMessage(row.message ?? "Riga non valida", language);
              return <ImportNotice key={row.line} tone="error" title={tr("Riga {0}: {1}", {0: row.line, 1: e.text})} hint={e.hint} detail={row.message ? translateImportMessage(language, row.message) : undefined} />;
            })}
            {errors.length > MAX_LISTED_ERRORS ? <p className="text-sm text-muted-foreground">{tr("…e altre")}{" "}{errors.length - MAX_LISTED_ERRORS}{" "}{tr("righe.")}</p> : null}
          </div>
          <p className="text-sm text-muted-foreground">{tr("Correggi il file e ricaricalo, oppure torna indietro ed escludi lo strumento interessato.")}</p>
        </DialogSection>
      ) : null}
    </DialogSections>
  );
}
