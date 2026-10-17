"use client";

import { useEffect, useRef, useState } from "react";
import { SUM } from "@/content/home";
import { groupThousands } from "@/lib/format";
import { MOTION_OK } from "@/lib/motion/motion-ok";

/** Wait before the first row, then between rows (ms); the total counts up over `COUNT_MS`, under the 600 ms standard for animated figures. */
const START_MS = 250;
const STEP_MS = 170;
const COUNT_MS = 600;
/** Share of the card that must be in view before the sequence starts. */
const VISIBLE_RATIO = 0.4;

const TOTAL = SUM.rows.reduce((sum, row) => sum + row.value, 0);

/** Euro amount with a real minus sign and the Italian thousands separator. */
function money(value: number): string {
  return `${value < 0 ? "−" : ""}${groupThousands(Math.abs(value))} €`;
}

/**
 * The sum of the opening: the four places add up to the net worth. Rendered complete (server and reduced motion);
 * with motion, once the card is in view the rows appear one at a time while the total counts up, once.
 */
export function SumCard({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const [shown, setShown] = useState(SUM.rows.length);
  const [value, setValue] = useState(TOTAL);

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
        SUM.rows.forEach((_, i) => timers.push(window.setTimeout(() => setShown(i + 1), START_MS + i * STEP_MS)));
        timers.push(
          window.setTimeout(() => {
            const t0 = performance.now();
            const tick = (t: number) => {
              const p = Math.min(1, (t - t0) / COUNT_MS);
              const eased = 1 - Math.pow(1 - p, 3);
              setValue(TOTAL * eased);
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
  }, []);

  return (
    <div ref={ref} className={`sum${on ? " on" : ""}${className ? ` ${className}` : ""}`} aria-label={`${SUM.title}: ${money(TOTAL)}`}>
      <p className="sum-t">{SUM.title}</p>
      <p className="sum-total amt" aria-hidden="true">
        {groupThousands(value)}
        <small>{SUM.cents}</small>
      </p>
      <ul className="sum-rows">
        {SUM.rows.map((row, i) => (
          <li key={row.label} className={`${row.tone ?? ""}${i >= shown ? " hid" : ""}`.trim() || undefined}>
            <span>
              {row.label} <small>· {row.detail}</small>
            </span>
            <b>{money(row.value)}</b>
          </li>
        ))}
      </ul>
      <p className="sum-cap">{SUM.caption}</p>
    </div>
  );
}
