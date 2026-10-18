"use client";
import { useLocalization } from "@/lib/localization/provider";
/** Intestazione di sezione nello stile della Panoramica: icona su fondo tinto, titolo e link. */

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRightIcon } from "lucide-react";
import { SECTION_TITLE } from "@/components/domain/shared";

export interface SectionTitleProps {
  icon: LucideIcon;
  title: string;
  /** Token CSS del colore dell'ambito (es. `var(--swatch-teal)`). */
  color: string;
  href?: string;
  linkLabel?: string;
}

/** taste-skill: the heading stands on its own, no tinted icon beside it (`icon` and `color` are kept for callers). */
export function SectionTitle({ title, href, linkLabel }: SectionTitleProps) {
  const { t: tr } = useLocalization();
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className={SECTION_TITLE}>{tr(title)}</h2>
      {href && linkLabel ? (
        <Link href={href} className="-mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
          {tr(linkLabel)}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
