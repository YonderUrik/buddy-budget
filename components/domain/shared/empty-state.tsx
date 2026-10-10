/**
 * Stato vuoto di una sezione: icona su fondo tinto, titolo, una frase che dice cosa si ottiene e l'azione giusta.
 * Senza riquadro, nello stile della Panoramica. Le azioni sono link (`href`) o bottoni (`onClick`).
 */

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Azione principale (in evidenza). */
  primary?: EmptyStateAction;
  /** Azione alternativa, meno in vista. */
  secondary?: EmptyStateAction;
  /** Token CSS del colore dell'ambito (es. `var(--swatch-teal)`). */
  color?: string;
  /** `start` allinea a sinistra (default), `center` centra tutto. */
  align?: "start" | "center";
  className?: string;
}

function ActionButton({ action, variant }: { action: EmptyStateAction; variant: "default" | "ghost" }) {
  const className = cn(buttonVariants({ variant }), "h-11 px-4");
  if (action.href && !action.disabled) {
    return (
      <Link href={action.href} onClick={action.onClick} className={className}>
        {action.label}
      </Link>
    );
  }
  return (
    <Button variant={variant} className="h-11 px-4" onClick={action.onClick} disabled={action.disabled}>
      {action.label}
    </Button>
  );
}

export function EmptyState({ icon: Icon, title, description, primary, secondary, color = "var(--swatch-teal)", align = "start", className }: EmptyStateProps) {
  const centered = align === "center";
  return (
    <div className={cn("flex flex-col gap-3 py-2", centered ? "items-center text-center" : "items-start", className)}>
      <span
        className="grid size-11 place-items-center rounded-full"
        style={{ color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }}
        aria-hidden="true"
      >
        <Icon className="size-5" />
      </span>
      <div className="flex max-w-md flex-col gap-1">
        <h2 className="font-heading text-xl font-medium text-foreground">{title}</h2>
        <p className="text-sm text-text-2">{description}</p>
      </div>
      {primary || secondary ? (
        <div className={cn("flex flex-wrap gap-2", centered && "justify-center")}>
          {primary ? <ActionButton action={primary} variant="default" /> : null}
          {secondary ? <ActionButton action={secondary} variant="ghost" /> : null}
        </div>
      ) : null}
    </div>
  );
}
