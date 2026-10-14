"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * AuthSheet
 *
 * Scena delle pagine di accesso e onboarding come un foglio di calcolo, continuando l'apertura della landing: barra
 * della formula in alto (la pagina la cambia con `useSheetFormula`), intestazioni di colonna e numeri di riga, il form
 * (`children`) nella colonna B e a destra un esempio animato (il foglio dei conti che si sistema da solo). Su telefono
 * l'esempio scende sotto il form e restano tre colonne.
 */

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { AuthSheetExample } from "./auth-sheet-example";
import { SheetFormulaProvider, type SheetFormula } from "./auth-sheet-formula";

/** Cella «selezionata»: quella del campo email nel login. */
const ACTIVE_CELL = "B6";
const COLUMNS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
/** Colonne visibili su telefono. */
const MOBILE_COLUMNS = 3;
/** Righe numerate: bastano a riempire uno schermo alto, l'eccesso è tagliato. */
const ROW_COUNT = 40;
const DEFAULT_FORMULA: SheetFormula = { fn: "BENVENUTO" };

export interface AuthSheetProps {
  /** Riga sopra il form (logo e link al sito). */
  header: React.ReactNode;
  /** Riga in fondo alla pagina (es. note sulla sicurezza). */
  note?: React.ReactNode;
  /** Contenuto a destra del form; di default l'esempio animato (`AuthSheetExample`). */
  aside?: React.ReactNode;
  /** Percorsi in cui il contenuto a destra non si mostra (es. l'onboarding, dove conta solo il form). */
  asideHiddenOn?: readonly string[];
  /** Il form della pagina. */
  children: React.ReactNode;
  className?: string;
}

function FormulaText({ formula }: { formula: SheetFormula }) {
  return (
    <>
      <span className="text-primary">={formula.fn}</span>(
      {formula.arg !== undefined && <span className="text-pos">&quot;{formula.arg}&quot;</span>})
    </>
  );
}

/** Scena a foglio di calcolo delle pagine di accesso: barra della formula, griglia, form e, a destra, l'esempio animato. */
export function AuthSheet({ header, note, aside, asideHiddenOn = [], children, className }: AuthSheetProps) {
  const { t: tr } = useLocalization();
  const pathname = usePathname();
  const showAside = !asideHiddenOn.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const [formula, setFormula] = React.useState<SheetFormula | null>(null);

  return (
    <SheetFormulaProvider value={setFormula}>
      <div className={cn("flex min-h-dvh flex-col bg-background [--cols:3] [--rows-w:2rem] lg:[--cols:8] lg:[--rows-w:2.75rem]", className)}>
        <div className="flex h-10 shrink-0 items-center border-b border-border bg-card font-mono text-[13px]" aria-hidden="true">
          <span className="grid h-full w-12 place-items-center border-r border-border text-text-2 lg:w-16">{tr(ACTIVE_CELL)}</span>
          <span className="hidden h-full place-items-center border-r border-border px-3 italic text-text-3 sm:grid">{tr("fx")}</span>
          <span className="min-w-0 flex-1 truncate px-3.5">
            <FormulaText formula={formula ?? DEFAULT_FORMULA} />
          </span>
        </div>

        <div className="grid h-[26px] shrink-0 grid-cols-[2rem_repeat(var(--cols),minmax(0,1fr))] border-b border-border bg-muted font-mono text-[11px] text-text-3 lg:grid-cols-[2.75rem_repeat(var(--cols),minmax(0,1fr))]" aria-hidden="true">
          <span className="border-r border-border" />
          {COLUMNS.map((c, i) => (
            <span
              key={c}
              className={cn(
                "grid place-items-center border-r border-border",
                i >= MOBILE_COLUMNS && "hidden lg:grid",
                c === ACTIVE_CELL[0] && "bg-primary/10 text-primary"
              )}
            >
              {c}
            </span>
          ))}
        </div>

        <div className="relative flex flex-1">
          <div className="absolute inset-y-0 left-0 flex w-8 flex-col overflow-hidden border-r border-border bg-muted font-mono text-[11px] text-text-3 lg:w-11" aria-hidden="true">
            {Array.from({ length: ROW_COUNT }, (_, i) => (
              <span key={i} className="grid h-9 shrink-0 place-items-center border-b border-border">{i + 1}</span>
            ))}
          </div>
          <main
            className="flex-1 pl-8 lg:pl-11"
            style={{
              backgroundImage:
                "linear-gradient(color-mix(in oklab, var(--border) 65%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in oklab, var(--border) 65%, transparent) 1px, transparent 1px)",
              backgroundSize: "100% 36px, calc((100% - var(--rows-w)) / var(--cols)) 100%",
              backgroundPosition: "0 0, var(--rows-w) 0",
            }}
          >
            <div className="flex flex-col gap-10 px-4 pb-12 pt-9 lg:grid lg:grid-cols-8 lg:gap-0 lg:px-0">
              <div className="flex flex-col gap-8 lg:col-span-3 lg:col-start-2">
                {header}
                {children}
              </div>
              {showAside && (
                <div className="flex min-w-0 flex-col lg:col-span-3 lg:col-start-6 lg:mr-6 lg:mt-[4.5rem] lg:self-start">
                  {aside ?? <AuthSheetExample />}
                </div>
              )}
            </div>
          </main>
        </div>

        {note && (
          <footer className="flex min-h-9 shrink-0 items-center border-t border-border bg-muted px-4 py-2 font-mono text-xs text-text-3 lg:pl-11">
            {note}
          </footer>
        )}
      </div>
    </SheetFormulaProvider>
  );
}
