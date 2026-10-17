"use client";

import { useRef, type ElementType, type ReactNode } from "react";
import type { SectionId } from "@/lib/analytics";
import { useSectionView } from "@/lib/use-section-view";

export interface TrackedSectionProps {
  /** HTML id of the section (anchor). */
  id: string;
  /** Name of the `section_view` event. */
  section: SectionId;
  as?: ElementType;
  className?: string;
  /** Id of the heading that names the section. */
  "aria-labelledby"?: string;
  children: ReactNode;
}

/** Section that sends `section_view` to Umami the first time it really comes into view. */
export function TrackedSection({ id, section, as: Tag = "section", className, "aria-labelledby": labelledBy, children }: TrackedSectionProps) {
  const ref = useRef<HTMLElement>(null);
  useSectionView(ref, section);
  return (
    <Tag id={id} ref={ref} className={className} aria-labelledby={labelledBy}>
      {children}
    </Tag>
  );
}
