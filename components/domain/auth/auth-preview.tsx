"use client";

/**
 * AuthPreview
 *
 * Preview beside the sign-in form, set like the landing's live list: the promise at display size, then the four
 * places (bank accounts, investments, pension fund, mortgage and loans) coming in one by one, a thick bar and the
 * net worth. No window, no frame: type on the navy field. Data of a made-up person, the same figures as the landing. With
 * «reduce motion» it shows the result at once.
 */

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

/** The four places of the made-up person (the rounded figures of the landing's sum card and of the demo Panoramica). */
const PREVIEW_ROWS = [
  { label: "Conti in banca", detail: "3 conti", value: 22595 },
  { label: "Investimenti", detail: "3 titoli", value: 35389 },
  { label: "Fondo pensione", detail: "1 fondo", value: 11082 },
  { label: "Mutuo e prestiti", detail: "3 debiti", value: -39937 },
] as const;
/** Whole euros: the rows are rounded, so the total is too. */
const CURRENCY_FORMAT = { style: "currency", currency: "EUR", maximumFractionDigits: 0 } as const;
/** Wait before the first row and between rows (ms): one round, then the total stays. */
const START_MS = 600;
const STEP_MS = 650;

export interface AuthPreviewProps {
  className?: string;
}

/** The four places adding themselves up, one by one, to the net worth. */
export function AuthPreview({ className }: AuthPreviewProps) {
  const { t: tr, locale } = useLocalization();
  const reduced = useReducedMotion() ?? false;
  const [shown, setShown] = React.useState(0);
  const done = reduced ? PREVIEW_ROWS.length : shown;

  React.useEffect(() => {
    if (reduced || done >= PREVIEW_ROWS.length) return;
    const id = window.setTimeout(() => setShown((n) => n + 1), done === 0 ? START_MS : STEP_MS);
    return () => window.clearTimeout(id);
  }, [reduced, done]);

  const total = PREVIEW_ROWS.slice(0, done).reduce((sum, row) => sum + row.value, 0);
  const money = React.useMemo(() => new Intl.NumberFormat(locale, CURRENCY_FORMAT), [locale]);

  return (
    <figure className={cn("w-full max-w-[640px] text-on-brand-navy", className)}>
      <p className="font-display text-[4rem] font-light leading-[0.9] text-balance">{tr("Tutti i tuoi soldi, in un numero solo.")}</p>
      <ul className="mt-12">
        {PREVIEW_ROWS.map((row, i) => (
          <li
            key={row.label}
            className={cn(
              "flex items-baseline justify-between gap-6 py-1.5 font-display text-[2.5rem] font-light leading-tight transition-[opacity,translate] duration-500 motion-reduce:transition-none",
              i < done ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
            )}
          >
            <span>{tr(row.label)}</span>
            <span className="font-normal">{money.format(row.value)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-4 h-1.5 bg-on-brand-navy" aria-hidden="true" />
      <div className="mt-4 flex items-baseline justify-between gap-6">
        <span className="text-lg font-semibold">{tr("Patrimonio netto")}</span>
        <span className="font-display text-[6rem] font-normal leading-[0.9]">
          {money.format(total)}
        </span>
      </div>
      <figcaption className="mt-6 text-sm text-on-brand-navy-2">{tr("Dati di una persona inventata")}</figcaption>
    </figure>
  );
}
