"use client";

/**
 * Ritorno alla pagina madre, uguale in tutta l'app: freccia «‹» e nome della pagina a cui si torna, sopra il titolo,
 * con un'area di tocco di 44 px. Con `href` è un link (la pagina madre ha un indirizzo); con `onClick` è un pulsante
 * (es. dal gruppo di Impostazioni all'elenco, che vive nella stessa pagina).
 */

import Link from "next/link";
import { ChevronLeftIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const BACK_LINK_CLASS =
  "-ml-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-lg px-2 text-sm font-medium text-text-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export type BackLinkProps = {
  /** Nome della pagina a cui si torna (es. «Liquidità»). */
  label: string;
  className?: string;
} & ({ href: string; onClick?: never } | { onClick: () => void; href?: never });

export function BackLink({ label, href, onClick, className }: BackLinkProps) {
  const content = (
    <>
      <ChevronLeftIcon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </>
  );
  if (href !== undefined) {
    return (
      <Link href={href} className={cn(BACK_LINK_CLASS, className)}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cn(BACK_LINK_CLASS, className)}>
      {content}
    </button>
  );
}
