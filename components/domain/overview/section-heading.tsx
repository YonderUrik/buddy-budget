/** Intestazione di sezione della Panoramica: icona su fondo tinto del colore del suo ambito, titolo e link all'area. */

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRightIcon } from "lucide-react";

export interface SectionHeadingProps {
  icon: LucideIcon;
  title: string;
  /** Token CSS del colore dell'ambito (es. `var(--swatch-teal)`): tinge l'icona e il suo fondo. */
  color: string;
  id?: string;
  href?: string;
  linkLabel?: string;
  onLinkClick?: () => void;
}

export function SectionHeading({ icon: Icon, title, color, id, href, linkLabel, onLinkClick }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span
          className="grid size-9 place-items-center rounded-full"
          style={{ color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }}
          aria-hidden="true"
        >
          <Icon className="size-[18px]" />
        </span>
        <h2 id={id} className="font-heading text-lg font-medium text-foreground">
          {title}
        </h2>
      </div>
      {href && linkLabel ? (
        <Link
          href={href}
          onClick={onLinkClick}
          className="-mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {linkLabel}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
