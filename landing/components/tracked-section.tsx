"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import type { SectionId } from "@/lib/analytics";
import { useSectionView } from "@/lib/use-section-view";

export interface TrackedSectionProps {
  /** Id HTML della sezione (ancora). */
  id: string;
  /** Nome dell'evento `section_view`. */
  section: SectionId;
  as?: ElementType;
  className?: string;
  /** Segna la sezione come scura sotto la nav (la nav passa allo stile scuro). */
  navDark?: boolean;
  children: ReactNode;
}

/** Sezione che invia `section_view` a Umami la prima volta che entra davvero in vista. */
export function TrackedSection({ id, section, as: Tag = "section", className, navDark, children }: TrackedSectionProps) {
  const ref = useRef<HTMLElement>(null);
  useSectionView(ref, section);
  return (
    <Tag id={id} ref={ref} className={className} data-nav-dark={navDark ? "" : undefined}>
      {children}
    </Tag>
  );
}
