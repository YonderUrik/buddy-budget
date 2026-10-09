/**
 * Avviso dell'import, senza riquadro: icona tinta, titolo, spiegazione e — separata — la cosa da fare. Serve per errori
 * (il file non si legge), avvisi (qualcosa non viene importato) e informazioni.
 */

import * as React from "react";
import { AlertTriangleIcon, CircleAlertIcon, InfoIcon, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ImportNoticeTone = "error" | "warning" | "info";

export interface ImportNoticeProps {
  tone: ImportNoticeTone;
  title: string;
  /** Spiegazione sotto il titolo. */
  children?: React.ReactNode;
  /** Cosa fare, in una frase. */
  hint?: string;
  /** Messaggio tecnico originale, per chi vuole il dettaglio (si apre su richiesta). */
  detail?: string;
  className?: string;
  ref?: React.Ref<HTMLDivElement>;
}

const TONES: Record<ImportNoticeTone, { icon: LucideIcon; color: string }> = {
  error: { icon: CircleAlertIcon, color: "var(--destructive)" },
  warning: { icon: AlertTriangleIcon, color: "var(--swatch-amber)" },
  info: { icon: InfoIcon, color: "var(--swatch-indigo)" },
};

export function ImportNotice({ tone, title, children, hint, detail, className, ref }: ImportNoticeProps) {
  const { icon: Icon, color } = TONES[tone];
  return (
    <div ref={ref} role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3", className)}>
      <span
        className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full"
        style={{ color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }}
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
        {hint ? (
          <p className="text-sm text-foreground">
            <span className="font-medium">Cosa fare:</span> {hint}
          </p>
        ) : null}
        {detail ? (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Dettaglio tecnico</summary>
            <p className="mt-1 break-words font-mono">{detail}</p>
          </details>
        ) : null}
      </div>
    </div>
  );
}
