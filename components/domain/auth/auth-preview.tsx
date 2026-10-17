"use client";

/**
 * AuthPreview
 *
 * Preview beside the sign-in form: the Panoramica in an app window, with the net worth adding up place by place
 * (bank accounts, investments, pension fund, mortgage and loans) to the total, the same sum as the landing's opening
 * («Tutti i tuoi soldi, in un numero solo»). Data of a made-up person, the same figures as the landing. With
 * «reduce motion» it shows the result at once.
 */

import * as React from "react";
import { useReducedMotion } from "motion/react";
import { AnimatedNumber } from "@/components/motion";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

/** The four places of the made-up person (the rounded figures of the landing's sum card and of the demo Panoramica). */
const PREVIEW_ROWS = [
  { label: "Conti in banca", detail: "3 conti", value: 22595 },
  { label: "Investimenti", detail: "3 titoli", value: 35389 },
  { label: "Fondo pensione", detail: "1 fondo", value: 11082 },
  { label: "Mutuo e prestiti", detail: "3 debiti", value: -39937 },
] as const;
const PREVIEW_URL = "app.buddybudget.io/panoramica";
/** Whole euros: the rows are rounded, so the total is too. */
const CURRENCY_FORMAT = { style: "currency", currency: "EUR", maximumFractionDigits: 0 } as const;
/** Wait before the first row and between rows (ms): one round, then the total stays. */
const START_MS = 600;
const STEP_MS = 650;

export interface AuthPreviewProps {
  className?: string;
}

/** Window with the Panoramica adding itself up, place by place, to the net worth. */
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
    <figure className={cn("w-full max-w-[560px]", className)}>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-foreground/10">
        <div className="flex h-9 items-center gap-1.5 border-b border-border bg-muted px-3" aria-hidden="true">
          <i className="size-2.5 rounded-full bg-border" />
          <i className="size-2.5 rounded-full bg-border" />
          <i className="size-2.5 rounded-full bg-border" />
          <span className="mx-auto rounded-md bg-background px-3 py-0.5 font-mono text-[11px] text-text-3">{PREVIEW_URL}</span>
        </div>
        <div className="p-6">
          <p className="text-xs font-medium text-text-3">{tr("Patrimonio netto")}</p>
          <p className="mt-1 font-heading text-[2.6rem] font-semibold leading-none tracking-tight">
            <AnimatedNumber value={total} format={CURRENCY_FORMAT} mutedTail />
          </p>
          <ul className="mt-6 divide-y divide-border border-t border-border text-sm">
            {PREVIEW_ROWS.map((row, i) => (
              <li
                key={row.label}
                className={cn(
                  "flex items-baseline justify-between gap-4 py-2.5 transition-[opacity,transform] duration-500 motion-reduce:transition-none",
                  i === PREVIEW_ROWS.length - 1 && "border-b-2 border-b-foreground",
                  i < done ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                )}
              >
                <span>
                  {tr(row.label)} <span className="text-text-3">· {tr(row.detail)}</span>
                </span>
                <span className={cn("font-heading font-medium tabular-nums", row.value < 0 && "text-neg")}>{money.format(row.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <figcaption className="mt-5">
        <span className="block text-xs font-medium text-text-3">{tr("Dati di una persona inventata")}</span>
        <span className="mt-1 block font-heading text-xl font-semibold tracking-tight">{tr("Tutti i tuoi soldi, in un numero solo.")}</span>
      </figcaption>
    </figure>
  );
}
