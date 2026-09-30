"use client";

/** Riga compatta di un titolo nella sidebar: sigla, nome, mini linea, valore e variazione. Porta alla pagina del titolo. */

import Link from "next/link";
import { formatSignedPct, TitleSparkline } from "@/components/domain/investments";
import { cn } from "@/lib/utils";
import { changeToneClass } from "./sidebar-insights.utils";

/** Larghezza della mini linea: la sidebar è stretta (240px). */
const SPARK_WIDTH = 36;

export interface InsightRowProps {
  href: string;
  label: string;
  name: string;
  /** Testo dell'importo a destra (già formattato, eventualmente nascosto). */
  valueText: string;
  changePct: number | null;
  spark: number[];
  /** Avviso di prezzo scattato su questo titolo. */
  alert?: boolean;
  onNavigate?: () => void;
}

export function InsightRow({ href, label, name, valueText, changePct, spark, alert = false, onNavigate }: InsightRowProps) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={name}
      className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-none"
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1 text-[13px] font-semibold leading-tight text-sidebar-foreground">
          <span className="truncate">{label}</span>
          {alert ? (
            <span className="size-1.5 shrink-0 rounded-full bg-primary" role="img" aria-label="Avviso di prezzo scattato" />
          ) : null}
        </span>
        <span className="block truncate text-[11px] leading-tight text-sidebar-foreground/60">{name}</span>
      </span>
      <TitleSparkline values={spark} width={SPARK_WIDTH} className="shrink-0" />
      <span className="w-[68px] shrink-0 text-right leading-tight">
        <span className="block truncate text-[13px] font-semibold tabular-nums text-sidebar-foreground">{valueText}</span>
        <span className={cn("block text-[11px] tabular-nums", changeToneClass(changePct))}>
          {changePct === null ? "—" : formatSignedPct(changePct)}
        </span>
      </span>
    </Link>
  );
}
