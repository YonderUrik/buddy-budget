"use client";

/**
 * AuthSheet
 *
 * Scena delle pagine di accesso e onboarding come un foglio di calcolo, continuando l'apertura della landing: barra
 * della formula in alto (la pagina la cambia con `useSheetFormula`), intestazioni di colonna e numeri di riga, il form
 * (`children`) nella colonna B, una tabella a destra e le schede in basso che la cambiano (cosa c'è dentro, novità,
 * in arrivo). Su telefono la tabella scende sotto il form e restano tre colonne.
 */

import * as React from "react";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { SheetFormulaProvider, type SheetFormula } from "./auth-sheet-formula";
import { AuthSheetTable } from "./auth-sheet-table";
import { buildAuthSheetTabs, type AuthSheetTab, type AuthSheetTabId } from "./auth-sheet.data";

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
  /** Testo a destra della fila di schede (es. note sulla sicurezza). */
  note?: React.ReactNode;
  /** Schede della tabella; di default dal catalogo (`buildAuthSheetTabs`). */
  tabs?: readonly AuthSheetTab[];
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

/** Scena a foglio di calcolo delle pagine di accesso: barra della formula, griglia, form e schede in basso. */
export function AuthSheet({ header, note, tabs: tabsProp, children, className }: AuthSheetProps) {
  const tabs = React.useMemo(() => tabsProp ?? buildAuthSheetTabs(), [tabsProp]);
  const [activeId, setActiveId] = React.useState<AuthSheetTabId>(tabs[0]?.id ?? "dentro");
  const [formula, setFormula] = React.useState<SheetFormula | null>(null);
  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const choose = (id: AuthSheetTabId) => {
    setActiveId(id);
    track("login_sheet_tab_selected", { tab: id });
  };

  return (
    <SheetFormulaProvider value={setFormula}>
      <div className={cn("flex min-h-dvh flex-col bg-background [--cols:3] [--rows-w:2rem] lg:[--cols:8] lg:[--rows-w:2.75rem]", className)}>
        <div className="flex h-10 shrink-0 items-center border-b border-border bg-card font-mono text-[13px]" aria-hidden="true">
          <span className="grid h-full w-12 place-items-center border-r border-border text-text-2 lg:w-16">{ACTIVE_CELL}</span>
          <span className="hidden h-full place-items-center border-r border-border px-3 italic text-text-3 sm:grid">fx</span>
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
              {active && (
                <AuthSheetTable
                  tab={active}
                  className="lg:col-span-3 lg:col-start-6 lg:mr-6 lg:mt-[4.5rem] lg:self-start"
                />
              )}
            </div>
          </main>
        </div>

        <div className="sticky bottom-0 flex h-10 shrink-0 items-stretch gap-0.5 overflow-x-auto border-t border-border bg-muted pl-2 pr-3 text-sm lg:pl-11">
          <div role="tablist" aria-label="Fogli" className="flex items-stretch gap-0.5">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={t.id === active?.id}
                onClick={() => choose(t.id)}
                className="whitespace-nowrap rounded-b-md px-4 font-medium text-text-2 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-selected:bg-card aria-selected:font-semibold aria-selected:text-foreground aria-selected:shadow-[inset_0_2px_0_var(--primary)]"
              >
                {t.label}
              </button>
            ))}
          </div>
          {note && <span className="ml-auto hidden self-center whitespace-nowrap pl-4 font-mono text-xs text-text-3 md:block">{note}</span>}
        </div>
      </div>
    </SheetFormulaProvider>
  );
}
