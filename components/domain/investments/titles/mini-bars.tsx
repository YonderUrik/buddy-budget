"use client";
import { useLocalization } from "@/lib/localization/provider";
/**
 * Barre verticali minime (niente assi né animazione) per pochi valori con etichetta: conti per esercizio, dividendi per
 * anno. I valori negativi restano a zero con l'importo scritto nel titolo della barra. L'altezza è in scala con il
 * valore più alto, misurata sull'area delle barre (l'etichetta dell'anno sta sotto e non la comprime).
 */

import { cn } from "@/lib/utils";

export interface MiniBarsProps {
  bars: { label: string; value: number | null; muted?: boolean; title: string }[];
  /** Classe del colore delle barre (es. "bg-[var(--swatch-blue)]"). */
  colorClass: string;
  className?: string;
  ariaLabel: string;
}

const MIN_BAR = 0.03;

export function MiniBars({ bars, colorClass, className, ariaLabel }: MiniBarsProps) {
  const { t: tr } = useLocalization();
  const max = Math.max(0, ...bars.map((b) => b.value ?? 0));
  return (
    <div className={cn("flex h-28 items-end gap-2", className)} role="img" aria-label={tr(ariaLabel)}>
      {bars.map((bar) => {
        const share = max > 0 && bar.value !== null ? Math.max(bar.value / max, bar.value > 0 ? MIN_BAR : 0) : 0;
        return (
          <div key={bar.label} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1" title={tr(bar.title)}>
            <div className="flex min-h-0 w-full flex-1 items-end">
              <span
                className={cn("w-full rounded-t-md rounded-b-sm", colorClass, bar.muted && "opacity-50", share === 0 && "h-0.5 bg-muted")}
                style={share > 0 ? { height: `${share * 100}%` } : undefined}
              />
            </div>
            <span className="shrink-0 truncate text-[11px] text-muted-foreground">{tr(bar.label)}</span>
          </div>
        );
      })}
    </div>
  );
}
