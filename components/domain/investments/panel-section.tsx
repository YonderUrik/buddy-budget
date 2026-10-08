/**
 * Sezione aperta di Investimenti, nello stile della Panoramica: icona tinta nel colore del suo ambito, titolo e
 * link facoltativo, poi il contenuto direttamente sulla pagina (niente riquadro). Sostituisce il `Card` + `CardTitle`.
 */

import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { SectionHeading, type SectionHeadingProps } from "@/components/domain/overview";
import { cn } from "@/lib/utils";

/** Colore di default dell'ambito Investimenti (lo stesso della sezione nella Panoramica). */
export const PANEL_DEFAULT_COLOR = "var(--primary)";

export interface PanelSectionProps extends Pick<SectionHeadingProps, "href" | "linkLabel" | "onLinkClick"> {
  icon: LucideIcon;
  title: string;
  /** Token CSS del colore dell'ambito (default: `--primary`). */
  color?: string;
  /** Frase sotto l'intestazione (es. il periodo a cui si riferiscono i numeri). */
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function PanelSection({ icon, title, color = PANEL_DEFAULT_COLOR, description, children, className, ...link }: PanelSectionProps) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className={cn("flex min-w-0 flex-col gap-3", className)}>
      <SectionHeading id={id} icon={icon} title={title} color={color} {...link} />
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      {children}
    </section>
  );
}
