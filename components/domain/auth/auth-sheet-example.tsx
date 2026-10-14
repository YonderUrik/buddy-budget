"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * AuthSheetExample
 *
 * Esempio animato accanto al form di accesso: un foglio dei conti con valori vecchi ed errori di formula che, riga dopo
 * riga, diventano i numeri che tiene BuddyBudget; finito il giro riparte. Con «riduci movimento» mostra direttamente
 * il risultato.
 */

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { TextMorph } from "@/components/motion";
import { cn } from "@/lib/utils";
import { AUTH_SHEET_EXAMPLE_ROWS, type AuthSheetExampleRow } from "./auth-sheet-example.data";

/** Tempo tra una riga e la successiva, e pausa sul risultato prima di ripartire (ms). */
const STEP_MS = 1300;
const HOLD_MS = 4000;
/** Pausa sul foglio «prima» all'inizio di ogni giro (ms). */
const START_MS = 1800;

export interface AuthSheetExampleProps {
  rows?: readonly AuthSheetExampleRow[];
  /** Titolo sopra la tabella. */
  title?: string;
  /** Riga in fondo (es. la nota sulla sola lettura). */
  caption?: string;
  className?: string;
}

/** Foglio d'esempio che si sistema da solo, riga per riga. */
export function AuthSheetExample({
  rows = AUTH_SHEET_EXAMPLE_ROWS,
  title = "Il tuo foglio dei conti, ma che si aggiorna da solo",
  caption = "La banca si collega in sola lettura (PSD2): BuddyBudget non può muovere soldi.",
  className,
}: AuthSheetExampleProps) {
  const { t: tr, language } = useLocalization();
  rows = rows.filter(row => language !== "de" || row.name !== "Tasse se vendo");
  // Quante righe sono già «sistemate»: 0 = tutto il foglio di prima, rows.length = tutto BuddyBudget.
  const [step, setStep] = React.useState(0);
  const reduced = useReducedMotion() ?? false;
  const done = reduced ? rows.length : step;

  React.useEffect(() => {
    if (reduced) return;
    const wait = done === 0 ? START_MS : done >= rows.length ? HOLD_MS : STEP_MS;
    const id = window.setTimeout(() => setStep((d) => (d >= rows.length ? 0 : d + 1)), wait);
    return () => window.clearTimeout(id);
  }, [reduced, done, rows.length]);

  return (
    <figure className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}>
      <figcaption className="border-b border-border px-4 py-3 font-heading text-base font-medium">{tr(title)}</figcaption>
      <table className="w-full border-collapse text-sm">
        <thead className="sr-only">
          <tr>
            <th scope="col">{tr("Voce")}</th>
            <th scope="col">{tr("Valore")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const fixed = i < done;
            const current = i === done - 1;
            return (
              <tr key={row.name} className="border-t border-border first:border-t-0">
                <th scope="row" className="w-[42%] px-4 py-2.5 text-left align-top font-medium">
                  {tr(row.name)}
                </th>
                <td
                  className={cn(
                    "px-4 py-2.5 text-right align-top transition-shadow duration-300",
                    current && "shadow-[inset_0_0_0_2px_var(--primary)]"
                  )}
                >
                  <span
                    className={cn(
                      "block font-mono tabular-nums transition-colors duration-300",
                      fixed ? "text-foreground" : row.sheetError ? "text-neg" : "text-text-2"
                    )}
                  >
                    <TextMorph>{fixed ? row.appValue : row.sheetValue}</TextMorph>
                  </span>
                  <span className={cn("block text-xs transition-colors duration-300", fixed ? "text-pos" : "text-text-3")}>
                    {tr(fixed ? row.appNote : row.sheetNote)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-border bg-muted/50 px-4 py-2.5 text-xs text-text-3">{tr(caption)}</p>
    </figure>
  );
}
