"use client";

import "./word-loop.css";
import { useEffect, useRef, useState } from "react";
import { EASE_OUT, gsap, MOTION_OK } from "@/lib/motion/gsap";

export interface WordLoopProps {
  /** Frasi che si alternano; la prima è quella mostrata senza movimento. */
  phrases: readonly string[];
  /** Pausa tra un cambio e l'altro, in millisecondi. */
  intervalMs?: number;
  className?: string;
}

/**
 * Parte di frase che cambia a rotazione: la vecchia sale e si sfoca, la nuova arriva da sotto e la larghezza segue.
 * Il lettore di schermo legge tutte le frasi una volta (testo nascosto), la parte animata è solo visiva. Con il
 * movimento ridotto resta ferma sulla prima frase. Idea di Text Loop di Motion Primitives (MIT).
 */
export function WordLoop({ phrases, intervalMs = 2600, className }: WordLoopProps) {
  const [index, setIndex] = useState(0);
  const boxRef = useRef<HTMLSpanElement>(null);
  const previous = useRef(0);

  useEffect(() => {
    if (!window.matchMedia(MOTION_OK).matches || phrases.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % phrases.length), intervalMs);
    return () => window.clearInterval(timer);
  }, [phrases.length, intervalMs]);

  useEffect(() => {
    const box = boxRef.current;
    if (!box || previous.current === index) return;
    const items = box.querySelectorAll<HTMLElement>("[data-phrase]");
    const out = items[previous.current];
    const next = items[index];
    previous.current = index;
    gsap.to(box, { width: next.offsetWidth, duration: 0.6, ease: EASE_OUT });
    gsap.to(out, { opacity: 0, yPercent: -60, filter: "blur(8px)", duration: 0.35, ease: "power2.in" });
    gsap.fromTo(next, { opacity: 0, yPercent: 60, filter: "blur(8px)" }, { opacity: 1, yPercent: 0, filter: "blur(0px)", duration: 0.6, delay: 0.12, ease: EASE_OUT });
  }, [index]);

  return (
    <span className={className}>
      <span className="sr-only">{phrases.join(", ")}</span>
      <span ref={boxRef} className="word-loop" aria-hidden="true">
        {phrases.map((phrase, i) => (
          <span key={phrase} data-phrase className={i === 0 ? "word-loop-item is-first" : "word-loop-item"}>
            {phrase}
          </span>
        ))}
      </span>
    </span>
  );
}
