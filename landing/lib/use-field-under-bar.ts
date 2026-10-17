"use client";

import { useEffect, useState, type RefObject } from "react";

export type Field = "navy" | "light" | "alt" | "sun";

/** Share of the window a field must span to colour the bar. */
const FULL_WIDTH_SHARE = 0.8;

/**
 * The colour field (`data-field`) currently under the sticky bar, so the bar takes the colours of the chapter the
 * reader is in (taste-skill motion «Colour by chapter»). Reads the section at the bar's bottom edge on scroll, one
 * frame at a time; `fallback` is the field before anything is measured (the page's first section).
 */
export function useFieldUnderBar(bar: RefObject<HTMLElement | null>, fallback: Field): Field {
  const [field, setField] = useState<Field>(fallback);
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = bar.current;
      if (!el) return;
      const y = el.getBoundingClientRect().bottom + 1;
      const fields = document.querySelectorAll<HTMLElement>("main [data-field], footer[data-field]");
      let found: Field | null = null;
      for (const f of fields) {
        const r = f.getBoundingClientRect();
        // A field that covers only part of the width (a half cell beside a light one) does not colour the whole bar.
        if (r.width < window.innerWidth * FULL_WIDTH_SHARE) continue;
        if (r.top <= y && r.bottom > y) found = f.dataset.field as Field;
      }
      setField(found ?? fallback);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [bar, fallback]);
  return field;
}
