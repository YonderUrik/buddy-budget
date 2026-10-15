"use client";

/**
 * Intestazione delle sezioni degli obiettivi, uguale a quelle della Panoramica (icona tinta, titolo, link facoltativo).
 * Sta qui per non caricare il barrel della Panoramica, che porta con sé i grafici.
 */

import Link from "next/link";
import { ArrowRightIcon, type LucideIcon } from "lucide-react";
import { GoalIcon } from "./goal-icon";

export interface GoalSectionHeadingProps {
  id: string;
  icon: LucideIcon;
  title: string;
  color: string;
  href?: string;
  linkLabel?: string;
  onLinkClick?: () => void;
}

export function GoalSectionHeading({ id, icon, title, color, href, linkLabel, onLinkClick }: GoalSectionHeadingProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <GoalIcon icon={icon} color={color} size="sm" className="size-9" />
        <h2 id={id} className="font-heading text-lg font-medium text-foreground">{title}</h2>
      </div>
      {href && linkLabel ? (
        <Link href={href} onClick={onLinkClick} className="-mr-2 flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {linkLabel}
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
