"use client";

import { useEffect, useRef } from "react";
import type { SecurityPoint } from "@/content/site";
import { SecurityArt } from "./security-art";

/** Quota di riquadro visibile oltre la quale parte l'animazione. */
const CARD_VISIBLE_RATIO = 0.5;

/** Riquadro della sezione Sicurezza: illustrazione animata (parte quando è in vista), titolo e testo. */
export function SecurityCard({ point }: { point: SecurityPoint }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("live");
          observer.disconnect();
        }
      },
      { threshold: CARD_VISIBLE_RATIO },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className="sec-card">
      <SecurityArt id={point.art} />
      <h3>{point.title}</h3>
      <p>{point.text}</p>
    </div>
  );
}
