"use client";

import { useEffect, type RefObject } from "react";
import { track, type SectionId } from "@/lib/analytics";

/** Quota di sezione visibile oltre la quale conta come "vista". */
const SECTION_VISIBLE_RATIO = 0.35;

/** Invia `section_view` a Umami la prima volta che l'elemento entra davvero in vista. */
export function useSectionView(ref: RefObject<Element | null>, section: SectionId): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          track("section_view", { section });
          observer.disconnect();
        }
      },
      { threshold: SECTION_VISIBLE_RATIO },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, section]);
}
