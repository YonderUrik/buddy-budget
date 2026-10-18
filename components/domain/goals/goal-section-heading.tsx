"use client";

/**
 * Intestazione delle sezioni degli obiettivi, uguale a quelle della Panoramica (icona tinta, titolo, link facoltativo).
 * Sta qui per non caricare il barrel della Panoramica, che porta con sé i grafici.
 */

import Link from "next/link";
import { ArrowRightIcon, type LucideIcon } from "lucide-react";
import { SECTION_TITLE } from "@/components/domain/shared";

export interface GoalSectionHeadingProps {
  id: string;
  icon: LucideIcon;
  title: string;
  color: string;
  href?: string;
  linkLabel?: string;
  onLinkClick?: () => void;
}

/** taste-skill: the heading stands on its own, no tinted icon beside it (`icon` and `color` are kept for callers). */
export function GoalSectionHeading({ id, title, href, linkLabel, onLinkClick }: GoalSectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 id={id} className={SECTION_TITLE}>{title}</h2>
      {href && linkLabel ? (
        <Link href={href} onClick={onLinkClick} className="-mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {linkLabel}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
