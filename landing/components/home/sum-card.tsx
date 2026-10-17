"use client";

import { useEffect, useRef, useState } from "react";
import type { SumText } from "@/content/home";
import { groupThousandsIn, money } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { MOTION_OK } from "@/lib/motion/motion-ok";

/** Wait before the first row, then between rows (ms); the total counts up over `COUNT_MS`, under the 600 ms standard for animated figures. */
const START_MS = 250;
const STEP_MS = 170;
const COUNT_MS = 600;
/** Share of the card that must be in view before the sequence starts. */
const VISIBLE_RATIO = 0.4;

export interface SumCardProps {
  text: SumText;
  locale: Locale;
  className?: string;
}

/**
 * The sum of the opening: the four places add up to the net worth. Rendered complete (server and reduced motion);
 * with motion, once the card is in view the rows appear one at a time while the total counts up, once.
 */
export function SumCard({ text, locale, className }: SumCardProps) {
  const total = text.rows.reduce((sum, row) => sum + row.value, 0);
  const rowCount = text.rows.length;
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [shown, setShown] = useState(rowCount);
  const [value, setValue] = useState(total);

  useEffect(() => {
    const el = ref.current;
    // Without motion the CSS hides nothing (`js-motion` is absent): the card is complete at rest.
    if (!el || !window.matchMedia(MOTION_OK).matches) return;
    const timers: number[] = [];
    let raf = 0;
    if (typeof IntersectionObserver === "undefined") {
      raf = requestAnimationFrame(() => setOn(true));
      return () => cancelAnimationFrame(raf);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        setShown(0);
        setValue(0);
        setOn(true);
        Array.from({ length: rowCount }).forEach((_, i) => timers.push(window.setTimeout(() => setShown(i + 1), START_MS + i * STEP_MS)));
        timers.push(
          window.setTimeout(() => {
            const t0 = performance.now();
            const tick = (t: number) => {
              const p = Math.min(1, (t - t0) / COUNT_MS);
              const eased = 1 - Math.pow(1 - p, 3);
              setValue(total * eased);
              if (p < 1) raf = requestAnimationFrame(tick);
            };
            raf = requestAnimationFrame(tick);
          }, START_MS),
        );
      },
      { threshold: VISIBLE_RATIO },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      timers.forEach((t) => clearTimeout(t));
      cancelAnimationFrame(raf);
    };
  }, [rowCount, total]);

  return (
    <div ref={ref} className={`sum${on ? " on" : ""}${className ? ` ${className}` : ""}`} aria-label={`${text.title}: ${money(total, locale)}`}>
      <p className="sum-t">{text.title}</p>
      <p className="sum-total amt" aria-hidden="true">
        {text.prefix ? <small>{text.prefix}</small> : null}
        {groupThousandsIn(value, locale)}
        <small>{text.cents}</small>
      </p>
      <ul className="sum-rows">
        {text.rows.map((row, i) => (
          <li key={row.label} className={`${row.tone ?? ""}${i >= shown ? " hid" : ""}`.trim() || undefined}>
            <span>
              {row.label} <small>· {row.detail}</small>
            </span>
            <b>{money(row.value, locale)}</b>
          </li>
        ))}
      </ul>
      <p className="sum-cap">{text.caption}</p>
    </div>
  );
}
