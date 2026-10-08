/** Intestazione di sezione nello stile della Panoramica: icona su fondo tinto, titolo e link. */

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRightIcon } from "lucide-react";

export interface SectionTitleProps {
  icon: LucideIcon;
  title: string;
  /** Token CSS del colore dell'ambito (es. `var(--swatch-teal)`). */
  color: string;
  href?: string;
  linkLabel?: string;
}

export function SectionTitle({ icon: Icon, title, color, href, linkLabel }: SectionTitleProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-full" style={{ color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }} aria-hidden="true">
          <Icon className="size-[18px]" />
        </span>
        <h2 className="font-heading text-lg font-medium text-foreground">{title}</h2>
      </div>
      {href && linkLabel ? (
        <Link href={href} className="-mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
          {linkLabel}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
