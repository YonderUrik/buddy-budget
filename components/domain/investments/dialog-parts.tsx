/**
 * Pezzi comuni dei dialog di Investimenti, nello stile della Panoramica: intestazione con icona tinta nel colore
 * dell'ambito, sezioni aperte separate da filettature (niente riquadri), barra dei passi numerata e piede con le azioni.
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { CheckIcon } from "lucide-react";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { PANEL_DEFAULT_COLOR } from "./panel-section";

/** Fondo tinto (stessa formula di `SectionHeading`) per le icone dei dialog. */
function tint(color: string): React.CSSProperties {
  return { color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` };
}

export interface PanelDialogHeaderProps {
  icon: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Token CSS del colore dell'ambito (default: `--primary`). */
  color?: string;
  className?: string;
}

/** Intestazione di un dialog: icona tinta, titolo e frase di contesto. Rende `DialogTitle`/`DialogDescription` per l'accessibilità. */
export function PanelDialogHeader({ icon: Icon, title, description, color = PANEL_DEFAULT_COLOR, className }: PanelDialogHeaderProps) {
  return (
    <DialogHeader className={cn("flex-row items-start gap-3", className)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full" style={tint(color)} aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col gap-1.5">
        <DialogTitle className="text-lg leading-tight">{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
      </div>
    </DialogHeader>
  );
}

export interface DialogSectionsProps {
  children: React.ReactNode;
  className?: string;
}

/** Contenitore di `DialogSection`: le sezioni si separano con una filettatura. */
export function DialogSections({ children, className }: DialogSectionsProps) {
  return <div className={cn("flex flex-col gap-5 [&>section+section]:border-t [&>section+section]:pt-5", className)}>{children}</div>;
}

export interface DialogSectionProps {
  title?: string;
  icon?: LucideIcon;
  color?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/** Sotto-sezione di un dialog: titolo breve (con icona tinta facoltativa), frase facoltativa e contenuto. */
export function DialogSection({ title, icon: Icon, color = PANEL_DEFAULT_COLOR, description, children, className }: DialogSectionProps) {
  const id = React.useId();
  return (
    <section aria-labelledby={title ? id : undefined} className={cn("flex min-w-0 flex-col gap-3", className)}>
      {title ? (
        <div className="flex items-center gap-2">
          {Icon ? (
            <span className="grid size-7 place-items-center rounded-full" style={tint(color)} aria-hidden="true">
              <Icon className="size-3.5" />
            </span>
          ) : null}
          <h3 id={id} className="text-sm font-semibold text-foreground">
            {title}
          </h3>
        </div>
      ) : null}
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {children}
    </section>
  );
}

export interface DialogActionsProps {
  children: React.ReactNode;
  className?: string;
}

/** Piede del dialog: azioni su una riga con filettatura sopra, a filo dei bordi del dialog. */
export function DialogActions({ children, className }: DialogActionsProps) {
  return (
    <div className={cn("-mx-6 -mb-6 flex flex-wrap items-center justify-between gap-2 border-t px-6 py-4", className)}>{children}</div>
  );
}

export interface DialogStepsProps {
  steps: readonly string[];
  /** Indice (da 0) del passo corrente. */
  current: number;
  ariaLabel: string;
  className?: string;
}

/** Barra dei passi: numeri in cerchio (spunta sui passi fatti), etichetta e filo di collegamento. */
export function DialogSteps({ steps, current, ariaLabel, className }: DialogStepsProps) {
  return (
    <ol className={cn("flex items-center gap-2", className)} aria-label={ariaLabel}>
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={label} className="flex min-w-0 flex-1 items-center gap-2 last:flex-none" aria-current={active ? "step" : undefined}>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-xs font-medium",
                done || active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              )}
              aria-hidden="true"
            >
              {done ? <CheckIcon className="size-3.5" /> : i + 1}
            </span>
            <span className={cn("truncate text-sm", active ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</span>
            {i < steps.length - 1 ? <span className={cn("h-px min-w-3 flex-1", done ? "bg-primary" : "bg-border")} aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
