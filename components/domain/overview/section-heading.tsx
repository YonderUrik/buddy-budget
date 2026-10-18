"use client";
import { useLocalization } from "@/lib/localization/provider";
/** Intestazione di sezione della Panoramica: icona su fondo tinto del colore del suo ambito, titolo e link all'area. */

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRightIcon } from "lucide-react";
import { SECTION_TITLE } from "@/components/domain/shared";

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

/** taste-skill: the heading stands on its own, no tinted icon above or beside it (`icon` and `color` are kept for callers). */
export function SectionHeading({ title, id, href, linkLabel, onLinkClick }: SectionHeadingProps) {
  const { t: tr } = useLocalization();
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className={SECTION_TITLE}>
        {tr(title)}
      </h2>
      {href && linkLabel ? (
        <Link
          href={href}
          onClick={onLinkClick}
          className="-mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {tr(linkLabel)}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
