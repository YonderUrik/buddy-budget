/** Tabella della scheda aperta nel foglio delle pagine di accesso: voce e descrizione, con bollino per novità e arrivi. */

import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthSheetTab } from "./auth-sheet.data";

export interface AuthSheetTableProps {
  tab: AuthSheetTab;
  className?: string;
}

/** Tabella a due colonne della scheda aperta, con didascalia e link facoltativi in fondo. */
export function AuthSheetTable({ tab, className }: AuthSheetTableProps) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-sm", className)}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted text-left text-[11px] font-medium uppercase tracking-wider text-text-3">
            <th scope="col" className="px-4 py-2.5 font-medium">{tab.columns[0]}</th>
            <th scope="col" className="px-4 py-2.5 font-medium">{tab.columns[1]}</th>
          </tr>
        </thead>
        <tbody>
          {tab.rows.map((row) => (
            <tr key={row.name} className="border-t border-border align-top">
              <th scope="row" className="w-[38%] px-4 py-3 text-left font-semibold">
                {row.name}
                {row.badge && (
                  <span
                    className={cn(
                      "ml-1.5 inline-block rounded-full px-2 py-px align-[1px] text-[10px] font-semibold uppercase tracking-wider",
                      row.badge === "Nuovo" ? "bg-primary/15 text-primary" : "bg-muted text-text-3"
                    )}
                  >
                    {row.badge}
                  </span>
                )}
              </th>
              <td className="px-4 py-3 text-text-2">{row.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(tab.caption || tab.link) && (
        <p className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-xs text-text-3">
          {tab.caption && <span>{tab.caption}</span>}
          {tab.link && (
            <a href={tab.link.href} className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
              {tab.link.label}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          )}
        </p>
      )}
    </div>
  );
}
