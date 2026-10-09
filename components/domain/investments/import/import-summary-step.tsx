"use client";

/**
 * Ultimo passo dell'import: cosa succederà alla conferma (operazioni nuove, già presenti e saltate, titoli da
 * aggiungere, errori che bloccano) e, dopo la conferma, cosa è successo e dove trovare i dati.
 */

import Link from "next/link";
import { CheckCircle2Icon, CheckIcon } from "lucide-react";
import { explainRowMessage } from "@/lib/investments/import/messages";
import type { ImportRow } from "@/lib/investments/import/normalize";
import type { ImportResult } from "@/lib/investments/import/types";
import { DialogSection, DialogSections } from "../dialog-parts";
import { ImportNotice } from "./import-notice";
import { PreviewNumbers } from "./import-preview-parts";

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
  if (done) {
    return (
      <DialogSections>
        <section className="flex flex-col items-center gap-2 py-4 text-center">
          <CheckCircle2Icon className="size-10 text-pos" aria-hidden="true" />
          <p className="font-heading text-3xl font-medium tabular-nums text-foreground">{result.inserted}</p>
          <p className="text-sm text-muted-foreground">{result.inserted === 1 ? "operazione importata" : "operazioni importate"}</p>
        </section>
        <DialogSection title="Cosa è successo">
          <ul className="flex flex-col gap-1.5">
            {result.replacement ? <Fact>{plural(result.replacement.statements, "rendiconto precedente sostituito", "rendiconti precedenti sostituiti")} ({result.replacement.operations} operazioni, dal {result.replacement.from} al {result.replacement.to}).</Fact> : null}
            {result.instrumentsCreated > 0 ? <Fact>{plural(result.instrumentsCreated, "strumento nuovo aggiunto", "strumenti nuovi aggiunti")} ai tuoi strumenti.</Fact> : null}
            {result.counts.duplicate > 0 ? <Fact>{plural(result.counts.duplicate, "operazione era già presente ed è stata saltata", "operazioni erano già presenti e sono state saltate")}: nessun doppione.</Fact> : null}
            {keepsOriginal ? <Fact>I dati originali del file sono conservati, così puoi sostituirli o cancellarli da «Gestisci importazioni».</Fact> : null}
          </ul>
        </DialogSection>
        <DialogSection title="Cosa fare ora">
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li>
              Trovi le operazioni in{" "}
              <Link href="/investimenti/operazioni" onClick={onNavigate} className="font-medium text-primary hover:underline">Investimenti → Operazioni</Link>.
            </li>
            {hasCashMovements ? (
              <li>
                I movimenti del conto sono in{" "}
                <Link href="/liquidita" onClick={onNavigate} className="font-medium text-primary hover:underline">Liquidità → Movimenti</Link>, da categorizzare.
              </li>
            ) : null}
            <li>I prezzi storici si scaricano in background: il grafico si completa entro qualche minuto.</li>
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
        {result.counts.new === 0 && errors.length === 0 ? <ImportNotice tone="info" title="Non c'è niente di nuovo da importare">Tutte le operazioni di questo file sono già presenti: puoi caricarlo di nuovo senza creare doppioni.</ImportNotice> : null}
        {result.replacement ? (
          <ImportNotice tone="info" title={`Sostituisco ${plural(result.replacement.statements, "rendiconto", "rendiconti")} (${result.replacement.operations} operazioni)`}>
            Il nuovo file copre il periodo {result.replacement.from} – {result.replacement.to} e prende il posto di quello che c&apos;era. I periodi fuori da questo intervallo restano invariati. Se un controllo fallisce, non viene sostituito nulla.
          </ImportNotice>
        ) : null}
        <ul className="flex flex-col gap-1.5">
          {result.counts.duplicate > 0 ? <Fact>Le operazioni già presenti vengono saltate: puoi reimportare lo stesso file senza creare doppioni.</Fact> : null}
          {freeShares > 0 ? <Fact>{plural(freeShares, "acquisto a prezzo zero", "acquisti a prezzo zero")} (quote ricevute gratis, per esempio staking): abbassano il prezzo medio.</Fact> : null}
          {discarded > 0 ? <Fact>{plural(discarded, "riga del file non viene importata", "righe del file non vengono importate")}: le hai viste nell&apos;anteprima.</Fact> : null}
        </ul>
      </DialogSection>
      {errors.length > 0 ? (
        <DialogSection title={errors.length === 1 ? "1 riga da correggere" : `${errors.length} righe da correggere`} description="Finché ci sono errori non importo nulla, così non resta un import a metà.">
          <div className="flex flex-col gap-3">
            {errors.slice(0, MAX_LISTED_ERRORS).map((row) => {
              const e = explainRowMessage(row.message ?? "Riga non valida");
              return <ImportNotice key={row.line} tone="error" title={`Riga ${row.line}: ${e.text}`} hint={e.hint} detail={row.message ?? undefined} />;
            })}
            {errors.length > MAX_LISTED_ERRORS ? <p className="text-sm text-muted-foreground">…e altre {errors.length - MAX_LISTED_ERRORS} righe.</p> : null}
          </div>
          <p className="text-sm text-muted-foreground">Correggi il file e ricaricalo, oppure torna indietro ed escludi lo strumento interessato.</p>
        </DialogSection>
      ) : null}
    </DialogSections>
  );
}
